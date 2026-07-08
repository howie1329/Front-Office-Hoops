import type { LeagueRecord, Rng } from "@workspace/shared/types"
import {
  applyMinimumSalaryFloorPenalty,
  advanceContractYears,
  assessLeagueSeasonFinances,
  rollFinancialYear,
  syncPlayersAfterContractChanges,
} from "./assessSeasonFinances"
import { applyAiCapBehavior } from "./ai/capCuts"
import { expireOneYearContracts, processContractOptions } from "./contracts/processContracts"
import { attachRookieContract } from "./freeAgency"
import {
  generateInitialContractsForLeague,
  applyInitialContractsToPlayers,
  generateInitialContract,
  createNonGuaranteedContract,
  normalizeInitialContractsForLeague,
} from "./contracts/createContract"
import {
  initializeLeagueFinancials,
  initializeTeamFinancials,
} from "./spendingProfiles"
import { getSeasonFinancials } from "./capMath"
import { isCampPlayerForSeason } from "../preseason/campPlayers"
import {
  assignInitialTeamStrategy,
  updateAllTeamStrategies,
} from "./teamStrategy"

export * from "./capMath"
export * from "./birdRights"
export {
  getPlayerContract,
  getTeamPayroll,
  getCurrentSalary,
  getYearsRemaining,
} from "./payroll"
export * from "./spendingProfiles"
export * from "./assessSeasonFinances"
export * from "./freeAgency"
export * from "./contractExtensions"
export * from "./contracts/createContract"
export * from "./contracts/processContracts"
export * from "./teamStrategy"
export { applyAiCapBehavior } from "./ai/capCuts"

export function processOffseasonFinancials(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = updateAllTeamStrategies(league)
  current = assessLeagueSeasonFinances(current, current.seasonState)
  current = processContractOptions(current, rng)
  current = expireOneYearContracts(current)
  return current
}

export function prepareNewSeasonFinancials(
  league: LeagueRecord,
  newSeason: number,
  rng: Rng
): LeagueRecord {
  let current = rollFinancialYear(league, newSeason)
  const { contracts, expiredPlayerIds } = advanceContractYears(
    current.contracts,
    newSeason
  )
  const synced = syncPlayersAfterContractChanges(
    current.seasonState.teams,
    current.freeAgentPool,
    contracts,
    expiredPlayerIds
  )

  current = {
    ...current,
    contracts,
    freeAgentPool: synced.freeAgentPool,
    seasonState: {
      ...current.seasonState,
      teams: synced.teams,
    },
  }

  current = applyAiCapBehavior(current, rng)
  current = applyMinimumSalaryFloorPenalty(current, newSeason)
  return current
}

export function initializeFinancialsForLeague(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  const leagueFinancials = initializeLeagueFinancials(rng)
  const seasonFinancials = getSeasonFinancials(leagueFinancials, 1)
  const teamFinancials = initializeTeamFinancials(
    league.seasonState.teams,
    rng,
    seasonFinancials
  )
  const initialContracts = generateInitialContractsForLeague(
    league.seasonState.teams,
    1,
    seasonFinancials,
    rng
  )
  const contracts = normalizeInitialContractsForLeague(
    league.seasonState.teams,
    initialContracts.contracts,
    teamFinancials,
    seasonFinancials,
    rng
  )

  const teams = league.seasonState.teams.map((team) => {
    const players = applyInitialContractsToPlayers([team], contracts)
    return { ...team, players }
  })

  const teamFinancialsWithStrategy = teamFinancials.map((teamFinance) => {
    const team = teams.find((entry) => entry.id === teamFinance.teamId)
    if (!team) {
      return teamFinance
    }
    return {
      ...teamFinance,
      strategy: assignInitialTeamStrategy(team, contracts, seasonFinancials, 1),
    }
  })

  return {
    ...league,
    contracts,
    leagueFinancials,
    teamFinancials: teamFinancialsWithStrategy,
    spendingProfileEvents: [],
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }
}

export function attachMissingRosterContracts(
  league: Pick<
    LeagueRecord,
    "seasonState" | "contracts" | "leagueFinancials" | "teamFinancials"
  >,
  rng: Rng,
): Pick<LeagueRecord, "seasonState" | "contracts"> {
  const season = league.seasonState.season
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
  const contracts = [...league.contracts]
  const activePlayerIds = new Set(
    contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => contract.playerId),
  )

  for (const team of league.seasonState.teams) {
    for (const player of team.players) {
      if (activePlayerIds.has(player.id)) {
        continue
      }

      contracts.push(
        player.tags.includes("camp_invite") &&
          isCampPlayerForSeason(player.id, season)
          ? createNonGuaranteedContract(
              player,
              team.id,
              season,
              seasonFinancials,
            )
          : generateInitialContract(
              player,
              team.id,
              season,
              seasonFinancials,
              rng,
            ),
      )
      activePlayerIds.add(player.id)
    }
  }

  const teams = league.seasonState.teams.map((team) => ({
    ...team,
    players: applyInitialContractsToPlayers([team], contracts),
  }))

  return {
    contracts,
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }
}

export function attachRookieContractToLeague(
  league: LeagueRecord,
  playerId: string,
  pickNumber: number,
  round: number,
  teamId: string
): LeagueRecord {
  const player = league.seasonState.teams
    .flatMap((team) => team.players)
    .find((entry) => entry.id === playerId)

  if (!player) {
    return league
  }

  return attachRookieContract(league, player, pickNumber, round, teamId)
}

export function attachRookieContractsForDraftSelections(
  league: LeagueRecord
): LeagueRecord {
  const selections = league.seasonState.draftState?.selections ?? []
  let current = league

  for (const selection of selections) {
    const player = current.seasonState.teams
      .flatMap((team) => team.players)
      .find((entry) => entry.id === selection.playerId)
    const hasActiveContract = current.contracts.some(
      (contract) =>
        contract.playerId === selection.playerId && contract.status === "active"
    )

    if (!player || player.activeContractId || hasActiveContract) {
      continue
    }

    current = attachRookieContractToLeague(
      current,
      selection.playerId,
      selection.overallPick,
      selection.round,
      selection.teamId
    )
  }

  return current
}
