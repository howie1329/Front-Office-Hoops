import type { PlayerPosition, ProspectType, Rng } from "@workspace/shared/types"

export type CorrelationFactors = {
  athleticism: number
  shooting: number
  skill: number
}

const ATHLETICISM_SKILLS = new Set([
  "stamina",
  "inside",
  "defense",
] as const)

const SHOOTING_SKILLS = new Set([
  "threePoint",
  "midRange",
  "freeThrow",
] as const)

const SKILL_SKILLS = new Set([
  "passing",
  "ballHandling",
  "offensiveIQ",
  "defensiveIQ",
  "rebounding",
] as const)

export function pickProspectType(rng: Rng, context?: "draft" | "camp"): ProspectType {
  if (context === "camp") {
    return "camp_fringe"
  }

  const roll = rng.next()
  if (roll < 0.35) return "tools"
  if (roll < 0.6) return "polish"
  return "balanced"
}

export function drawCorrelationFactors(
  prospectType: ProspectType,
  rng: Rng,
): CorrelationFactors {
  const draw = () => Math.max(0.25, Math.min(1.25, rng.normal(1, 0.2)))

  switch (prospectType) {
    case "tools":
      return {
        athleticism: Math.max(0.9, draw()),
        shooting: Math.min(0.85, draw()),
        skill: Math.min(0.75, draw()),
      }
    case "polish":
      return {
        athleticism: Math.min(0.9, draw()),
        shooting: Math.max(0.85, draw()),
        skill: Math.max(0.95, draw()),
      }
    case "camp_fringe":
      return {
        athleticism: Math.max(0.7, draw()),
        shooting: Math.min(0.8, draw()),
        skill: Math.min(0.8, draw()),
      }
    case "balanced":
    default:
      return {
        athleticism: draw(),
        shooting: draw(),
        skill: draw(),
      }
  }
}

export function iqBaselineForAge(age: number, targetOverall: number): number {
  if (age <= 19) return Math.max(40, targetOverall - 14)
  if (age <= 21) return Math.max(40, targetOverall - 10)
  if (age <= 24) return Math.max(40, targetOverall - 6)
  if (age <= 27) return Math.max(40, targetOverall - 3)
  return targetOverall
}

export function skillFactorForKey(
  key: string,
  factors: CorrelationFactors,
): number {
  if (ATHLETICISM_SKILLS.has(key as never)) return factors.athleticism
  if (SHOOTING_SKILLS.has(key as never)) return factors.shooting
  if (SKILL_SKILLS.has(key as never)) return factors.skill
  return 1
}

export const POSITION_TYPE_FACTORS: Record<
  PlayerPosition,
  Partial<Record<string, number>>
> = {
  PG: {
    ballHandling: 1.15,
    passing: 1.12,
    threePoint: 1.05,
    rebounding: 0.82,
    inside: 0.88,
  },
  SG: {
    threePoint: 1.1,
    midRange: 1.08,
    ballHandling: 1.05,
    rebounding: 0.9,
  },
  SF: {
    threePoint: 1.05,
    defense: 1.05,
    rebounding: 0.95,
  },
  PF: {
    rebounding: 1.12,
    inside: 1.1,
    threePoint: 0.92,
    passing: 0.9,
  },
  C: {
    rebounding: 1.15,
    inside: 1.12,
    defense: 1.08,
    threePoint: 0.82,
    ballHandling: 0.85,
    passing: 0.88,
  },
}
