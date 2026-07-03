import type {
  PlayerArchetype,
  PlayerPosition,
  Rng,
} from "@workspace/shared/types"

import type { SkillBias } from "./generatePlayerProfile"

export const ARCHETYPES_BY_POSITION: Record<PlayerPosition, PlayerArchetype[]> =
  {
    PG: ["lead_guard", "scoring_guard", "defensive_specialist", "raw_athlete"],
    SG: [
      "scoring_guard",
      "three_and_d_wing",
      "slasher",
      "bench_scorer",
      "defensive_specialist",
      "raw_athlete",
    ],
    SF: [
      "three_and_d_wing",
      "slasher",
      "point_forward",
      "defensive_specialist",
      "raw_athlete",
    ],
    PF: [
      "stretch_big",
      "rebounding_big",
      "point_forward",
      "rim_protector",
      "post_scorer",
      "raw_athlete",
    ],
    C: [
      "rim_protector",
      "post_scorer",
      "rebounding_big",
      "stretch_big",
      "raw_athlete",
    ],
  }

export const ARCHETYPE_SKILL_BIAS: Record<PlayerArchetype, SkillBias> = {
  lead_guard: { passing: 8, shooting: 3 },
  scoring_guard: { shooting: 7, passing: -2, defense: -1 },
  three_and_d_wing: { shooting: 6, defense: 6 },
  slasher: { inside: 7, stamina: 3, shooting: -3 },
  point_forward: { passing: 7, rebounding: 3, inside: 2, shooting: -2 },
  stretch_big: { shooting: 8, rebounding: 2, inside: -2, defense: -1 },
  rim_protector: { defense: 8, rebounding: 6, inside: 2 },
  post_scorer: { inside: 8, passing: -2, defense: -1 },
  rebounding_big: { rebounding: 9, stamina: 3, shooting: -3 },
  defensive_specialist: { defense: 9, stamina: 3, shooting: -2 },
  bench_scorer: { shooting: 4, inside: 3, defense: -4 },
  raw_athlete: {
    inside: 5,
    rebounding: 3,
    defense: 3,
    stamina: 4,
    shooting: -4,
    passing: -3,
  },
}

export const ARCHETYPE_USAGE_BONUS: Record<PlayerArchetype, number> = {
  lead_guard: 1,
  scoring_guard: 2,
  three_and_d_wing: 0,
  slasher: 2,
  point_forward: 0,
  stretch_big: 0,
  rim_protector: -1,
  post_scorer: 2,
  rebounding_big: -1,
  defensive_specialist: -2,
  bench_scorer: 2,
  raw_athlete: 0,
}

export function pickArchetype(
  position: PlayerPosition,
  rng: Rng,
  options?: {
    draft?: boolean
    freeAgent?: boolean
  }
): PlayerArchetype {
  const base = ARCHETYPES_BY_POSITION[position]
  const weighted = [...base]

  if (options?.draft && base.includes("raw_athlete")) {
    weighted.push("raw_athlete", "raw_athlete")
  }

  if (options?.freeAgent) {
    for (const archetype of ["defensive_specialist", "bench_scorer"] as const) {
      if (base.includes(archetype)) {
        weighted.push(archetype)
      }
    }
  }

  return weighted[rng.int(0, weighted.length - 1)]!
}

export function isValidArchetypeForPosition(
  archetype: PlayerArchetype,
  position: PlayerPosition
): boolean {
  return ARCHETYPES_BY_POSITION[position].includes(archetype)
}
