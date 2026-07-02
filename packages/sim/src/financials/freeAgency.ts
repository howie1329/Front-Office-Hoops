import type { FreeAgentOffer } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng, TeamWithRoster } from "@workspace/shared/types"
import { ROSTER_MAX } from "@workspace/shared/constants"

import { getSeasonFinancials, calculateMaxSalary, calculateMinSalary } from "./capMath"
import {
  deriveBirdRights,
  calculateBirdSignCeiling,
  getBirdMaxYears,
} from "./birdRights"
import { getTeamPayroll, getPlayerContract } from "./payroll"
import {
  createRookieScaleContract,
  createSignedContract,
  waiveContract,
} from "./contracts/createContract"
import { computeAiCutScore } from "../roster/rosterManagement"
import { deriveTeamOverall } from "../playerRatings"
import { releasePlayer } from "../roster/rosterManagement"

export type SignValidationResult =
  | { ok: true; signingException: FreeAgentOffer["signingException"] }
  | { ok: false; reason: string }

export function canSignPlayer(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: FreeAgentOffer,
): SignValidationResult {
  const season = league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
  const teamFinance = league.teamFinancials.find((entry) => entry.teamId === teamId)
  const team = league.seasonState.teams.find((entry) => entry.id === teamId)
  const player =
    league.freeAgentPool.find((entry) => entry.id === playerId) ??
    team?.players.find((entry) => entry.id === playerId)

  if (!teamFinance || !team || !player) {
    return { ok: false, reason: "Team or player not found" }
  }

  if (team.players.length >= ROSTER_MAX && player.teamId !== teamId) {
    return { ok: false, reason: "Roster is full" }
  }

  const payroll = getTeamPayroll(teamId, league.contracts)
  const capSpace = seasonFinancials.salaryCap - payroll
  const isOverTax = payroll > seasonFinancials.luxuryTaxLine
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    player.yearsOfService,
  )
  const minSalary = calculateMinSalary(seasonFinancials, player.yearsOfService)

  if (offer.firstYearSalary < minSalary) {
    return { ok: false, reason: "Offer below minimum salary" }
  }

  if (offer.firstYearSalary > maxSalary) {
    return { ok: false, reason: "Offer exceeds maximum salary" }
  }

  const isReSigning = player.teamId === teamId
  const priorContract = getPlayerContract(league.contracts, player)
  const birdRights = deriveBirdRights(player.seasonsWithTeam)

  if (isReSigning && birdRights !== "none") {
    const ceiling = calculateBirdSignCeiling(
      birdRights,
      seasonFinancials,
      player.yearsOfService,
      priorContract?.yearlySalaries[0] ?? minSalary,
      seasonFinancials.salaryCap,
    )
    if (offer.firstYearSalary > ceiling) {
      return { ok: false, reason: "Offer exceeds Bird rights ceiling" }
    }
    const maxYears = getBirdMaxYears(birdRights)
    if (offer.years > maxYears) {
      return { ok: false, reason: "Offer exceeds max contract length" }
    }
    return {
      ok: true,
      signingException:
        birdRights === "bird"
          ? "bird"
          : birdRights === "early_bird"
            ? "early_bird"
            : "non_bird",
    }
  }

  if (capSpace >= offer.firstYearSalary) {
    if (offer.years > 4) {
      return { ok: false, reason: "Offer exceeds max contract length" }
    }
    return { ok: true, signingException: "cap_room" }
  }

  if (offer.firstYearSalary <= minSalary * 1.01) {
    return { ok: true, signingException: "minimum" }
  }

  if (teamFinance.mleRemaining >= offer.firstYearSalary) {
    const exception = isOverTax ? "mle_taxpayer" : "mle_non_taxpayer"
    const maxYears = isOverTax ? 2 : 4
    if (offer.years > maxYears) {
      return { ok: false, reason: "Offer exceeds MLE max years" }
    }
    return { ok: true, signingException: exception }
  }

  return { ok: false, reason: "Insufficient cap space or exceptions" }
}

