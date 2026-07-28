import {
  DEFAULT_COACHING_LEVEL,
  DEFAULT_DEVELOPMENT_LEVEL,
  DEFAULT_SCOUTING_LEVEL,
} from "@workspace/shared/constants"
import {
  BASE_SALARY_CAP,
  CAP_GROWTH_MAX,
  CAP_GROWTH_MIN,
  MARKET_BASE_REVENUE,
  MARKET_TIER_WEIGHTS,
  STARTING_CASH_RESERVES,
  TAX_TOLERANCE_WEIGHTS,
  TOLERANCE_BY_MARKET,
} from "@workspace/shared/financialConstants"
import type {
  MarketTier,
  SeasonFinancials,
  TaxTolerance,
  TeamFinancials,
  TeamSpendingProfile,
} from "@workspace/shared/financialTypes"
import type { Rng, TeamWithRoster } from "@workspace/shared/types"

import { buildLeagueFinancials } from "./capMath"
import { createDefaultStrategy } from "./teamStrategy"

function weightedPick<T extends string>(
  weights: Record<T, number>,
  rng: Rng,
): T {
  const entries = Object.entries(weights) as [T, number][]
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rng.next() * total

  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) {
      return key
    }
  }

  return entries[entries.length - 1]![0]
}

function assignMarketTier(teamIndex: number, rng: Rng): MarketTier {
  const tiers = Object.entries(MARKET_TIER_WEIGHTS) as [MarketTier, number][]
  const biasedIndex = (teamIndex + rng.int(0, tiers.length - 1)) % tiers.length
  return tiers[biasedIndex]![0]
}

function assignTaxTolerance(marketTier: MarketTier, rng: Rng): TaxTolerance {
  const weights = { ...TAX_TOLERANCE_WEIGHTS }
  const marketBias = TOLERANCE_BY_MARKET[marketTier]

  for (const [tolerance, multiplier] of Object.entries(marketBias ?? {})) {
    const key = tolerance as TaxTolerance
    weights[key] = Math.round(weights[key]! * (multiplier ?? 1))
  }

  return weightedPick(weights, rng)
}

export function createSpendingProfile(
  teamIndex: number,
  rng: Rng,
): TeamSpendingProfile {
  const marketTier = assignMarketTier(teamIndex, rng)
  const taxTolerance = assignTaxTolerance(marketTier, rng)

  return {
    marketTier,
    taxTolerance,
    baseTaxTolerance: taxTolerance,
  }
}

export function initializeTeamFinancials(
  teams: TeamWithRoster[],
  rng: Rng,
  seasonFinancials: SeasonFinancials,
): TeamFinancials[] {
  return teams.map((team, index) => {
    const spendingProfile = createSpendingProfile(index, rng)

    return {
      teamId: team.id,
      spendingProfile,
      strategy: createDefaultStrategy(seasonFinancials.season, "buying"),
      scoutingLevel: DEFAULT_SCOUTING_LEVEL,
      coachingLevel: DEFAULT_COACHING_LEVEL,
      developmentLevel: DEFAULT_DEVELOPMENT_LEVEL,
      staffBudget: 6,
      staffPayroll: 0,
      cashReserves: STARTING_CASH_RESERVES,
      debt: 0,
      consecutiveTaxSeasons: 0,
      lastTaxBill: null,
      mleUsed: 0,
      mleType: "non_taxpayer",
      mleRemaining: seasonFinancials.mleNonTaxpayer,
      roomMleUsed: 0,
      roomMleRemaining: seasonFinancials.mleRoom,
      wasUnderCapThisYear: true,
      tradeExceptions: [],
      deadCapCharges: [],
      capHolds: [],
    }
  })
}

export function initializeLeagueFinancials(rng: Rng, maxSeason = 30) {
  const growthRate =
    CAP_GROWTH_MIN + rng.next() * (CAP_GROWTH_MAX - CAP_GROWTH_MIN)

  return buildLeagueFinancials(BASE_SALARY_CAP, growthRate, maxSeason)
}

export function calculateSeasonRevenue(
  teamFinancials: TeamFinancials,
  wins: number,
  madePlayoffs: boolean,
): number {
  const base = MARKET_BASE_REVENUE[teamFinancials.spendingProfile.marketTier]
  const winBonus = wins * 0.15
  const playoffBonus = madePlayoffs ? 3 : 0
  return Math.round((base + winBonus + playoffBonus) * 10) / 10
}
