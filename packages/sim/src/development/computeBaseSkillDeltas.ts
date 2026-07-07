import {
  DEVELOPMENT_START_AGE,
  GROWTH_RATE_SCALE,
  IQ_SKILL_KEYS,
  REGRESSION_RAMP_YEARS,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { Player, Rng, SkillKey } from "@workspace/shared/types"

import type { SkillDeltas } from "./types"

const PER_SKILL_DECLINE_RATE: Record<SkillKey, number> = {
  threePoint: 0.8,
  midRange: 0.8,
  freeThrow: 0.5,
  inside: 1.5,
  passing: 0.5,
  ballHandling: 0.7,
  rebounding: 1.2,
  defense: 1.2,
  stamina: 2.0,
  offensiveIQ: 0.4,
  defensiveIQ: 0.4,
}

const IQ_GROWTH_CAPS: Record<number, number> = {
  19: 5,
  20: 4.5,
  21: 4,
  22: 3.5,
  23: 3,
  24: 2.5,
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

function iqGrowthCap(age: number): number {
  if (age >= 25) return 1.5
  return IQ_GROWTH_CAPS[age] ?? 2
}

export function computeBaseSkillDeltas(player: Player, rng: Rng): SkillDeltas {
  const { age, peakAge, ratings } = player
  const deltas = {} as SkillDeltas

  if (age < peakAge) {
    const yearsToPeak = peakAge - age
    const developmentWindow = Math.max(1, peakAge - DEVELOPMENT_START_AGE)
    const approachFactor = Math.max(0, Math.min(1, yearsToPeak / developmentWindow))
    const baseGrowthRate =
      approachFactor * ageGrowthFactor(age) * GROWTH_RATE_SCALE

    for (const skill of SKILL_KEYS) {
      const currentSkill = ratings[skill]
      const isIq = IQ_SKILL_KEYS.includes(skill as never)
      const headroom = isIq
        ? Math.max(0, 85 - currentSkill)
        : Math.max(0, 90 - currentSkill)
      const growthMultiplier = isIq ? 1.35 : 1
      const cap = isIq ? iqGrowthCap(age) : 3.5
      deltas[skill] = Math.min(
        cap,
        baseGrowthRate * headroom * skillVariance(rng) * growthMultiplier,
      )
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
