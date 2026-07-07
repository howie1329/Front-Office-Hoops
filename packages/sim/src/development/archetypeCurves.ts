import type { PlayerArchetype, SkillKey } from "@workspace/shared/types"

type SkillMultipliers = Partial<Record<SkillKey, number>>

export type ArchetypeCurve = {
  growth: SkillMultipliers
  decline: SkillMultipliers
}

const DEFAULT_GROWTH: SkillMultipliers = {}
const DEFAULT_DECLINE: SkillMultipliers = {}

function curve(
  growth: SkillMultipliers = DEFAULT_GROWTH,
  decline: SkillMultipliers = DEFAULT_DECLINE,
): ArchetypeCurve {
  return { growth, decline }
}

export const ARCHETYPE_CURVES: Record<PlayerArchetype, ArchetypeCurve> = {
  lead_guard: curve(
    { passing: 1.2, ballHandling: 1.15, offensiveIQ: 1.25, defensiveIQ: 1.1 },
    { stamina: 1.1, passing: 0.75, offensiveIQ: 0.7, defensiveIQ: 0.75 },
  ),
  scoring_guard: curve(
    { threePoint: 1.15, midRange: 1.1, ballHandling: 1.1 },
    { stamina: 1.15, threePoint: 0.85, midRange: 0.85, inside: 1.1 },
  ),
  three_and_d_wing: curve(
    { threePoint: 1.2, defense: 1.1, defensiveIQ: 1.1 },
    { stamina: 1.1, threePoint: 0.8, defense: 0.9 },
  ),
  slasher: curve(
    { inside: 1.2, stamina: 1.15, ballHandling: 1.1 },
    { stamina: 1.25, inside: 1.0, defense: 1.1 },
  ),
  point_forward: curve(
    { passing: 1.15, rebounding: 1.1, offensiveIQ: 1.15 },
    { stamina: 1.1, passing: 0.8, offensiveIQ: 0.75 },
  ),
  stretch_big: curve(
    { threePoint: 1.2, midRange: 1.1, offensiveIQ: 1.05 },
    { stamina: 1.1, threePoint: 0.7, midRange: 0.75, rebounding: 1.15 },
  ),
  rim_protector: curve(
    { defense: 1.2, rebounding: 1.15, inside: 1.1 },
    { stamina: 1.2, defense: 0.95, rebounding: 1.05, inside: 1.1 },
  ),
  post_scorer: curve(
    { inside: 1.2, offensiveIQ: 1.1 },
    { stamina: 1.15, inside: 0.85, rebounding: 1.1 },
  ),
  rebounding_big: curve(
    { rebounding: 1.2, inside: 1.1, defense: 1.05 },
    { stamina: 1.2, rebounding: 0.9, inside: 1.1 },
  ),
  defensive_specialist: curve(
    { defense: 1.2, defensiveIQ: 1.2, stamina: 1.05 },
    { stamina: 1.1, defense: 0.85, defensiveIQ: 0.8 },
  ),
  bench_scorer: curve(
    { threePoint: 1.1, midRange: 1.1, freeThrow: 1.05 },
    { stamina: 1.05, threePoint: 0.9 },
  ),
  raw_athlete: curve(
    { stamina: 1.25, inside: 1.15, defense: 1.1, ballHandling: 1.1 },
    { stamina: 1.2, offensiveIQ: 1.2, defensiveIQ: 1.15, passing: 1.1 },
  ),
}

export function archetypeGrowthMultiplier(
  archetype: PlayerArchetype,
  skill: SkillKey,
): number {
  return ARCHETYPE_CURVES[archetype].growth[skill] ?? 1
}

export function archetypeDeclineMultiplier(
  archetype: PlayerArchetype,
  skill: SkillKey,
): number {
  return ARCHETYPE_CURVES[archetype].decline[skill] ?? 1
}
