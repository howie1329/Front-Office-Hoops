import type { FreeAgentOffer } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"
import {
  FA_POOL_MIN_RATIO,
  ROSTER_MAX,
} from "@workspace/shared/constants"

import {
  getSeasonFinancials,
  calculateMaxSalary,
  calculateMinSalary,
} from "./capMath"
import {
  calculateBirdSignCeiling,
  getBirdMaxYears,
} from "./birdRights"
import { getPlayerContract } from "./payroll"
import { getTeamFinancialPosition } from "./teamFinancialPosition"
import { clearCapHoldsForPlayer, getActiveCapHold } from "./capHolds"
import {
  createRookieScaleContract,
  createSignedContract,
  waiveContract,
} from "./contracts/createContract"
import { deriveTeamOverall } from "../playerRatings"
import { generateFreeAgents } from "../generateFreeAgents"
import { createLeagueLogEntry } from "../leagueLog"
import { findPlayer } from "../roster/ledger"

export type SignValidationResult =
  | { ok: true; signingException: FreeAgentOffer["signingException"] }
  | { ok: false; reason: string }

export function getMinimumFreeAgentPoolSize(teamCount: number): number {
  return Math.ceil(teamCount * FA_POOL_MIN_RATIO)
}

export function ensureFaPoolMinimum(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  const minimum = getMinimumFreeAgentPoolSize(league.seasonState.teams.length)
  const missing = Math.max(0, minimum - league.freeAgentPool.length)

  if (missing === 0) {
    return league
  }

  const generated = generateFreeAgents(
    missing,
    rng,
    `${league.seasonState.season}_${league.freeAgentPool.length}`
  )

  return {
    ...league,
    freeAgentPool: [...league.freeAgentPool, ...generated],
  }
}

function playerWasOnTeam(
  league: LeagueRecord,
  playerId: string,
  teamId: string
): boolean {
  return league.contracts.some(
    (contract) =>
      contract.playerId === playerId &&
      contract.teamId === teamId &&
      (contract.status === "expired" || contract.status === "declined")
  )
}

export function getTeamExpiredFreeAgents(
  league: LeagueRecord,
  teamId: string
): Player[] {
  const expiredPlayerIds = new Set(
    league.contracts
      .filter(
        (contract) =>
          (contract.status === "expired" || contract.status === "declined") &&
          contract.teamId === teamId
      )
      .map((contract) => contract.playerId)
  )

  return league.freeAgentPool.filter((player) =>
    expiredPlayerIds.has(player.id)
  )
}

export function getExternalFreeAgents(
  league: LeagueRecord,
  teamId: string
): Player[] {
  const ownExpiredIds = new Set(
    getTeamExpiredFreeAgents(league, teamId).map((player) => player.id)
  )

  return league.freeAgentPool.filter((player) => !ownExpiredIds.has(player.id))
}

