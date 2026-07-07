import {
  MODE_OFFER_MULTIPLIER,
  MODE_YEARS_RANGE,
  RE_SIGN_MAX_AGE_SELLING,
  RE_SIGN_OVR_CONTENDING,
  RE_SIGN_TOP_N_BUYING,
  TOLERANCE_CASH_FLOOR,
  TOLERANCE_OFFER_MULTIPLIER,
} from "@workspace/shared/financialConstants"
import type { FreeAgentOffer } from "@workspace/shared/contractTypes"
import type {
  SeasonFinancials,
  TaxTolerance,
  TeamFinancials,
  TeamMode,
} from "@workspace/shared/financialTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"

import {
  calculateMaxSalary,
  calculateMinSalary,
  roundMoney,
} from "../capMath"
import { getFairSalary } from "../../playerValue"
import { deriveBirdRights, calculateBirdSignCeiling, getBirdMaxYears } from "../birdRights"
import { getPlayerContract } from "../payroll"

export function buildFairSalary(
  player: Player,
  seasonFinancials: SeasonFinancials,
  league?: LeagueRecord,
): number {
  return getFairSalary(player, seasonFinancials, league)
}

export function getToleranceMultiplier(tolerance: TaxTolerance): number {
  return TOLERANCE_OFFER_MULTIPLIER[tolerance]
}

export function getModeMultiplier(mode: TeamMode, rng: Rng): number {
  const range = MODE_OFFER_MULTIPLIER[mode]
  return range.min + rng.next() * (range.max - range.min)
}

export function canAffordOffer(
  teamFinance: TeamFinancials,
  payroll: number,
  offerSalary: number,
  seasonFinancials: SeasonFinancials,
): boolean {
  const projectedTax =
    payroll + offerSalary > seasonFinancials.luxuryTaxLine
      ? payroll + offerSalary - seasonFinancials.luxuryTaxLine
      : 0
  const projectedCash =
    teamFinance.cashReserves - offerSalary - projectedTax * 0.5
  const floor = TOLERANCE_CASH_FLOOR[teamFinance.spendingProfile.taxTolerance]
  return projectedCash >= floor
}

export function buildExternalFaOffer(
  player: Player,
  teamFinance: TeamFinancials,
  seasonFinancials: SeasonFinancials,
  rng: Rng,
): FreeAgentOffer {
  const mode = teamFinance.strategy.mode
  const tolerance = teamFinance.spendingProfile.taxTolerance
  const fairSalary = buildFairSalary(player, seasonFinancials)
  const minSalary = calculateMinSalary(seasonFinancials, player.yearsOfService)
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    player.yearsOfService,
  )

  let salary = roundMoney(
    fairSalary * getModeMultiplier(mode, rng) * getToleranceMultiplier(tolerance),
  )
  salary = Math.max(minSalary, Math.min(maxSalary, salary))

  const [minYears, maxYears] = MODE_YEARS_RANGE[mode]
  const years = rng.int(minYears, maxYears)

  return { years, firstYearSalary: salary }
}

export function shouldReSignPlayer(
  player: Player,
  teamPlayers: Player[],
  teamFinance: TeamFinancials,
  fairSalary: number,
  _seasonFinancials: { salaryCap: number },
  priorSalary: number,
): boolean {
  const mode = teamFinance.strategy.mode
  const sorted = [...teamPlayers].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )
  const rank = sorted.findIndex((entry) => entry.id === player.id)

  switch (mode) {
    case "selling":
      return (
        player.age <= RE_SIGN_MAX_AGE_SELLING &&
        priorSalary <= fairSalary * 0.95
      )
    case "buying":
      return rank >= 0 && rank < RE_SIGN_TOP_N_BUYING
    case "contending":
      return player.ratings.overall >= RE_SIGN_OVR_CONTENDING
  }
}

export function buildReSignOffer(
  player: Player,
  teamFinance: TeamFinancials,
  seasonFinancials: SeasonFinancials,
  priorSalary: number,
  rng: Rng,
): FreeAgentOffer {
  const birdRights = deriveBirdRights(player.seasonsWithTeam)
  const ceiling = calculateBirdSignCeiling(
    birdRights,
    seasonFinancials,
    player.yearsOfService,
    priorSalary,
    seasonFinancials.salaryCap,
  )
  const fairSalary = buildFairSalary(player, seasonFinancials)
  const mode = teamFinance.strategy.mode
  const tolerance = teamFinance.spendingProfile.taxTolerance

  let salary = roundMoney(
    Math.min(
      ceiling,
      fairSalary * getModeMultiplier(mode, rng) * getToleranceMultiplier(tolerance),
    ),
  )
  const minSalary = calculateMinSalary(seasonFinancials, player.yearsOfService)
  salary = Math.max(minSalary, salary)

  const maxYears = getBirdMaxYears(birdRights)
  const [minYears] = MODE_YEARS_RANGE[mode]
  const years = Math.min(maxYears, Math.max(minYears, rng.int(minYears, maxYears)))

  return { years, firstYearSalary: salary }
}

export function getPriorContractSalary(
  contracts: Parameters<typeof getPlayerContract>[0],
  player: Player,
): number {
  return getPlayerContract(contracts, player)?.yearlySalaries[0] ?? 0
}
