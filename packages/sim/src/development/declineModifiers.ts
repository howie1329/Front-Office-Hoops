import {
  SHOOTING_SKILL_KEYS,
} from "@workspace/shared/constants"
import type { SkillKey } from "@workspace/shared/types"

/** BBGM-style per-skill age offsets applied during post-peak decline. */
export function declineAgeModifier(skill: SkillKey, age: number): number {
  if (age <= 27) return 0

  const isShooting = (SHOOTING_SKILL_KEYS as readonly string[]).includes(skill)
  const isIq = skill === "offensiveIQ" || skill === "defensiveIQ"
  const isAthletic =
    skill === "stamina" || skill === "defense" || skill === "inside"

  if (isAthletic) {
    if (age >= 34) return -0.5
    if (age >= 31) return -0.35
    if (age >= 28) return -0.2
    return 0
  }

  if (isShooting) {
    if (age >= 34) return 0.15
    if (age >= 30) return 0.25
    if (age >= 28) return 0.1
    return 0
  }

  if (isIq) {
    if (age >= 34) return 0.1
    if (age >= 30) return 0.2
    return 0
  }

  if (skill === "passing" || skill === "ballHandling") {
    if (age >= 32) return 0.05
    if (age >= 28) return 0.1
    return 0
  }

  return 0
}
