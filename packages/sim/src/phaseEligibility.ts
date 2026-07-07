import { CAMP_ROSTER_MAX, ROSTER_MAX, ROSTER_MIN } from "@workspace/shared/constants"
import type { LeagueRecord, SeasonMilestones, SeasonState } from "@workspace/shared/types"

import { getCurrentCalendar } from "./calendar"
import { isDraftRequired } from "./draft/isDraftRequired"
import { isPreseasonComplete } from "./preseason/isPreseasonComplete"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"

export type PhaseAction =
  | "beginRegularSeason"
  | "beginPlayoffs"
  | "beginOffseason"
  | "simAiReSignings"
  | "proceedToDraft"
  | "prepareDraft"
  | "proceedToFreeAgency"
  | "simAiFreeAgency"
  | "startNextSeason"

export type EligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: string }

const PHASE_ACTIONS: PhaseAction[] = [
  "beginRegularSeason",
  "beginPlayoffs",
  "beginOffseason",
  "simAiReSignings",
  "proceedToDraft",
  "prepareDraft",
  "proceedToFreeAgency",
  "simAiFreeAgency",
  "startNextSeason",
]

function getScheduleBasedMilestones(seasonState: SeasonState): SeasonMilestones {
  return getCurrentCalendar(seasonState).milestones
}

function getUserRosterSize(league: LeagueRecord): number {
  if (!league.userTeamId) {
    return 0
  }

  return (
    league.seasonState.teams.find((team) => team.id === league.userTeamId)
      ?.players.length ?? 0
  )
}

function aiRosterNeedsFilling(league: LeagueRecord): boolean {
  return league.seasonState.teams.some(
    (team) =>
      team.id !== league.userTeamId && team.players.length < ROSTER_MAX
  )
}

