import {
  DEVELOPMENT_START_AGE,
  GROWTH_RATE_SCALE,
  GROWTH_RNG_MAX,
  GROWTH_RNG_MIN,
  IQ_SKILL_KEYS,
  REGRESSION_RAMP_YEARS,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { Player, Rng, SkillKey } from "@workspace/shared/types"

import {
  archetypeDeclineMultiplier,
  archetypeGrowthMultiplier,
} from "./archetypeCurves"
import { declineAgeModifier } from "./declineModifiers"
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

function growthRngMultiplier(rng: Rng): number {
  return GROWTH_RNG_MIN + rng.next() * (GROWTH_RNG_MAX - GROWTH_RNG_MIN)
}

function iqGrowthCap(age: number): number {
  if (age >= 25) return 1.5
  return IQ_GROWTH_CAPS[age] ?? 2
}

export type ComputeDeltasOptions = {
  forecastPotential?: number
}

export function computeBaseSkillDeltas(
  player: Player,
  rng: Rng,
  options: ComputeDeltasOptions = {},
): SkillDeltas {
  const { age, peakAge, ratings, archetype } = player
  const forecastPotential =
    options.forecastPotential ?? ratings.potential
  const deltas = {} as SkillDeltas
  const reinventionActive = (player.reinventionSeasonsRemaining ?? 0) > 0

  if (age < peakAge) {
    const yearsToPeak = peakAge - age
    const developmentWindow = Math.max(1, peakAge - DEVELOPMENT_START_AGE)
    const approachFactor = Math.max(
      0,
      Math.min(1, yearsToPeak / developmentWindow),
    )
    const baseGrowthRate =
      approachFactor * ageGrowthFactor(age) * GROWTH_RATE_SCALE

    for (const skill of SKILL_KEYS) {
      const currentSkill = ratings[skill]
      const isIq = (IQ_SKILL_KEYS as readonly string[]).includes(skill)
      const headroom = Math.max(0, forecastPotential - currentSkill)
      const growthMultiplier =
        (isIq ? 1.35 : 1) * archetypeGrowthMultiplier(archetype, skill)
      const cap = isIq ? iqGrowthCap(age) : 3.5
      deltas[skill] = Math.min(
        cap,
        baseGrowthRate *
          headroom *
          skillVariance(rng) *
          growthMultiplier *
          growthRngMultiplier(rng),
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
  const regressionIntensity = Math.min(
    1,
    yearsPastPeak / REGRESSION_RAMP_YEARS,
  )

  for (const skill of SKILL_KEYS) {
    const ageMod = declineAgeModifier(skill, age)
    const archetypeMod = archetypeDeclineMultiplier(archetype, skill)
    let rate =
      PER_SKILL_DECLINE_RATE[skill] * regressionIntensity * archetypeMod

    if (ageMod > 0) {
      rate *= 1 - ageMod
    } else if (ageMod < 0) {
      rate *= 1 - ageMod
    }

    if (reinventionActive && (skill === "threePoint" || skill === "offensiveIQ")) {
      rate *= 0.6
    }

    deltas[skill] = -rate * declineVariance(rng)
  }

  return deltas
}