export function canSignPlayer(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: FreeAgentOffer
): SignValidationResult {
  const season =
    league.seasonState.phase === "offseason"
      ? league.seasonState.season + 1
      : league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
  const teamFinance = league.teamFinancials.find(
    (entry) => entry.teamId === teamId
  )
  const team = league.seasonState.teams.find((entry) => entry.id === teamId)
  const player = findPlayer(league, playerId)

  if (!teamFinance || !team || !player) {
    return { ok: false, reason: "Team or player not found" }
  }

  if (team.players.length >= ROSTER_MAX && player.teamId !== teamId) {
    return { ok: false, reason: "Roster is full" }
  }

  const financialPosition = getTeamFinancialPosition(league, teamId, season)
  const capSpace = financialPosition.capSpace
  const isOverTax = financialPosition.isOverTax
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    player.yearsOfService
  )
  const minSalary = calculateMinSalary(seasonFinancials, player.yearsOfService)

  if (offer.firstYearSalary < minSalary) {
    return { ok: false, reason: "Offer below minimum salary" }
  }

  if (offer.firstYearSalary > maxSalary) {
    return { ok: false, reason: "Offer exceeds maximum salary" }
  }

  const isReSigning =
    player.teamId === teamId || playerWasOnTeam(league, playerId, teamId)
  const priorContract = league.contracts.find(
    (contract) =>
      contract.playerId === player.id &&
      contract.teamId === teamId &&
      (contract.status === "expired" || contract.status === "declined"),
  )
  const hold = getActiveCapHold(league, teamId, player.id, season)
  const birdRights = hold?.rightsType ?? "none"

  if (isReSigning && birdRights !== "none") {
    const ceiling = calculateBirdSignCeiling(
      birdRights,
      seasonFinancials,
      player.yearsOfService,
      priorContract?.yearlySalaries[0] ?? minSalary,
      seasonFinancials.salaryCap
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

  if (
    teamFinance.wasUnderCapThisYear &&
    teamFinance.roomMleRemaining >= offer.firstYearSalary &&
    teamFinance.mleUsed === 0
  ) {
    if (offer.years > 2) {
      return { ok: false, reason: "Offer exceeds Room MLE max years" }
    }
    return { ok: true, signingException: "mle_room" }
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
  offer: FreeAgentOffer
): LeagueRecord {
  const validation = canSignPlayer(league, teamId, playerId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const season =
    league.seasonState.phase === "offseason"
      ? league.seasonState.season + 1
      : league.seasonState.season
  const signingException =
    offer.signingException ?? validation.signingException!
  const player = findPlayer(league, playerId)

  if (!player) {
    throw new Error("Player not found")
  }

  const isReSign = playerWasOnTeam(league, playerId, teamId)
  const activeHold = getActiveCapHold(league, teamId, playerId, season)

  const contract = createSignedContract(
    player,
    teamId,
    season,
    offer.firstYearSalary,
    offer.years,
    signingException
  )

  const signedPlayer: Player = {
    ...player,
    teamId,
    status: "active",
    activeContractId: contract.id,
    seasonsWithTeam: isReSign
      ? activeHold?.rightsType === "bird"
        ? 3
        : activeHold?.rightsType === "early_bird"
          ? 2
          : activeHold?.rightsType === "non_bird"
            ? 1
            : player.seasonsWithTeam
      : 0,
  }

  let teams = league.seasonState.teams.map((team) => {
    if (team.id === teamId) {
      const withoutPlayer = team.players.filter(
        (entry) => entry.id !== playerId
      )
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
      overall: deriveTeamOverall(
        team.players.filter((entry) => entry.id !== playerId)
      ),
    }
  })

  teams = teams.map((team) => ({
    ...team,
    overall: deriveTeamOverall(team.players),
  }))

  const freeAgentPool = league.freeAgentPool.filter(
    (entry) => entry.id !== playerId
  )

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
    if (signingException === "mle_room") {
      return {
        ...entry,
        roomMleUsed: entry.roomMleUsed + offer.firstYearSalary,
        roomMleRemaining: Math.max(
          0,
          entry.roomMleRemaining - offer.firstYearSalary,
        ),
      }
    }
    return entry
  })

  const oldContract = getPlayerContract(league.contracts, player)
  const contracts = [
    ...league.contracts.map((entry) =>
      entry.id === oldContract?.id ? waiveContract(entry) : entry
    ),
    contract,
  ]

  const signedLeague: LeagueRecord = {
    ...league,
    contracts,
    teamFinancials,
    freeAgentPool,
    leagueLog: [
      ...league.leagueLog,
      createLeagueLogEntry({
        league,
        type: "signing",
        teamId,
        playerId,
        payload: {
          years: offer.years,
          firstYearSalary: offer.firstYearSalary,
          signingException,
          isReSign,
        },
      }),
    ],
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }

  return clearCapHoldsForPlayer(signedLeague, playerId)
}

export function attachRookieContract(
  league: LeagueRecord,
  player: Player,
  pickNumber: number,
  round: number,
  teamId: string
): LeagueRecord {
  const season =
    league.seasonState.phase === "offseason"
      ? league.seasonState.season + 1
      : league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)

  const contract = createRookieScaleContract(
    player,
    pickNumber,
    teamId,
    season,
    seasonFinancials,
    round
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
      entry.id === player.id ? updatedPlayer : entry
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
