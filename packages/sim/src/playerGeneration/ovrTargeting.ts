import { RATING_MAX, RATING_MIN, SKILL_KEYS } from "@workspace/shared/constants"
import type { PlayerArchetype, SkillKey } from "@workspace/shared/types"

import { deriveOverall } from "../playerRatings"
import type { SkillBias } from "./generatePlayerProfile"

const ARCHETYPE_PROTECTED_SKILLS: Partial<
  Record<PlayerArchetype, SkillKey[]>
> = {
  rim_protector: ["defense", "rebounding"],
  stretch_big: ["threePoint"],
  scoring_guard: ["threePoint", "midRange"],
  lead_guard: ["passing", "ballHandling"],
  three_and_d_wing: ["threePoint", "defense"],
  post_scorer: ["inside"],
  rebounding_big: ["rebounding"],
  defensive_specialist: ["defense"],
  bench_scorer: ["threePoint", "inside"],
  raw_athlete: ["stamina", "inside"],
}

export function adjustSkillsToTargetOverall(
  skills: Record<SkillKey, number>,
  targetOverall: number,
  archetype: PlayerArchetype,
  tolerance = 2,
  maxPasses = 6,
): Record<SkillKey, number> {
  let current = { ...skills }
  const protectedSkills = new Set(ARCHETYPE_PROTECTED_SKILLS[archetype] ?? [])

  for (let pass = 0; pass < maxPasses; pass++) {
    const overall = deriveOverall(current)
    const delta = targetOverall - overall

    if (Math.abs(delta) <= tolerance) {
      return current
    }

    const adjustable = SKILL_KEYS.filter((key) => !protectedSkills.has(key))
    if (adjustable.length === 0) {
      break
    }

    const perSkill = delta / adjustable.length
    current = Object.fromEntries(
      SKILL_KEYS.map((key) => {
        const value = current[key]
        if (!adjustable.includes(key)) {
          return [key, value]
        }

        const adjusted = Math.round(value + perSkill)
        return [
          key,
          Math.max(RATING_MIN, Math.min(RATING_MAX, adjusted)),
        ]
      }),
    ) as Record<SkillKey, number>
  }

  return current
}

export function mergeSkillBias(
  base: SkillBias,
  override?: SkillBias,
): SkillBias {
  if (!override) {
    return base
  }

  const merged = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const skillKey = key as SkillKey
    merged[skillKey] = (merged[skillKey] ?? 0) + (value ?? 0)
  }

  return merged
}
