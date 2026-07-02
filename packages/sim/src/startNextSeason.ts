import type { Rng, SeasonHistoryEntry, SeasonState, Player } from "@workspace/shared/types"

import { archiveSeason } from "./archiveSeason"
import { createInitialSeason } from "./createInitialSeason"
import { isDraftRequired } from "./draft/isDraftRequired"
import { finalizeSeason } from "./finalizeSeason"
import { applyAiRosterTrimming, validateRostersForSeasonStart } from "./roster/rosterManagement"

export type StartNextSeasonInput = {
  seasonState: SeasonState
  userTeamId: string | null
  freeAgentPool: Player[]
  rng: Rng
}

export type StartNextSeasonResult = {
  seasonState: SeasonState
  historyEntry: SeasonHistoryEntry
  freeAgentPool: Player[]
}

export function startNextSeason(input: StartNextSeasonInput): StartNextSeasonResult {
  const { seasonState, userTeamId, rng } = input
  let { freeAgentPool } = input

  if (seasonState.phase !== "offseason") {
    throw new Error("Season must be in the offseason before starting the next season")
  }

  if (isDraftRequired(seasonState.season)) {
    if (!seasonState.draftState?.completed) {
      throw new Error("Draft must be completed before starting the next season")
    }
  }

  if (userTeamId) {
    const userSize =
      seasonState.teams.find((team) => team.id === userTeamId)?.players.length ?? 0
    if (userSize > 12) {
      throw new Error(
        "Roster over limit — release players before starting the next season",
      )
    }
  }

  const trimmed = applyAiRosterTrimming(
    seasonState.teams,
    freeAgentPool,
    userTeamId,
  )
  freeAgentPool = trimmed.freeAgentPool

  validateRostersForSeasonStart(trimmed.teams, userTeamId)

  const stateForArchive = {
    ...seasonState,
    teams: trimmed.teams,
  }

  const finalized = finalizeSeason(stateForArchive)
  const historyEntry = archiveSeason(finalized, userTeamId)
  const nextSeasonState = createInitialSeason(
    finalized.teams,
    finalized.baseSeed,
    rng,
    finalized.season + 1,
  )

  return {
    seasonState: nextSeasonState,
    historyEntry,
    freeAgentPool,
  }
}