export function getPhaseEligibility(
  league: LeagueRecord,
  action: PhaseAction
): EligibilityResult {
  const { seasonState } = league
  const phase = seasonState.phase
  const milestones = getScheduleBasedMilestones(seasonState)
  const isRegularComplete = isRegularSeasonComplete(seasonState)
  const isSeasonComplete = phase === "complete"
  const isOffseason = phase === "offseason"
  const offseasonPhase = isOffseason
    ? (seasonState.offseasonPhase ?? "re_signing")
    : null
  const championTeamId = seasonState.playoffBracket?.championTeamId ?? null
  const completedSeason = seasonState.season
  const draftRequired = isDraftRequired(completedSeason)
  const draftState = seasonState.draftState
  const userRosterSize = getUserRosterSize(league)
  const rosterOverLimit = userRosterSize > ROSTER_MAX

  switch (action) {
    case "beginRegularSeason": {
      if (phase !== "preseason") {
        return {
          allowed: false,
          reason: "Regular season can only begin from preseason",
        }
      }
      if (!isPreseasonComplete(seasonState)) {
        return {
          allowed: false,
          reason: "Preseason exhibition games are not complete",
        }
      }
      if (userRosterSize > ROSTER_MAX) {
        return {
          allowed: false,
          reason: `Cut roster to ${ROSTER_MAX} players before starting the regular season`,
        }
      }
      if (userRosterSize < ROSTER_MIN) {
        return {
          allowed: false,
          reason: `Roster must have at least ${ROSTER_MIN} players before starting the regular season`,
        }
      }
      if (
        seasonState.teams.some(
          (team) =>
            team.id !== league.userTeamId && team.players.length > CAMP_ROSTER_MAX,
        )
      ) {
        return {
          allowed: false,
          reason: "One or more teams exceed the camp roster limit",
        }
      }
      return { allowed: true }
    }

    case "beginPlayoffs": {
      if (phase !== "regular") {
        return {
          allowed: false,
          reason: "Playoffs can only begin from the regular season phase",
        }
      }
      if (!isRegularComplete) {
        return { allowed: false, reason: "Regular season is not complete" }
      }
      if (seasonState.currentDay < milestones.playoffsStartDay) {
        return {
          allowed: false,
          reason: "Regular season calendar has not reached playoffs start",
        }
      }
      return { allowed: true }
    }

    case "beginOffseason": {
      if (!isSeasonComplete) {
        return {
          allowed: false,
          reason: "Season must be complete before beginning the offseason",
        }
      }
      if (!championTeamId) {
        return {
          allowed: false,
          reason: "Champion must be determined before beginning the offseason",
        }
      }
      if (seasonState.currentDay < milestones.offseasonStartDay) {
        return {
          allowed: false,
          reason: "Season calendar has not reached offseason start",
        }
      }
      return { allowed: true }
    }

    case "simAiReSignings": {
      if (!isOffseason) {
        return {
          allowed: false,
          reason: "Re-signing can only be completed during the offseason",
        }
      }
      if (offseasonPhase !== "re_signing") {
        return {
          allowed: false,
          reason: "AI re-signings can only run during re-signing",
        }
      }
      return { allowed: true }
    }

    case "proceedToDraft": {
      if (offseasonPhase !== "re_signing") {
        return {
          allowed: false,
          reason: "Draft phase can only follow re-signing",
        }
      }
      return { allowed: true }
    }

    case "prepareDraft": {
      if (offseasonPhase !== "draft") {
        return {
          allowed: false,
          reason: "Draft can only be prepared during the draft phase",
        }
      }
      if (!draftRequired) {
        return { allowed: false, reason: "Draft is not required this season" }
      }
      if (draftState) {
        return { allowed: false, reason: "Draft has already been prepared" }
      }
      if (!championTeamId) {
        return {
          allowed: false,
          reason: "Champion must be determined before preparing the draft",
        }
      }
      return { allowed: true }
    }

    case "proceedToFreeAgency": {
      if (offseasonPhase !== "draft") {
        return {
          allowed: false,
          reason: "Free agency phase can only follow the draft",
        }
      }
      if (!draftState?.completed) {
        return {
          allowed: false,
          reason: "Draft must be completed before free agency",
        }
      }
      return { allowed: true }
    }

    case "simAiFreeAgency": {
      if (offseasonPhase !== "free_agency") {
        return {
          allowed: false,
          reason: "AI free agency can only run during free agency",
        }
      }
      if (!aiRosterNeedsFilling(league)) {
        return {
          allowed: false,
          reason: "All AI teams already have full rosters",
        }
      }
      return { allowed: true }
    }

    case "startNextSeason": {
      if (!isOffseason) {
        return {
          allowed: false,
          reason:
            "Season must be in the offseason before starting the next season",
        }
      }
      if (offseasonPhase !== "free_agency") {
        return {
          allowed: false,
          reason:
            "Season must reach free agency before starting the next season",
        }
      }
      if (draftRequired && !draftState?.completed) {
        return {
          allowed: false,
          reason: "Draft must be completed before starting the next season",
        }
      }
      if (league.userTeamId) {
        if (rosterOverLimit) {
          return {
            allowed: false,
            reason: `Roster over limit (${userRosterSize}/${ROSTER_MAX}) — release players before starting the next season`,
          }
        }
        if (userRosterSize < ROSTER_MAX) {
          return {
            allowed: false,
            reason: `Roster under limit (${userRosterSize}/${ROSTER_MAX}) — add or keep players before starting the next season`,
          }
        }
      }
      return { allowed: true }
    }

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

export function getAllPhaseEligibility(
  league: LeagueRecord
): Record<PhaseAction, EligibilityResult> {
  return Object.fromEntries(
    PHASE_ACTIONS.map((action) => [action, getPhaseEligibility(league, action)])
  ) as Record<PhaseAction, EligibilityResult>
}

export function assertPhaseEligibility(
  league: LeagueRecord,
  action: PhaseAction
): void {
  const result = getPhaseEligibility(league, action)
  if (!result.allowed) {
    throw new Error(result.reason)
  }
}
