import { EMPTY_INJURY_HISTORY } from "@workspace/shared"
import type { Player } from "@workspace/shared/types"

export function defaultDevelopmentFields(
  overall: number,
): Pick<
  Player,
  | "careerPeakOverall"
  | "developmentMomentum"
  | "injuryHistory"
  | "reinventionSeasonsRemaining"
  | "performanceDrift"
> {
  return {
    careerPeakOverall: overall,
    developmentMomentum: 0,
    injuryHistory: { ...EMPTY_INJURY_HISTORY },
    reinventionSeasonsRemaining: 0,
    performanceDrift: 0,
  }
}
