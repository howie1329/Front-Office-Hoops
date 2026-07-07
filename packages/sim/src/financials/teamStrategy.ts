import {
  MODE_CAP_SPACE_BUYING,
  MODE_CONTENDING_OVR,
  MODE_DEBT_FORCE_SELLING,
  MODE_HYSTERESIS_SEASONS,
  MODE_PAYROLL_FORCE_SELLING,
  MODE_PAYROLL_OVER_TAX_SELLING,
  MODE_SELLING_OVR,
} from "@workspace/shared/financialConstants"
import type {
  SeasonFinancials,
  TeamFinancials,
  TeamMode,
  TeamStrategy,
} from "@workspace/shared/financialTypes"
import type { Contract, LeagueRecord, TeamWithRoster } from "@workspace/shared/types"

import { getCapSpace, roundMoney } from "./capMath"
import { getTeamPayroll } from "./payroll"

export type TeamSignals = {
  teamId: string
  avgAge: number
  payroll: number
  capSpace: number
  teamOvr: number
  wins: number
  madePlayoffs: boolean
  isTopFourSeed: boolean
}

export function createDefaultStrategy(season: number, mode: TeamMode): TeamStrategy {
  return {
    mode,
    modeSetSeason: season,
    source: "initial",
    pendingMode: null,
    pendingSeasons: 0,
  }
}

export function deriveTeamSignals(
  team: TeamWithRoster,
  contracts: Contract[],
  seasonFinancials: SeasonFinancials,
  league?: Pick<LeagueRecord, "seasonState">,
): TeamSignals {
  const payroll = roundMoney(getTeamPayroll(team.id, contracts))
  const capSpace = getCapSpace(payroll, seasonFinancials.salaryCap)
  const avgAge =
    team.players.length === 0
      ? 25
      : team.players.reduce((sum, player) => sum + player.age, 0) /
        team.players.length

  const season = league?.seasonState.season ?? seasonFinancials.season
  const standing = league?.seasonState.standings.find(
    (entry) => entry.teamId === team.id && entry.season === season,
  )
  const wins = standing?.wins ?? 0
  const madePlayoffs =
    league?.seasonState.playoffBracket?.series.some(
      (series) =>
        series.higherSeedTeamId === team.id || series.lowerSeedTeamId === team.id,
    ) ?? false

  const sorted = [...(league?.seasonState.standings ?? [])]
    .filter((entry) => entry.season === season)
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor - (a.pointsAgainst - b.pointsAgainst))
  const rank = sorted.findIndex((entry) => entry.teamId === team.id)
  const isTopFourSeed = rank >= 0 && rank < 4

  return {
    teamId: team.id,
    avgAge: roundMoney(avgAge),
    payroll,
    capSpace,
    teamOvr: team.overall,
    wins,
    madePlayoffs,
    isTopFourSeed,
  }
}

export function proposeTeamMode(
  signals: TeamSignals,
  teamFinance: TeamFinancials,
  seasonFinancials: SeasonFinancials,
): TeamMode {
  if (teamFinance.debt >= MODE_DEBT_FORCE_SELLING) {
    return "selling"
  }

  if (
    signals.payroll >
    seasonFinancials.luxuryTaxLine + MODE_PAYROLL_FORCE_SELLING
  ) {
    return "selling"
  }

  if (
    signals.payroll > seasonFinancials.luxuryTaxLine + MODE_PAYROLL_OVER_TAX_SELLING &&
    signals.avgAge >= 28 &&
    !signals.madePlayoffs
  ) {
    return "selling"
  }

  if (
    signals.madePlayoffs &&
    signals.isTopFourSeed &&
    signals.teamOvr >= MODE_CONTENDING_OVR - 2 &&
    signals.avgAge <= 29
  ) {
    return "contending"
  }

  if (
    signals.capSpace >= MODE_CAP_SPACE_BUYING &&
    signals.teamOvr >= MODE_CONTENDING_OVR - 4
  ) {
    return "buying"
  }

  if (signals.teamOvr < MODE_SELLING_OVR) {
    return "selling"
  }

  if (
    signals.teamOvr >= MODE_CONTENDING_OVR &&
    signals.avgAge <= 27
  ) {
    return "contending"
  }

  return teamFinance.strategy.mode
}

