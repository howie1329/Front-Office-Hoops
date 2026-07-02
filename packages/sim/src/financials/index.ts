import type { LeagueRecord, Rng } from "@workspace/shared/types"

import {
  applyMinimumSalaryFloorPenalty,
  advanceContractYears,
  assessLeagueSeasonFinances,
  rollFinancialYear,
  syncPlayersAfterContractChanges,
} from "./assessSeasonFinances"
import { expireOneYearContracts } from "./contracts/processContracts"
import { applyAiCapBehavior, attachRookieContract, processAiFreeAgency } from "./freeAgency"
import {
  generateInitialContractsForLeague,
  applyInitialContractsToPlayers,
} from "./contracts/createContract"
import {
  initializeLeagueFinancials,
  initializeTeamFinancials,
} from "./spendingProfiles"
import { getSeasonFinancials } from "./capMath"

export * from "./capMath"
export * from "./birdRights"
export { getPlayerContract, getTeamPayroll, getCurrentSalary, getYearsRemaining } from "./payroll"
export * from "./spendingProfiles"
export * from "./assessSeasonFinances"
export * from "./freeAgency"
export * from "./contracts/createContract"
export * from "./contracts/processContracts"

export function processOffseasonFinancials(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = assessLeagueSeasonFinances(league, league.seasonState)
  current = expireOneYearContracts(current)
  current = processAiFreeAgency(current, rng)
  return current
}

export function prepareNewSeasonFinancials(
  league: LeagueRecord,
  newSeason: number,
  rng: Rng,
): LeagueRecord {
  let current = rollFinancialYear(league, newSeason)
  const { contracts, expiredPlayerIds } = advanceContractYears(current.contracts)
  const synced = syncPlayersAfterContractChanges(
    current.seasonState.teams,
    current.freeAgentPool,
    contracts,
    expiredPlayerIds,
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
  rng: Rng,
): LeagueRecord {
  const leagueFinancials = initializeLeagueFinancials(rng)
  const seasonFinancials = getSeasonFinancials(leagueFinancials, 1)
  const teamFinancials = initializeTeamFinancials(
    league.seasonState.teams,
    rng,
    seasonFinancials,
  )
  const { contracts } = generateInitialContractsForLeague(
    league.seasonState.teams,
    1,
    seasonFinancials,
    rng,
  )

  const teams = league.seasonState.teams.map((team) => {
    const players = applyInitialContractsToPlayers([team], contracts)
    return { ...team, players }
  })

  return {
    ...league,
    contracts,
    leagueFinancials,
    teamFinancials,
    spendingProfileEvents: [],
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
  teamId: string,
): LeagueRecord {
  const player = league.seasonState.teams
    .flatMap((team) => team.players)
    .find((entry) => entry.id === playerId)

  if (!player) {
    return league
  }

  return attachRookieContract(league, player, pickNumber, round, teamId)
}
