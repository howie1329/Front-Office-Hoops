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
  lead_guard: { passing: 8, ballHandling: 6, threePoint: 3 },
  scoring_guard: { threePoint: 7, midRange: 4, passing: -2, defense: -1 },
  three_and_d_wing: { threePoint: 6, defense: 6, midRange: 2 },
  slasher: { inside: 7, stamina: 3, threePoint: -3, ballHandling: 2 },
  point_forward: {
    passing: 7,
    rebounding: 3,
    inside: 2,
    threePoint: -2,
    ballHandling: 3,
  },
  stretch_big: { threePoint: 8, rebounding: 2, inside: -2, defense: -1 },
  rim_protector: { defense: 8, rebounding: 6, inside: 2 },
  post_scorer: { inside: 8, passing: -2, defense: -1 },
  rebounding_big: { rebounding: 9, stamina: 3, threePoint: -3 },
  defensive_specialist: { defense: 9, stamina: 3, threePoint: -2 },
  bench_scorer: { threePoint: 4, inside: 3, midRange: 2, defense: -4 },
  raw_athlete: {
    inside: 5,
    rebounding: 3,
    defense: 3,
    stamina: 4,
    threePoint: -4,
    passing: -3,
    offensiveIQ: -6,
    defensiveIQ: -5,
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

export const ARCHETYPE_SIM_MODIFIERS: Record<
  PlayerArchetype,
  Partial<Record<"threePa" | "twoPa" | "fta" | "ast" | "reb" | "blk" | "stl" | "tov", number>>
> = {
  lead_guard: { ast: 1.15, tov: 1.05 },
  scoring_guard: { threePa: 1.12, twoPa: 1.08 },
  three_and_d_wing: { threePa: 1.1, stl: 1.08 },
  slasher: { twoPa: 1.12, fta: 1.1 },
  point_forward: { ast: 1.08, reb: 1.05 },
  stretch_big: { threePa: 1.15, twoPa: 0.9 },
  rim_protector: { blk: 1.2, reb: 1.1, threePa: 0.85 },
  post_scorer: { twoPa: 1.12, fta: 1.08 },
  rebounding_big: { reb: 1.15 },
  defensive_specialist: { stl: 1.1, blk: 1.05 },
  bench_scorer: { threePa: 1.08, twoPa: 1.05 },
  raw_athlete: { twoPa: 1.08, reb: 1.05 },
}

export function pickArchetype(
  position: PlayerPosition,
  rng: Rng,
  options?: {
    draft?: boolean
    freeAgent?: boolean
    camp?: boolean
  },
): PlayerArchetype {
  const base = ARCHETYPES_BY_POSITION[position]
  const weighted = [...base]

  if (options?.draft && base.includes("raw_athlete")) {
    weighted.push("raw_athlete", "raw_athlete")
  }

  if (options?.freeAgent || options?.camp) {
    for (const archetype of ["defensive_specialist", "bench_scorer"] as const) {
      if (base.includes(archetype)) {
        weighted.push(archetype)
      }
    }
  }

  if (options?.camp && base.includes("raw_athlete")) {
    weighted.push("raw_athlete")
  }

  return weighted[rng.int(0, weighted.length - 1)]!
}

export function isValidArchetypeForPosition(
  archetype: PlayerArchetype,
  position: PlayerPosition,
): boolean {
  return ARCHETYPES_BY_POSITION[position].includes(archetype)
}

export function getArchetypeSimModifier(
  archetype: PlayerArchetype,
  stat: keyof (typeof ARCHETYPE_SIM_MODIFIERS)[PlayerArchetype],
): number {
  return ARCHETYPE_SIM_MODIFIERS[archetype][stat] ?? 1
}
