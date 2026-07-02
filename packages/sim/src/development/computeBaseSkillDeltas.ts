import {
  DEVELOPMENT_START_AGE,
  GROWTH_RATE_SCALE,
  REGRESSION_RAMP_YEARS,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { Player, Rng, SkillKey } from "@workspace/shared/types"

import type { SkillDeltas } from "./types"

const PER_SKILL_DECLINE_RATE: Record<SkillKey, number> = {
  stamina: 2.0,
  inside: 1.5,
  defense: 1.2,
  rebounding: 1.2,
  shooting: 0.8,
  passing: 0.5,
}

function ageGrowthFactor(age: number): number {
  if (age <= 22) return 1
  if (age <= 25) return 0.85
  return 0.7
}

function skillVariance(rng: Rng): number {
  return 0.7 + rng.next() * 0.6
}

function declineVariance(rng: Rng): number {
  return 0.8 + rng.next() * 0.4
}

export function computeBaseSkillDeltas(player: Player, rng: Rng): SkillDeltas {
  const { age, peakAge, ratings } = player
  const potential = ratings.potential
  const deltas = {} as SkillDeltas

  if (age < peakAge) {
    const yearsToPeak = peakAge - age
    const developmentWindow = Math.max(1, peakAge - DEVELOPMENT_START_AGE)
    const approachFactor = Math.max(0, Math.min(1, yearsToPeak / developmentWindow))
    const baseGrowthRate =
      approachFactor * ageGrowthFactor(age) * GROWTH_RATE_SCALE

    for (const skill of SKILL_KEYS) {
      const currentSkill = ratings[skill]
      const headroom = Math.max(0, potential - currentSkill)
      deltas[skill] = baseGrowthRate * headroom * skillVariance(rng)
    }

    return deltas
  }

  if (age === peakAge) {
    for (const skill of SKILL_KEYS) {
      deltas[skill] = rng.normal(0, 0.25)
    }

    return deltas
  }

  const yearsPastPeak = age - peakAge
  const regressionIntensity = Math.min(1, yearsPastPeak / REGRESSION_RAMP_YEARS)

  for (const skill of SKILL_KEYS) {
    deltas[skill] =
      -PER_SKILL_DECLINE_RATE[skill] * regressionIntensity * declineVariance(rng)
  }

  return deltas
}
