import type {
  DefensiveScheme,
  OffensiveScheme,
  PlayerArchetype,
} from "@workspace/shared/types"

export const OFFENSIVE_SCHEME_ARCHETYPES: Record<
  OffensiveScheme,
  PlayerArchetype[]
> = {
  attack_rim: ["slasher", "lead_guard", "rim_protector"],
  perimeter: ["lead_guard", "stretch_big", "three_and_d_wing", "scoring_guard"],
  balanced: [],
  post_hub: ["post_scorer", "scoring_guard", "stretch_big"],
  pace_space: ["lead_guard", "slasher", "three_and_d_wing"],
}

export const DEFENSIVE_SCHEME_ARCHETYPES: Record<
  DefensiveScheme,
  PlayerArchetype[]
> = {
  drop_coverage: ["rim_protector", "defensive_specialist"],
  switch_everything: [
    "defensive_specialist",
    "three_and_d_wing",
    "point_forward",
  ],
  zone_23: ["rim_protector", "point_forward", "rebounding_big"],
  full_court_press: ["defensive_specialist", "lead_guard", "scoring_guard"],
  aggressive_help: ["defensive_specialist", "rim_protector"],
}

export function archetypeFitsOffensiveScheme(
  archetype: PlayerArchetype,
  scheme: OffensiveScheme,
): boolean {
  const preferred = OFFENSIVE_SCHEME_ARCHETYPES[scheme]
  if (preferred.length === 0) {
    return true
  }
  return preferred.includes(archetype)
}

export function archetypeFitsDefensiveScheme(
  archetype: PlayerArchetype,
  scheme: DefensiveScheme,
): boolean {
  return DEFENSIVE_SCHEME_ARCHETYPES[scheme].includes(archetype)
}
