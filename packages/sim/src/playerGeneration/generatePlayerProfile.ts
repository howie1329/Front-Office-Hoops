import {
  RATING_MAX,
  RATING_MIN,
  VETERAN_MIN_AGE,
  VETERAN_TAG,
} from "@workspace/shared/constants"
import type {
  PlayerArchetype,
  PlayerPosition,
  PlayerRatings,
  Rng,
} from "@workspace/shared/types"

import { generatePeakAge } from "../development/generatePeakAge"
import { FIRST_NAMES, LAST_NAMES } from "../namePools"
import { clampRating, deriveOverall, deriveUsage } from "../playerRatings"
import {
  ARCHETYPE_SKILL_BIAS,
  ARCHETYPE_USAGE_BONUS,
  pickArchetype,
} from "./archetypes"

export type SkillBias = Partial<
  Record<
    Exclude<keyof PlayerRatings, "overall" | "potential" | "usage">,
    number
  >
>

export type GeneratedPlayerProfile = {
  firstName: string
  lastName: string
  age: number
  peakAge: number
  heightInches: number
  weightLbs: number
  position: PlayerPosition
  archetype: PlayerArchetype
  ratings: PlayerRatings
  tags: string[]
  yearsOfService: number
}

export type GeneratePlayerProfileInput = {
  age: number
  targetOverall: number
  position: PlayerPosition
  rng: Rng
  usedNames?: Set<string>
  potentialGap: { min: number; max: number }
  skillVariance?: { min: number; max: number }
  skillBias?: SkillBias
  archetype?: PlayerArchetype
  archetypeContext?: "draft" | "free_agent"
  usageIndex?: number
}

const POSITION_HEIGHT: Record<PlayerPosition, { min: number; max: number }> = {
  PG: { min: 72, max: 76 },
  SG: { min: 74, max: 78 },
  SF: { min: 76, max: 80 },
  PF: { min: 78, max: 82 },
  C: { min: 80, max: 84 },
}

export const DEFAULT_POSITION_BIAS: Record<PlayerPosition, SkillBias> = {
  PG: { passing: 6, rebounding: -6 },
  SG: { shooting: 6, passing: -2, rebounding: -4 },
  SF: { shooting: 4, defense: 2, passing: -3, rebounding: -3 },
  PF: { rebounding: 5, inside: 4, shooting: -4, passing: -5 },
  C: { rebounding: 6, inside: 5, passing: -6, shooting: -5 },
}

function pickName(pool: string[], rng: Rng): string {
  return pool[rng.int(0, pool.length - 1)]!
}

function pickUniqueName(
  rng: Rng,
  usedNames?: Set<string>
): { firstName: string; lastName: string } {
  let firstName = pickName(FIRST_NAMES, rng)
  let lastName = pickName(LAST_NAMES, rng)

  if (!usedNames) {
    return { firstName, lastName }
  }

  let displayName = `${firstName} ${lastName}`
  while (usedNames.has(displayName)) {
    firstName = pickName(FIRST_NAMES, rng)
    lastName = pickName(LAST_NAMES, rng)
    displayName = `${firstName} ${lastName}`
  }

  usedNames.add(displayName)
  return { firstName, lastName }
}

function addBias(base: SkillBias, override?: SkillBias): SkillBias {
  if (!override) {
    return base
  }

  return {
    shooting: (base.shooting ?? 0) + (override.shooting ?? 0),
    inside: (base.inside ?? 0) + (override.inside ?? 0),
    passing: (base.passing ?? 0) + (override.passing ?? 0),
    rebounding: (base.rebounding ?? 0) + (override.rebounding ?? 0),
    defense: (base.defense ?? 0) + (override.defense ?? 0),
    stamina: (base.stamina ?? 0) + (override.stamina ?? 0),
  }
}

function generateSkillRatings(
  position: PlayerPosition,
  targetOverall: number,
  rng: Rng,
  skillVariance: { min: number; max: number },
  skillBias?: SkillBias
): Omit<PlayerRatings, "overall" | "potential" | "usage"> {
  const bias = addBias(DEFAULT_POSITION_BIAS[position], skillBias)
  const value = (key: keyof SkillBias) =>
    clampRating(
      targetOverall +
        rng.int(skillVariance.min, skillVariance.max) +
        (bias[key] ?? 0)
    )

  return {
    shooting: value("shooting"),
    inside: value("inside"),
    passing: value("passing"),
    rebounding: value("rebounding"),
    defense: value("defense"),
    stamina: value("stamina"),
  }
}

function deriveTags(age: number): string[] {
  return age >= VETERAN_MIN_AGE ? [VETERAN_TAG] : []
}

export function potentialGapForAge(
  age: number,
  rng: Rng
): { min: number; max: number } {
  if (age <= 22) {
    return { min: 8, max: 18 }
  }

  if (age <= 25) {
    return { min: 4, max: 12 }
  }

  if (age >= 32) {
    return { min: -4, max: 2 }
  }

  return rng.next() < 0.1 ? { min: 6, max: 12 } : { min: -2, max: 8 }
}

export function generatePlayerProfile({
  age,
  targetOverall,
  position,
  rng,
  usedNames,
  potentialGap,
  skillVariance = { min: -4, max: 4 },
  skillBias,
  archetype,
  archetypeContext,
  usageIndex = 0,
}: GeneratePlayerProfileInput): GeneratedPlayerProfile {
  const { firstName, lastName } = pickUniqueName(rng, usedNames)
  const selectedArchetype =
    archetype ??
    pickArchetype(position, rng, {
      draft: archetypeContext === "draft",
      freeAgent: archetypeContext === "free_agent",
    })
  const combinedSkillBias = addBias(
    ARCHETYPE_SKILL_BIAS[selectedArchetype],
    skillBias
  )
  const skillRatings = generateSkillRatings(
    position,
    targetOverall,
    rng,
    skillVariance,
    combinedSkillBias
  )
  const overall = deriveOverall(skillRatings)
  const potential = clampRating(
    overall + rng.int(potentialGap.min, potentialGap.max)
  )
  const peakAge = generatePeakAge(age, overall, potential, rng)
  const heightRange = POSITION_HEIGHT[position]

  return {
    firstName,
    lastName,
    age,
    peakAge,
    heightInches: rng.int(heightRange.min, heightRange.max),
    weightLbs: rng.int(185, 250),
    position,
    archetype: selectedArchetype,
    ratings: {
      ...skillRatings,
      overall: Math.max(RATING_MIN, Math.min(RATING_MAX, overall)),
      potential,
      usage: Math.max(
        1,
        deriveUsage(overall, usageIndex) +
          ARCHETYPE_USAGE_BONUS[selectedArchetype]
      ),
    },
    tags: deriveTags(age),
    yearsOfService: Math.max(0, age - 19),
  }
}
