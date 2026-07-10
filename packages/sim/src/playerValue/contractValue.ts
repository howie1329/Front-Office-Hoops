import type { Contract } from "@workspace/shared/contractTypes"
import type { SeasonFinancials, TeamFinancials } from "@workspace/shared/financialTypes"
import type { Player } from "@workspace/shared/types"

import { calculateLuxuryTax, calculateSeasonFinancials } from "../financials/capMath"
import { estimateSalaryFromValue } from "../financials/contracts/createContract"
import type { ProjectedPlayerValueBreakdown } from "./projectedValue"

/** One million dollars of discounted surplus is worth 0.55 trade-value points. */
const SALARY_TO_TRADE_VALUE = 0.55
const FUTURE_YEAR_DISCOUNT = 0.84
const TAX_TOLERANCE_MULTIPLIER = {
  tax_averse: 1,
  prudent: 0.7,
  competitive: 0.4,
  all_in: 0.15,
} as const

export type ContractValueBreakdown = {
  annual: Array<{
    seasonOffset: number
    salary: number
    expectedContribution: number
    discountedNet: number
  }>
  optionValue: number
  taxImpact: number
  total: number
}

export type ContractValueInput = {
  player: Player
  contract: Contract | undefined
  seasonFinancials: SeasonFinancials
  leagueFinancials: { baseCap: number; growthRate: number; bySeason: Record<number, SeasonFinancials> }
  receivingTeamFinancials?: TeamFinancials
  receivingTeamPayroll: number
  projectedPlayerValue: ProjectedPlayerValueBreakdown
}

function financialsForOffset(input: ContractValueInput, offset: number): SeasonFinancials {
  const season = input.seasonFinancials.season + offset
  return input.leagueFinancials.bySeason[season] ?? calculateSeasonFinancials(
    input.leagueFinancials.baseCap,
    input.leagueFinancials.growthRate,
    season,
  )
}

function projectedValueForOffset(
  breakdown: ProjectedPlayerValueBreakdown,
  offset: number,
): number {
  return breakdown.projectedSeasons[Math.min(offset, breakdown.projectedSeasons.length - 1)]?.projectedOverall
    ?? breakdown.total
}

export function getContractValueBreakdown(input: ContractValueInput): ContractValueBreakdown {
  const salaries = input.contract?.yearlySalaries ?? []
  if (salaries.length === 0) {
    return { annual: [], optionValue: 0, taxImpact: 0, total: 0 }
  }

  const annual = salaries.map((salary, seasonOffset) => {
    const financials = financialsForOffset(input, seasonOffset)
    const expectedContribution = estimateSalaryFromValue(
      projectedValueForOffset(input.projectedPlayerValue, seasonOffset),
      input.player.yearsOfService + seasonOffset,
      financials,
    )
    const discountedNet = (expectedContribution - salary) * SALARY_TO_TRADE_VALUE * FUTURE_YEAR_DISCOUNT ** seasonOffset
    return { seasonOffset, salary, expectedContribution, discountedNet }
  })
  const incomingSalary = salaries[0] ?? 0
  const taxMultiplier = input.receivingTeamFinancials
    ? TAX_TOLERANCE_MULTIPLIER[input.receivingTeamFinancials.spendingProfile.taxTolerance]
    : 0
  const beforeTax = calculateLuxuryTax(
    input.receivingTeamPayroll,
    input.seasonFinancials.luxuryTaxLine,
    input.seasonFinancials.taxBracketSize,
    Boolean(input.receivingTeamFinancials?.consecutiveTaxSeasons && input.receivingTeamFinancials.consecutiveTaxSeasons >= 3),
  )
  const afterTax = calculateLuxuryTax(
    input.receivingTeamPayroll + incomingSalary,
    input.seasonFinancials.luxuryTaxLine,
    input.seasonFinancials.taxBracketSize,
    Boolean(input.receivingTeamFinancials?.consecutiveTaxSeasons && input.receivingTeamFinancials.consecutiveTaxSeasons >= 3),
  )
  const taxImpact = -(afterTax - beforeTax) * SALARY_TO_TRADE_VALUE * taxMultiplier
  // Persisted options state whether the choice belongs to the team or player, not its future decision.
  // A small team-option premium is safe; player options are neutral until player intent exists.
  const optionValue = input.contract?.options?.some((option) => option.type === "team" && option.yearIndex < salaries.length)
    ? 0.75
    : 0
  const total = annual.reduce((sum, year) => sum + year.discountedNet, 0) + taxImpact + optionValue

  return { annual, optionValue, taxImpact, total }
}
