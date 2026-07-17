import {
  BASE_SALARY_CAP,
  LUXURY_TAX_RATIO,
  LUXURY_TAX_RATES,
  MIN_SALARY_TIER1_RATIO,
  MIN_SALARY_TIER2_RATIO,
  MIN_SALARY_TIER3_RATIO,
  MIN_TEAM_SALARY_RATIO,
  MLE_NON_TAXPAYER_RATIO,
  MLE_ROOM_RATIO,
  MLE_TAXPAYER_RATIO,
  ROOKIE_SCALE_BOTTOM_RATIO,
  ROOKIE_SCALE_TOP_RATIO,
  TAX_BRACKET_RATIO,
} from "@workspace/shared/financialConstants"
import type { SeasonFinancials } from "@workspace/shared/financialTypes"

export function roundMoney(value: number): number {
  return Math.round(value * 10) / 10
}

export function calculateSeasonFinancials(
  baseCap: number,
  growthRate: number,
  season: number,
): SeasonFinancials {
  const salaryCap = roundMoney(baseCap * (1 + growthRate) ** (season - 1))
  const multiplier = salaryCap / baseCap

  const minimumTeamSalary = roundMoney(
    baseCap * MIN_TEAM_SALARY_RATIO * multiplier,
  )
  const luxuryTaxLine = roundMoney(baseCap * LUXURY_TAX_RATIO * multiplier)
  const taxBracketSize = roundMoney(baseCap * TAX_BRACKET_RATIO * multiplier)
  const averageSalary = roundMoney(salaryCap / 15)

  const rookieScale = Array.from({ length: 30 }, (_, index) => {
    const progress = index / 29
    const ratio =
      ROOKIE_SCALE_TOP_RATIO -
      progress * (ROOKIE_SCALE_TOP_RATIO - ROOKIE_SCALE_BOTTOM_RATIO)
    return roundMoney(salaryCap * ratio)
  })

  return {
    season,
    salaryCap,
    minimumTeamSalary,
    luxuryTaxLine,
    taxBracketSize,
    averageSalary,
    mleNonTaxpayer: roundMoney(baseCap * MLE_NON_TAXPAYER_RATIO * multiplier),
    mleTaxpayer: roundMoney(baseCap * MLE_TAXPAYER_RATIO * multiplier),
    mleRoom: roundMoney(baseCap * MLE_ROOM_RATIO * multiplier),
    minimumSalaries: {
      tier1: roundMoney(baseCap * MIN_SALARY_TIER1_RATIO * multiplier),
      tier2: roundMoney(baseCap * MIN_SALARY_TIER2_RATIO * multiplier),
      tier3: roundMoney(baseCap * MIN_SALARY_TIER3_RATIO * multiplier),
    },
    rookieScale,
  }
}

export function buildLeagueFinancials(
  baseCap: number,
  growthRate: number,
  maxSeason: number,
): { baseCap: number; growthRate: number; currentCapSeason: number; bySeason: Record<number, SeasonFinancials> } {
  const bySeason: Record<number, SeasonFinancials> = {}

  for (let season = 1; season <= maxSeason; season++) {
    bySeason[season] = calculateSeasonFinancials(baseCap, growthRate, season)
  }

  return { baseCap, growthRate, currentCapSeason: 1, bySeason }
}

export function getSeasonFinancials(
  leagueFinancials: { bySeason: Record<number, SeasonFinancials> },
  season: number,
): SeasonFinancials {
  const existing = leagueFinancials.bySeason[season]
  if (existing) {
    return existing
  }

  throw new Error(`Season financials not found for season ${season}`)
}

export function ensureSeasonFinancials(
  leagueFinancials: { baseCap: number; growthRate: number; currentCapSeason: number; bySeason: Record<number, SeasonFinancials> },
  season: number,
): { baseCap: number; growthRate: number; currentCapSeason: number; bySeason: Record<number, SeasonFinancials> } {
  if (leagueFinancials.bySeason[season]) {
    return leagueFinancials
  }

  return {
    ...leagueFinancials,
    bySeason: {
      ...leagueFinancials.bySeason,
      [season]: calculateSeasonFinancials(
        leagueFinancials.baseCap,
        leagueFinancials.growthRate,
        season,
      ),
    },
  }
}

export function calculateMaxSalary(
  salaryCap: number,
  yearsOfService: number,
  priorSalary?: number,
): number {
  let tierPct = 0.25
  if (yearsOfService >= 10) {
    tierPct = 0.35
  } else if (yearsOfService >= 7) {
    tierPct = 0.3
  }

  const tierMax = roundMoney(salaryCap * tierPct)
  if (priorSalary !== undefined) {
    return roundMoney(Math.max(tierMax, priorSalary * 1.05))
  }

  return tierMax
}

export function calculateMinSalary(
  seasonFinancials: SeasonFinancials,
  yearsOfService: number,
): number {
  if (yearsOfService >= 10) {
    return seasonFinancials.minimumSalaries.tier3
  }
  if (yearsOfService >= 3) {
    return seasonFinancials.minimumSalaries.tier2
  }
  return seasonFinancials.minimumSalaries.tier1
}

export function getCapSpace(payroll: number, salaryCap: number): number {
  return roundMoney(salaryCap - payroll)
}

export function calculateLuxuryTax(
  payroll: number,
  taxLine: number,
  bracketSize: number,
  isRepeater = false,
): number {
  const overage = Math.max(0, payroll - taxLine)
  if (overage <= 0) {
    return 0
  }

  let remaining = overage
  let totalTax = 0
  let bracketIndex = 0

  while (remaining > 0) {
    const slice = Math.min(remaining, bracketSize)
    const baseRate = LUXURY_TAX_RATES[Math.min(bracketIndex, LUXURY_TAX_RATES.length - 1)]!
    const extraBrackets = Math.max(0, bracketIndex - (LUXURY_TAX_RATES.length - 1))
    const repeaterSurcharge = isRepeater ? 1 : 0
    const rate = baseRate + extraBrackets * 0.5 + repeaterSurcharge
    totalTax += slice * rate
    remaining -= slice
    bracketIndex += 1
  }

  return roundMoney(totalTax)
}

export { BASE_SALARY_CAP }
