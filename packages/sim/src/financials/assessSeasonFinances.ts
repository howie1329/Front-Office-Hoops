import type { Contract } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, SeasonState } from "@workspace/shared/types"

import {
  calculateLuxuryTax,
  ensureSeasonFinancials,
  getSeasonFinancials,
  roundMoney,
} from "./capMath"
import { advanceDeadCapCharges } from "./deadCap"
import { getTeamPayroll } from "./payroll"
import { calculateSeasonRevenue } from "./spendingProfiles"
import { REPEATER_TAX_SEASONS } from "@workspace/shared/financialConstants"

function getTeamWins(teamId: string, seasonState: SeasonState): number {
  const standing = seasonState.standings.find(
    (entry) => entry.teamId === teamId && entry.season === seasonState.season,
  )
  return standing?.wins ?? 0
}

function teamMadePlayoffs(teamId: string, seasonState: SeasonState): boolean {
  return (
    seasonState.playoffBracket?.series.some(
      (series) =>
        series.higherSeedTeamId === teamId || series.lowerSeedTeamId === teamId,
    ) ?? false
  )
}

export function assessLeagueSeasonFinances(
  league: LeagueRecord,
  seasonState: SeasonState,
): LeagueRecord {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    seasonState.season,
  )

  const teamFinancials = league.teamFinancials.map((teamFinance) => {
    const payroll = roundMoney(
      getTeamPayroll(teamFinance.teamId, league.contracts, teamFinance),
    )
    const isRepeater = teamFinance.consecutiveTaxSeasons >= REPEATER_TAX_SEASONS
    const taxBill = calculateLuxuryTax(
      payroll,
      seasonFinancials.luxuryTaxLine,
      seasonFinancials.taxBracketSize,
      isRepeater,
    )
    const wins = getTeamWins(teamFinance.teamId, seasonState)
    const madePlayoffs = teamMadePlayoffs(teamFinance.teamId, seasonState)
    const revenue = calculateSeasonRevenue(teamFinance, wins, madePlayoffs)
    const netCash = roundMoney(revenue - payroll - taxBill)

    let cashReserves = roundMoney(teamFinance.cashReserves + netCash)
    let debt = teamFinance.debt

    if (cashReserves < 0) {
      debt = roundMoney(debt + Math.abs(cashReserves))
      cashReserves = 0
    }

    const isTaxTeam = taxBill > 0

    return {
      ...teamFinance,
      cashReserves,
      debt,
      lastTaxBill: taxBill > 0 ? taxBill : null,
      consecutiveTaxSeasons: isTaxTeam
        ? teamFinance.consecutiveTaxSeasons + 1
        : 0,
      wasUnderCapThisYear: payroll <= seasonFinancials.salaryCap,
    }
  })

  return {
    ...league,
    teamFinancials,
  }
}

export function applyMinimumSalaryFloorPenalty(
  league: LeagueRecord,
  season: number,
): LeagueRecord {
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)

  const teamFinancials = league.teamFinancials.map((teamFinance) => {
    const payroll = getTeamPayroll(teamFinance.teamId, league.contracts)
    if (payroll >= seasonFinancials.minimumTeamSalary) {
      return teamFinance
    }

    const shortfall = roundMoney(seasonFinancials.minimumTeamSalary - payroll)
    let cashReserves = roundMoney(teamFinance.cashReserves - shortfall)
    let debt = teamFinance.debt

    if (cashReserves < 0) {
      debt = roundMoney(debt + Math.abs(cashReserves))
      cashReserves = 0
    }

    return {
      ...teamFinance,
      cashReserves,
      debt,
    }
  })

  return { ...league, teamFinancials }
}

export function rollFinancialYear(
  league: LeagueRecord,
  newSeason: number,
): LeagueRecord {
  const leagueFinancials = ensureSeasonFinancials(league.leagueFinancials, newSeason)
  const seasonFinancials = getSeasonFinancials(leagueFinancials, newSeason)

  const teamFinancials = league.teamFinancials.map((teamFinance) => ({
    ...teamFinance,
    mleUsed: 0,
    mleRemaining: seasonFinancials.mleNonTaxpayer,
    roomMleUsed: 0,
    roomMleRemaining: seasonFinancials.mleRoom,
    wasUnderCapThisYear: true,
    deadCapCharges: advanceDeadCapCharges(teamFinance.deadCapCharges),
    tradeExceptions: teamFinance.tradeExceptions.filter(
      (tpe) => tpe.expiresSeason >= newSeason,
    ),
  }))

  return {
    ...league,
    leagueFinancials,
    teamFinancials,
  }
}

export function advanceContractYears(
  contracts: Contract[],
  newSeason: number,
): {
  contracts: Contract[]
  expiredPlayerIds: string[]
} {
  const expiredPlayerIds: string[] = []
  const nextContracts = contracts.map((contract) => {
    if (contract.status !== "active") {
      return contract
    }
    if (contract.signedSeason >= newSeason) {
      return contract
    }

    const remaining = contract.yearlySalaries.slice(1)
    if (remaining.length === 0) {
      expiredPlayerIds.push(contract.playerId)
      return { ...contract, status: "expired" as const, yearlySalaries: [] }
    }

    return {
      ...contract,
      yearlySalaries: remaining,
      options: contract.options
        ?.map((option) => ({ ...option, yearIndex: option.yearIndex - 1 }))
        .filter((option) => option.yearIndex >= 0),
    }
  })

  return { contracts: nextContracts, expiredPlayerIds }
}

export function syncPlayersAfterContractChanges(
  teams: SeasonState["teams"],
  freeAgentPool: Player[],
  contracts: Contract[],
  expiredPlayerIds: string[],
): { teams: SeasonState["teams"]; freeAgentPool: Player[] } {
  const expiredSet = new Set(expiredPlayerIds)
  const newFreeAgents: Player[] = []

  const teamsWithUpdates = teams.map((team) => ({
    ...team,
    players: team.players
      .filter((player) => !expiredSet.has(player.id))
      .map((player) => {
        const contract = contracts.find(
          (entry) => entry.playerId === player.id && entry.status === "active",
        )
        return {
          ...player,
          activeContractId: contract?.id ?? null,
          yearsOfService: player.yearsOfService + 1,
          seasonsWithTeam: player.seasonsWithTeam + 1,
        }
      }),
  }))

  for (const team of teams) {
    for (const player of team.players) {
      if (expiredSet.has(player.id)) {
        newFreeAgents.push({
          ...player,
          teamId: null,
          status: "free_agent",
          activeContractId: null,
          seasonsWithTeam: 0,
        })
      }
    }
  }

  return {
    teams: teamsWithUpdates,
    freeAgentPool: [...freeAgentPool, ...newFreeAgents],
  }
}
