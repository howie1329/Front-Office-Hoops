import {
  SCOUTING_LEVEL_MAX,
  SCOUTING_LEVEL_MIN,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { PlayerRatings, Rng, SkillKey } from "@workspace/shared/types"
import { emptyFuzz } from "@workspace/shared/skillRatings"

import { clampRating } from "../playerRatings"
import { createRng } from "../rng"

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

function fuzzMultiplier(scoutingLevel: number): number {
  const normalized =
    (Math.max(SCOUTING_LEVEL_MIN, Math.min(SCOUTING_LEVEL_MAX, scoutingLevel)) - 1) /
    (SCOUTING_LEVEL_MAX - 1)
  return 1.7 - normalized * 1.4
}

export function getDisplayedRatings(
  ratings: PlayerRatings,
  scoutingLevel = 5,
): Omit<PlayerRatings, "fuzz"> & { fuzz: Record<SkillKey, number> } {
  const displayed = { ...ratings }
  const multiplier = fuzzMultiplier(scoutingLevel)

  for (const key of SKILL_KEYS) {
    displayed[key] = getDisplayedSkillRating(
      ratings[key],
      Math.round((ratings.fuzz[key] ?? 0) * multiplier),
    )
  }

  const skillSlice = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, displayed[key]]),
  ) as Record<SkillKey, number>

  return {
    ...skillSlice,
    fuzz: ratings.fuzz,
    overall: displayed.overall,
    potential: clampRating(
      displayed.potential + Math.round((ratings.potentialFuzz ?? 0) * multiplier),
    ),
    usage: displayed.usage,
  }
}

export type TeamScoutingReportContext = {
  leagueSeed: string
  viewerTeamId: string
  subjectId: string
  scoutingLevel: number
}

export type TeamScoutingReport = {
  ratings: Omit<PlayerRatings, "fuzz"> & { fuzz: Record<SkillKey, number> }
  potentialRange: { low: number; high: number }
}

function normalizedScoutingLevel(level: number): number {
  return Math.max(SCOUTING_LEVEL_MIN, Math.min(SCOUTING_LEVEL_MAX, level))
}

function reportErrorEnvelope(level: number): number {
  const normalized = (normalizedScoutingLevel(level) - 1) / (SCOUTING_LEVEL_MAX - 1)
  return 8 - normalized * 7
}

function potentialHalfWidth(level: number): number {
  const normalized = (normalizedScoutingLevel(level) - 1) / (SCOUTING_LEVEL_MAX - 1)
  return Math.round(10 - normalized * 8)
}

function reportError(rng: Rng, envelope: number): number {
  return Math.round(Math.max(-1, Math.min(1, rng.normal(0, 0.55))) * envelope)
}

/**
 * Produces a stable report for one team/player pair. The base draw never
 * changes; scouting quality only scales its distance from the true rating.
 */
export function getTeamScoutingReport(
  ratings: PlayerRatings,
  context: TeamScoutingReportContext,
): TeamScoutingReport {
  const rng = createRng(
    `${context.leagueSeed}:scouting:${context.viewerTeamId}:${context.subjectId}`,
  )
  const envelope = reportErrorEnvelope(context.scoutingLevel)
  const displayed = { ...ratings }

  for (const key of SKILL_KEYS) {
    displayed[key] = clampRating(ratings[key] + reportError(rng, envelope))
  }

  const potentialEstimate = clampRating(
    ratings.potential + reportError(rng, envelope),
  )
  const halfWidth = potentialHalfWidth(context.scoutingLevel)
  const skills = Object.fromEntries(
    SKILL_KEYS.map((key) => [key, displayed[key]]),
  ) as Record<SkillKey, number>

  return {
    ratings: {
      ...skills,
      fuzz: ratings.fuzz,
      overall: displayed.overall,
      potential: potentialEstimate,
      usage: displayed.usage,
    },
    potentialRange: {
      low: clampRating(potentialEstimate - halfWidth),
      high: clampRating(potentialEstimate + halfWidth),
    },
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
    return options.teamScoutingLevel ?? 5
  }

  return options.teamScoutingLevel ?? 5
}
