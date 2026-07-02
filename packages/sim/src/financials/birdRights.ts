import type { BirdRightsType } from "@workspace/shared/financialTypes"
import type { SeasonFinancials } from "@workspace/shared/financialTypes"

import { roundMoney } from "./capMath"

export function deriveBirdRights(seasonsWithTeam: number): BirdRightsType {
  if (seasonsWithTeam >= 3) {
    return "bird"
  }
  if (seasonsWithTeam === 2) {
    return "early_bird"
  }
  if (seasonsWithTeam === 1) {
    return "non_bird"
  }
  return "none"
}

export function calculateBirdSignCeiling(
  birdRights: BirdRightsType,
  seasonFinancials: SeasonFinancials,
  yearsOfService: number,
  priorSalary: number,
  salaryCap: number,
): number {
  switch (birdRights) {
    case "bird":
      return roundMoney(salaryCap * (yearsOfService >= 10 ? 0.35 : yearsOfService >= 7 ? 0.3 : 0.25))
    case "early_bird":
      return roundMoney(
        Math.max(priorSalary * 1.75, seasonFinancials.averageSalary * 1.05),
      )
    case "non_bird":
      return roundMoney(priorSalary * 1.2)
    default:
      return 0
  }
}

export function getBirdMinYears(birdRights: BirdRightsType): number {
  switch (birdRights) {
    case "bird":
      return 1
    case "early_bird":
      return 2
    case "non_bird":
      return 1
    default:
      return 1
  }
}

export function getBirdMaxYears(birdRights: BirdRightsType): number {
  return birdRights === "bird" ? 5 : 4
}

export function usesBirdRaise(birdRights: BirdRightsType): boolean {
  return birdRights === "bird" || birdRights === "early_bird"
}
