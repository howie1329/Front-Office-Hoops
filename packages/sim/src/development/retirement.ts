import { RETIREMENT_HARD_THRESHOLD } from "@workspace/shared/constants"
import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  Rng,
} from "@workspace/shared/types"

import { computeProductionRatio } from "./modifiers/index"

export type RetirementEvaluation = {
  shouldRetire: boolean
  pressure: number
  reasons: string[]
}

export function evaluateRetirement(
  player: Player,
  seasonStats: PlayerSeasonStats | undefined,
  seasonProfile: PlayerSeasonProfile | undefined,
  rng: Rng,
): RetirementEvaluation {
  const reasons: string[] = []
  let pressure = 0

  if (player.age >= 38) {
    pressure += 18
    reasons.push("age:38_plus")
  } else if (player.age >= 35) {
    pressure += 10
    reasons.push("age:35_plus")
  } else if (player.age >= 32) {
    pressure += 4
  }

  const peak = player.careerPeakOverall ?? player.ratings.overall
  const falloff = peak - player.ratings.overall
  if (falloff >= 12) {
    pressure += 16
    reasons.push("falloff:severe")
  } else if (falloff >= 8) {
    pressure += 10
    reasons.push("falloff:significant")
  } else if (falloff >= 5) {
    pressure += 5
    reasons.push("falloff:moderate")
  }

  const mpg = seasonProfile?.mpg ?? 0
  const gp = seasonProfile?.gp ?? 0

  if (gp === 0 || mpg < 5) {
    pressure += 20
    reasons.push("role:no_minutes")
  } else if (mpg < 10) {
    pressure += 12
    reasons.push("role:deep_bench")
  } else if (mpg < 15) {
    pressure += 6
    reasons.push("role:limited")
  }

  const productionRatio = computeProductionRatio(seasonStats, player)
  if (productionRatio < 0.65) {
    pressure += 10
    reasons.push("production:well_below")
  } else if (productionRatio < 0.8) {
    pressure += 5
    reasons.push("production:below")
  }

  if ((player.injuryHistory?.majorInjuryCount ?? 0) >= 2 && player.age >= 32) {
    pressure += 6
    reasons.push("injury:career_wear")
  }

  pressure += rng.normal(0, 2)

  const shouldRetire = pressure >= RETIREMENT_HARD_THRESHOLD

  if (shouldRetire && reasons.length === 0) {
    reasons.push("general:decline")
  }

  return { shouldRetire, pressure, reasons }
}
