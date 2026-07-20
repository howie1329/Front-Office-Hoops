import { SKILL_KEYS } from "@workspace/shared/constants"
import type { PlayerRatings, SkillKey } from "@workspace/shared/types"
import {
  deriveOverall,
  getDisplayedRatings,
  getSkillRatings,
  resolveScoutingLevel,
} from "@workspace/sim"

export const DISPLAY_SKILL_KEYS = SKILL_KEYS

export function getTeamScoutingLevel(
  teamFinancials: { scoutingLevel: number } | undefined,
): number {
  return teamFinancials?.scoutingLevel ?? 5
}

export function getViewRatings(
  ratings: PlayerRatings,
  options: {
    isOwnRoster?: boolean
    isDraftProspect?: boolean
    teamScoutingLevel?: number
  },
): PlayerRatings {
  if (options.isOwnRoster) {
    return ratings
  }

  const scoutingLevel = resolveScoutingLevel(options)
  const displayed = getDisplayedRatings(ratings, scoutingLevel)
  const skills = getSkillRatings(displayed)
  const overall = deriveOverall(skills)

  return {
    ...displayed,
    overall,
  }
}

export function skillLabel(key: SkillKey): string {
  switch (key) {
    case "threePoint":
      return "3PT"
    case "midRange":
      return "Mid-range"
    case "freeThrow":
      return "Free throw"
    case "ballHandling":
      return "Ball handling"
    case "offensiveIQ":
      return "Offensive IQ"
    case "defensiveIQ":
      return "Defensive IQ"
    default:
      return key.charAt(0).toUpperCase() + key.slice(1)
  }
}

export function prospectTypeLabel(value: string | undefined): string {
  if (!value) {
    return "Unknown"
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
