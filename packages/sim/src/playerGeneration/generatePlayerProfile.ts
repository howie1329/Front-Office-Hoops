import {
  RATING_MAX,
  RATING_MIN,
  SKILL_KEYS,
  VETERAN_MIN_AGE,
  VETERAN_TAG,
} from "@workspace/shared/constants"
import { emptyFuzz } from "@workspace/shared/skillRatings"
import type {
  PlayerArchetype,
  PlayerPosition,
  PlayerRatings,
  ProspectType,
  Rng,
  SkillKey,
} from "@workspace/shared/types"

import { generatePeakAge } from "../development/generatePeakAge"
import { FIRST_NAMES, LAST_NAMES } from "../namePools"
import { clampRating, deriveOverall, deriveUsage } from "../playerRatings"
import { genFuzz, resolveScoutingLevel } from "../scouting/displayedRatings"
import { estimatePotential } from "./estimatePotential"
import {
  drawCorrelationFactors,
  iqBaselineForAge,
  pickProspectType,
  POSITION_TYPE_FACTORS,
  skillFactorForKey,
} from "./correlationBundles"
import { adjustSkillsToTargetOverall } from "./ovrTargeting"
import { generatePhysicalProfile } from "./physicalProfile"
import {
  ARCHETYPE_SKILL_BIAS,
  ARCHETYPE_USAGE_BONUS,
  pickArchetype,
} from "./archetypes"

export type SkillBias = Partial<Record<SkillKey, number>>

export type GeneratedPlayerProfile = {
  firstName: string
  lastName: string
  age: number
  peakAge: number
  heightInches: number
  weightLbs: number
  wingspanInches: number
  reachRating: number
  position: PlayerPosition
  archetype: PlayerArchetype
  prospectType: ProspectType
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
  skillVariance?: { min: number; max: number }
  skillBias?: SkillBias
  archetype?: PlayerArchetype
  archetypeContext?: "draft" | "free_agent" | "camp"
  prospectType?: ProspectType
  usageIndex?: number
  scoutingLevel?: number
  ovrTolerance?: number
}

export const DEFAULT_POSITION_BIAS: Record<PlayerPosition, SkillBias> = {
  PG: { passing: 6, ballHandling: 5, rebounding: -6 },
  SG: { threePoint: 6, midRange: 4, passing: -2, rebounding: -4 },
  SF: { threePoint: 4, defense: 2, passing: -3, rebounding: -3 },
  PF: { rebounding: 5, inside: 4, threePoint: -4, passing: -5 },
  C: { rebounding: 6, inside: 5, passing: -6, threePoint: -5, ballHandling: -4 },
}

function pickName(pool: string[], rng: Rng): string {
  return pool[rng.int(0, pool.length - 1)]!
}

function pickUniqueName(
  rng: Rng,
  usedNames?: Set<string>,
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

function generateCorrelatedSkills(
  position: PlayerPosition,
  targetOverall: number,
  prospectType: ProspectType,
  archetype: PlayerArchetype,
  age: number,
  rng: Rng,
  skillVariance: { min: number; max: number },
  skillBias?: SkillBias,
): Record<SkillKey, number> {
  const factors = drawCorrelationFactors(prospectType, rng)
  const positionFactors = POSITION_TYPE_FACTORS[position]
  const archetypeBias = ARCHETYPE_SKILL_BIAS[archetype]
  const positionBias = DEFAULT_POSITION_BIAS[position]
  const iqBaseline = iqBaselineForAge(age, targetOverall)

  const skills = Object.fromEntries(
    SKILL_KEYS.map((key) => {
      const isIq = key === "offensiveIQ" || key === "defensiveIQ"
      const base = isIq ? iqBaseline : targetOverall
      const factor = skillFactorForKey(key, factors)
      const typeFactor = positionFactors[key] ?? 1
      const bias =
        (positionBias[key] ?? 0) +
        (archetypeBias[key] ?? 0) +
        (skillBias?.[key] ?? 0)
      const noise = rng.int(skillVariance.min, skillVariance.max)

      const value = base * factor * typeFactor + bias + noise
      return [key, clampRating(value)]
    }),
  ) as Record<SkillKey, number>

  return adjustSkillsToTargetOverall(skills, targetOverall, archetype)
}

function deriveTags(age: number): string[] {
  return age >= VETERAN_MIN_AGE ? [VETERAN_TAG] : []
}

export function potentialGapForAge(
  age: number,
  rng: Rng,
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
  skillVariance = { min: -4, max: 4 },
  skillBias,
  archetype,
  archetypeContext,
  prospectType,
  usageIndex = 0,
  scoutingLevel,
  ovrTolerance = 2,
}: GeneratePlayerProfileInput): GeneratedPlayerProfile {
  const { firstName, lastName } = pickUniqueName(rng, usedNames)
  const selectedProspectType =
    prospectType ??
    pickProspectType(
      rng,
      archetypeContext === "camp" ? "camp" : archetypeContext === "draft" ? "draft" : undefined,
    )
  const selectedArchetype =
    archetype ??
    pickArchetype(position, rng, {
      draft: archetypeContext === "draft",
      freeAgent: archetypeContext === "free_agent",
      camp: archetypeContext === "camp",
    })
  const physical = generatePhysicalProfile(position, rng)
  const skillRatings = generateCorrelatedSkills(
    position,
    targetOverall,
    selectedProspectType,
    selectedArchetype,
    age,
    rng,
    skillVariance,
    skillBias,
  )
  const adjustedSkills = adjustSkillsToTargetOverall(
    skillRatings,
    targetOverall,
    selectedArchetype,
    ovrTolerance,
  )
  const overall = deriveOverall(adjustedSkills)
  const peakAge = generatePeakAge(age, overall, overall + 10, rng)
  const potential = estimatePotential(overall, age, peakAge, rng)
  const resolvedScouting =
    scoutingLevel ??
    resolveScoutingLevel({
      isDraftProspect: archetypeContext === "draft",
      isOwnRoster: false,
    })
  const fuzz = genFuzz(rng, resolvedScouting)
  const potentialFuzz = Math.max(
    -8,
    Math.min(8, (fuzz.offensiveIQ ?? 0) - (fuzz.defensiveIQ ?? 0)),
  )

  return {
    firstName,
    lastName,
    age,
    peakAge,
    heightInches: physical.heightInches,
    weightLbs: physical.weightLbs,
    wingspanInches: physical.wingspanInches,
    reachRating: physical.reachRating,
    position,
    archetype: selectedArchetype,
    prospectType: selectedProspectType,
    ratings: {
      ...adjustedSkills,
      fuzz,
      potentialFuzz,
      overall: Math.max(RATING_MIN, Math.min(RATING_MAX, overall)),
      potential,
      usage: Math.max(
        1,
        deriveUsage(overall, usageIndex) +
          ARCHETYPE_USAGE_BONUS[selectedArchetype],
      ),
    },
    tags: deriveTags(age),
    yearsOfService: Math.max(0, age - 19),
  }
}

export function createEmptyRatings(base = 50): PlayerRatings {
  const skills = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, base]),
  ) as Record<SkillKey, number>

  return {
    ...skills,
    fuzz: emptyFuzz(),
    potentialFuzz: 0,
    overall: base,
    potential: base,
    usage: 10,
  }
}
