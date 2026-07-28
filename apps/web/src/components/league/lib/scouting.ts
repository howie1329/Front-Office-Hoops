import { SKILL_KEYS } from "@workspace/shared/constants"
import type { DraftProspect, Player, PlayerRatings, SkillKey } from "@workspace/shared/types"
import {
  deriveOverall,
  getDisplayedRatings,
  getSkillRatings,
  getTeamScoutingReport,
  resolveScoutingLevel,
} from "@workspace/sim"

export const DISPLAY_SKILL_KEYS = SKILL_KEYS

export function getTeamScoutingLevel(
  teamFinancials: { scoutingLevel: number } | undefined,
): number {
  return teamFinancials?.scoutingLevel ?? 5
}

type ScoutingSubject = Pick<Player, "id" | "ratings"> | DraftProspect

type ScoutingOptions = {
  isOwnRoster?: boolean
  isDraftProspect?: boolean
  teamScoutingLevel?: number
  leagueSeed?: string
  viewerTeamId?: string
}

export function getViewRatings(
  subject: ScoutingSubject,
  options: {
    isOwnRoster?: boolean
    isDraftProspect?: boolean
    teamScoutingLevel?: number
    leagueSeed?: string
    viewerTeamId?: string
  },
): PlayerRatings {
  if (options.isOwnRoster) {
    return subject.ratings
  }

  const scoutingLevel = resolveScoutingLevel(options)
  const displayed =
    options.leagueSeed && options.viewerTeamId
      ? getTeamScoutingReport(subject.ratings, {
          leagueSeed: options.leagueSeed,
          viewerTeamId: options.viewerTeamId,
          subjectId: subject.id,
          scoutingLevel,
        }).ratings
      : getDisplayedRatings(subject.ratings, scoutingLevel)
  const skills = getSkillRatings(displayed)
  const overall = deriveOverall(skills)

  return {
    ...displayed,
    overall,
  }
}

export function getProspectPotentialRange(
  prospect: DraftProspect,
  options: ScoutingOptions,
): { low: number; high: number } {
  const scoutingLevel = resolveScoutingLevel({
    ...options,
    isDraftProspect: true,
  })
  if (!options.leagueSeed || !options.viewerTeamId) {
    return { low: prospect.potentialRange.low, high: prospect.potentialRange.high }
  }
  return getTeamScoutingReport(prospect.ratings, {
    leagueSeed: options.leagueSeed,
    viewerTeamId: options.viewerTeamId,
    subjectId: prospect.id,
    scoutingLevel,
  }).potentialRange
}

export function getScoutedPlayer(
  player: Player,
  options: ScoutingOptions,
): Player {
  return {
    ...player,
    ratings: getViewRatings(player, options),
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
