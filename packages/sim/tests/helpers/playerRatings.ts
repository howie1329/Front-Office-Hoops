import { SKILL_KEYS } from "@workspace/shared/constants"
import type { PlayerRatings, SkillKey } from "@workspace/shared/types"

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