function applyHysteresis(
  current: TeamStrategy,
  candidate: TeamMode,
  season: number,
  force: boolean,
): TeamStrategy {
  if (current.mode === candidate) {
    return {
      ...current,
      pendingMode: null,
      pendingSeasons: 0,
    }
  }

  if (force) {
    return {
      mode: candidate,
      modeSetSeason: season,
      source: "financial_distress",
      pendingMode: null,
      pendingSeasons: 0,
    }
  }

  if (current.pendingMode === candidate) {
    const nextPendingSeasons = current.pendingSeasons + 1
    if (nextPendingSeasons >= MODE_HYSTERESIS_SEASONS) {
      return {
        mode: candidate,
        modeSetSeason: season,
        source: "auto",
        pendingMode: null,
        pendingSeasons: 0,
      }
    }
    return {
      ...current,
      pendingSeasons: nextPendingSeasons,
    }
  }

  return {
    ...current,
    pendingMode: candidate,
    pendingSeasons: 1,
  }
}

export function updateTeamStrategy(
  teamFinance: TeamFinancials,
  signals: TeamSignals,
  seasonFinancials: SeasonFinancials,
  season: number,
): TeamFinancials {
  const candidate = proposeTeamMode(signals, teamFinance, seasonFinancials)
  const force =
    teamFinance.debt >= MODE_DEBT_FORCE_SELLING ||
    signals.payroll >
      seasonFinancials.luxuryTaxLine + MODE_PAYROLL_FORCE_SELLING

  return {
    ...teamFinance,
    strategy: applyHysteresis(teamFinance.strategy, candidate, season, force),
  }
}

export function assignInitialTeamStrategy(
  team: TeamWithRoster,
  contracts: Contract[],
  seasonFinancials: SeasonFinancials,
  season: number,
): TeamStrategy {
  const signals = deriveTeamSignals(team, contracts, seasonFinancials)

  const mockFinance: TeamFinancials = {
    teamId: team.id,
    spendingProfile: {
      marketTier: "mid",
      taxTolerance: "prudent",
      baseTaxTolerance: "prudent",
    },
    strategy: createDefaultStrategy(season, "buying"),
    cashReserves: 0,
    debt: 0,
    consecutiveTaxSeasons: 0,
    lastTaxBill: null,
    mleUsed: 0,
    mleRemaining: seasonFinancials.mleNonTaxpayer,
    roomMleUsed: 0,
    roomMleRemaining: seasonFinancials.mleRoom,
    wasUnderCapThisYear: true,
    scoutingLevel: 5,
    coachingLevel: 5,
    developmentLevel: 5,
    staffBudget: 6,
    staffPayroll: 0,
    tradeExceptions: [],
    deadCapCharges: [],
  }

  const mode = proposeTeamMode(signals, mockFinance, seasonFinancials)
  return createDefaultStrategy(season, mode)
}

export function updateAllTeamStrategies(league: LeagueRecord): LeagueRecord {
  const season = league.seasonState.season
  const seasonFinancials = league.leagueFinancials.bySeason[season]
  if (!seasonFinancials) {
    return league
  }

  const teamFinancials = league.teamFinancials.map((teamFinance) => {
    const team = league.seasonState.teams.find(
      (entry) => entry.id === teamFinance.teamId,
    )
    if (!team) {
      return teamFinance
    }

    const signals = deriveTeamSignals(
      team,
      league.contracts,
      seasonFinancials,
      league,
    )
    return updateTeamStrategy(teamFinance, signals, seasonFinancials, season)
  })

  return { ...league, teamFinancials }
}

export function ensureTeamStrategy(
  teamFinance: TeamFinancials,
  season: number,
): TeamFinancials {
  if (teamFinance.strategy) {
    return teamFinance
  }

  return {
    ...teamFinance,
    strategy: createDefaultStrategy(season, "buying"),
  }
}
