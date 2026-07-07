import { SKILL_KEYS } from "@workspace/shared/constants"
import type { SkillKey } from "@workspace/shared/types"

export const OVERALL_SKILL_WEIGHTS: Record<SkillKey, number> = {
  threePoint: 1.1,
  midRange: 0.9,
  freeThrow: 0.5,
  inside: 1.0,
  passing: 1.0,
  ballHandling: 0.8,
  rebounding: 1.0,
  defense: 1.1,
  stamina: 0.7,
  offensiveIQ: 0.9,
  defensiveIQ: 0.9,
}

export function emptySkillRatings(base = 50): Record<SkillKey, number> {
  return Object.fromEntries(
    SKILL_KEYS.map((key) => [key, base]),
  ) as Record<SkillKey, number>
}

export function emptyFuzz(): Record<SkillKey, number> {
  return Object.fromEntries(SKILL_KEYS.map((key) => [key, 0])) as Record<
    SkillKey,
    number
  >
}
