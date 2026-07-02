import type { MarketTier, TaxTolerance, TeamMode } from "./financialTypes"

export const BASE_SALARY_CAP = 141

export const MIN_TEAM_SALARY_RATIO = 0.9
export const LUXURY_TAX_RATIO = 1.215
export const TAX_BRACKET_RATIO = 0.037
export const MLE_NON_TAXPAYER_RATIO = 0.091
export const MLE_TAXPAYER_RATIO = 0.037
export const MLE_ROOM_RATIO = 0.057

export const CAP_GROWTH_MIN = 0.03
export const CAP_GROWTH_MAX = 0.08

export const MIN_SALARY_TIER1_RATIO = 0.008
export const MIN_SALARY_TIER2_RATIO = 0.014
export const MIN_SALARY_TIER3_RATIO = 0.023

export const ROOKIE_SCALE_TOP_RATIO = 0.08
export const ROOKIE_SCALE_BOTTOM_RATIO = 0.015

export const STARTING_CASH_RESERVES = 20
export const DEBT_Austerity_THRESHOLD = 30

export const MAX_YEARS_OUTSIDE_FA = 4
export const MAX_YEARS_BIRD = 5
export const RAISE_PCT_STANDARD = 0.05
export const RAISE_PCT_BIRD = 0.08

export const TOLERANCE_CASH_FLOOR: Record<TaxTolerance, number> = {
  tax_averse: 5,
  prudent: 0,
  competitive: -10,
  all_in: -25,
}

export const MARKET_BASE_REVENUE: Record<MarketTier, number> = {
  large: 45,
  mid: 35,
  small: 28,
}

export const MARKET_TIER_WEIGHTS: Record<MarketTier, number> = {
  large: 6,
  mid: 14,
  small: 10,
}

export const TAX_TOLERANCE_WEIGHTS: Record<TaxTolerance, number> = {
  tax_averse: 20,
  prudent: 35,
  competitive: 30,
  all_in: 15,
}

export const TOLERANCE_BY_MARKET: Record<
  MarketTier,
  Partial<Record<TaxTolerance, number>>
> = {
  large: { competitive: 1.4, all_in: 1.6, tax_averse: 0.5 },
  mid: { prudent: 1.2, competitive: 1.1 },
  small: { tax_averse: 1.5, prudent: 1.3, all_in: 0.4 },
}

export const LUXURY_TAX_RATES = [1.5, 1.75, 2.5, 3.25] as const

export const MODE_PAYROLL_OVER_TAX_SELLING = 5
export const MODE_CAP_SPACE_BUYING = 7
export const MODE_CONTENDING_OVR = 78
export const MODE_SELLING_OVR = 72
export const MODE_HYSTERESIS_SEASONS = 2
export const MODE_DEBT_FORCE_SELLING = 30
export const MODE_PAYROLL_FORCE_SELLING = 20

export const RE_SIGN_OVR_CONTENDING = 75
export const RE_SIGN_TOP_N_BUYING = 3
export const RE_SIGN_MAX_AGE_SELLING = 25

export const MODE_OFFER_MULTIPLIER: Record<TeamMode, { min: number; max: number }> = {
  selling: { min: 0.85, max: 1.0 },
  buying: { min: 1.0, max: 1.15 },
  contending: { min: 0.95, max: 1.1 },
}

export const MODE_YEARS_RANGE: Record<TeamMode, [number, number]> = {
  selling: [1, 2],
  buying: [2, 3],
  contending: [2, 4],
}

export const TOLERANCE_OFFER_MULTIPLIER: Record<TaxTolerance, number> = {
  tax_averse: 0.92,
  prudent: 1.0,
  competitive: 1.08,
  all_in: 1.15,
}
