import { SKILL_KEYS } from "@workspace/shared/constants"
import type { Player, PlayerRatings, SkillKey } from "@workspace/shared/types"

import { seedPlayerMood } from "../../src/playerValue/moodSeed"

export function emptyFuzz(): Record<SkillKey, number> {
  return Object.fromEntries(SKILL_KEYS.map((key) => [key, 0])) as Record<
    SkillKey,
    number
  >
}

export function makeTestRatings(
  overrides: Partial<PlayerRatings> = {},
): PlayerRatings {
  const base = overrides.overall ?? 60
  const skills = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, overrides[key] ?? base]),
  ) as Record<SkillKey, number>

  return {
    ...skills,
    fuzz: overrides.fuzz ?? emptyFuzz(),
    overall: overrides.overall ?? base,
    potential: overrides.potential ?? base + 10,
    usage: overrides.usage ?? 16,
  }
}

export function makeTestPlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? "p_test"
  return {
    id,
    teamId: "t_test",
    firstName: "Test",
    lastName: id,
    age: 27,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    wingspanInches: 80,
    reachRating: 58,
    position: "SG",
    archetype: "scoring_guard",
    ratings: makeTestRatings(overrides.ratings),
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 2,
    yearsOfService: 2,
    mood: overrides.mood ?? seedPlayerMood(id),
    performanceDrift: overrides.performanceDrift ?? 0,
    ...overrides,
  }
}
