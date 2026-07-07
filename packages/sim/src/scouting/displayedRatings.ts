import {
  SCOUTING_LEVEL_MAX,
  SCOUTING_LEVEL_MIN,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { PlayerRatings, Rng, SkillKey } from "@workspace/shared/types"
import { emptyFuzz } from "@workspace/shared/skillRatings"

import { clampRating } from "../playerRatings"

function scoutingCutoff(level: number): number {
  const normalized =
    (Math.max(SCOUTING_LEVEL_MIN, Math.min(SCOUTING_LEVEL_MAX, level)) - 1) /
    (SCOUTING_LEVEL_MAX - 1)
  return 8 - normalized * 6
}

function scoutingStddev(level: number): number {
  const normalized =
    (Math.max(SCOUTING_LEVEL_MIN, Math.min(SCOUTING_LEVEL_MAX, level)) - 1) /
    (SCOUTING_LEVEL_MAX - 1)
  return 6 - normalized * 4.5
}

export function genFuzz(rng: Rng, scoutingLevel: number): Record<SkillKey, number> {
  const cutoff = scoutingCutoff(scoutingLevel)
  const stddev = scoutingStddev(scoutingLevel)
  const fuzz = emptyFuzz()

  for (const key of SKILL_KEYS) {
    let value = rng.normal(0, stddev)
    value = Math.max(-cutoff, Math.min(cutoff, value))
    fuzz[key] = Math.round(value)
  }

  return fuzz
}

export function getDisplayedSkillRating(
  trueRating: number,
  fuzz: number,
): number {
  return clampRating(trueRating + fuzz)
}

export function getDisplayedRatings(
  ratings: PlayerRatings,
): Omit<PlayerRatings, "fuzz"> & { fuzz: Record<SkillKey, number> } {
  const displayed = { ...ratings }

  for (const key of SKILL_KEYS) {
    displayed[key] = getDisplayedSkillRating(ratings[key], ratings.fuzz[key] ?? 0)
  }

  const skillSlice = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, displayed[key]]),
  ) as Record<SkillKey, number>

  return {
    ...skillSlice,
    fuzz: ratings.fuzz,
    overall: displayed.overall,
    potential: displayed.potential,
    usage: displayed.usage,
  }
}

export function resolveScoutingLevel(options: {
  isOwnRoster?: boolean
  isDraftProspect?: boolean
  teamScoutingLevel?: number
}): number {
  if (options.isOwnRoster) {
    return 9
  }

  if (options.isDraftProspect) {
    return Math.max(SCOUTING_LEVEL_MIN, (options.teamScoutingLevel ?? 5) - 2)
  }

  return options.teamScoutingLevel ?? 5
}