export function signFreeAgent(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: FreeAgentOffer,
): LeagueRecord {
  const validation = canSignPlayer(league, teamId, playerId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const season = league.seasonState.season
  const signingException = offer.signingException ?? validation.signingException!
  const player =
    league.freeAgentPool.find((entry) => entry.id === playerId) ??
    league.seasonState.teams
      .flatMap((team) => team.players)
      .find((entry) => entry.id === playerId)

  if (!player) {
    throw new Error("Player not found")
  }

  const contract = createSignedContract(
    player,
    teamId,
    season,
    offer.firstYearSalary,
    offer.years,
    signingException,
  )

  const signedPlayer: Player = {
    ...player,
    teamId,
    status: "active",
    activeContractId: contract.id,
    seasonsWithTeam: player.teamId === teamId ? player.seasonsWithTeam : 0,
  }

  let teams = league.seasonState.teams.map((team) => {
    if (team.id === teamId) {
      const withoutPlayer = team.players.filter((entry) => entry.id !== playerId)
      const players = [...withoutPlayer, signedPlayer]
      return {
        ...team,
        players,
        overall: deriveTeamOverall(players),
      }
    }
    return {
      ...team,
      players: team.players.filter((entry) => entry.id !== playerId),
      overall: deriveTeamOverall(team.players.filter((entry) => entry.id !== playerId)),
    }
  })

  teams = teams.map((team) => ({
    ...team,
    overall: deriveTeamOverall(team.players),
  }))

  const freeAgentPool = league.freeAgentPool.filter((entry) => entry.id !== playerId)

  const teamFinancials = league.teamFinancials.map((entry) => {
    if (entry.teamId !== teamId) {
      return entry
    }
    if (
      signingException === "mle_non_taxpayer" ||
      signingException === "mle_taxpayer"
    ) {
      return {
        ...entry,
        mleUsed: entry.mleUsed + offer.firstYearSalary,
        mleRemaining: Math.max(0, entry.mleRemaining - offer.firstYearSalary),
      }
    }
    return entry
  })

  const oldContract = getPlayerContract(league.contracts, player)
  const contracts = [
    ...league.contracts.map((entry) =>
      entry.id === oldContract?.id ? waiveContract(entry) : entry,
    ),
    contract,
  ]

  return {
    ...league,
    contracts,
    teamFinancials,
    freeAgentPool,
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }
}

function selectBestFreeAgent(
  freeAgentPool: Player[],
  _team: TeamWithRoster,
): Player | undefined {
  return [...freeAgentPool].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )[0]
}

export function processAiFreeAgency(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.seasonState.season,
  )

  for (const team of current.seasonState.teams) {
    while (team.players.length < ROSTER_MAX) {
      const rosterSize =
        current.seasonState.teams.find((entry) => entry.id === team.id)?.players
          .length ?? 0
      if (rosterSize >= ROSTER_MAX) {
        break
      }

      const fa = selectBestFreeAgent(current.freeAgentPool, team)
      if (!fa) {
        break
      }

      const minSalary = calculateMinSalary(seasonFinancials, fa.yearsOfService)
      const payroll = getTeamPayroll(team.id, current.contracts)
      const capSpace = seasonFinancials.salaryCap - payroll
      const offerSalary =
        capSpace >= minSalary
          ? minSalary
          : Math.min(
              minSalary * 1.5,
              current.teamFinancials.find((entry) => entry.teamId === team.id)
                ?.mleRemaining ?? 0,
            )

      if (offerSalary < minSalary) {
        break
      }

      try {
        current = signFreeAgent(current, team.id, fa.id, {
          years: rng.int(1, 2),
          firstYearSalary: offerSalary,
        })
      } catch {
        break
      }
    }
  }

  return current
}

export function applyAiCapBehavior(
  league: LeagueRecord,
  _rng: Rng,
): LeagueRecord {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season,
  )

  let current = league

  for (const teamFinance of current.teamFinancials) {
    if (teamFinance.spendingProfile.taxTolerance !== "tax_averse") {
      continue
    }

    let payroll = getTeamPayroll(teamFinance.teamId, current.contracts)
    while (payroll > seasonFinancials.luxuryTaxLine) {
      const team = current.seasonState.teams.find(
        (entry) => entry.id === teamFinance.teamId,
      )
      if (!team || team.players.length <= 8) {
        break
      }

      const cutCandidate = [...team.players].sort(
        (a, b) => computeAiCutScore(b) - computeAiCutScore(a),
      )[0]
      if (!cutCandidate) {
        break
      }

      const contract = getPlayerContract(current.contracts, cutCandidate)
      const releaseResult = releasePlayer(
        current.seasonState.teams,
        current.freeAgentPool,
        { teamId: teamFinance.teamId, playerId: cutCandidate.id },
      )

      current = {
        ...current,
        seasonState: {
          ...current.seasonState,
          teams: releaseResult.teams,
        },
        freeAgentPool: releaseResult.freeAgentPool,
        contracts: contract
          ? current.contracts.map((entry) =>
              entry.id === contract.id ? waiveContract(entry) : entry,
            )
          : current.contracts,
      }

      payroll = getTeamPayroll(teamFinance.teamId, current.contracts)
    }
  }

  return current
}

export function attachRookieContract(
  league: LeagueRecord,
  player: Player,
  pickNumber: number,
  round: number,
  teamId: string,
): LeagueRecord {
  const season = league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)

  const contract = createRookieScaleContract(
    player,
    pickNumber,
    teamId,
    season,
    seasonFinancials,
    round,
  )

  const updatedPlayer: Player = {
    ...player,
    activeContractId: contract.id,
    seasonsWithTeam: 0,
    yearsOfService: 0,
  }

  const teams = league.seasonState.teams.map((team) => {
    if (team.id !== teamId) {
      return team
    }
    const players = team.players.map((entry) =>
      entry.id === player.id ? updatedPlayer : entry,
    )
    return { ...team, players, overall: deriveTeamOverall(players) }
  })

  return {
    ...league,
    contracts: [...league.contracts, contract],
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }
}
