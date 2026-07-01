import type { Rng, SeasonHistoryEntry, SeasonState } from "@workspace/shared/types"

import { archiveSeason } from "./archiveSeason"
import { createInitialSeason } from "./createInitialSeason"
import { finalizeSeason } from "./finalizeSeason"

export type StartNextSeasonResult = {
  seasonState: SeasonState
  historyEntry: SeasonHistoryEntry
}

export function startNextSeason(
  state: SeasonState,
  userTeamId: string | null,
  rng: Rng,
): StartNextSeasonResult {
  if (state.phase !== "complete") {
    throw new Error("Season must be complete before starting the next season")
  }

  const finalized = finalizeSeason(state)
  const historyEntry = archiveSeason(finalized, userTeamId)
  const seasonState = createInitialSeason(
    finalized.teams,
    finalized.baseSeed,
    rng,
    finalized.season + 1,
  )

  return {
    seasonState,
    historyEntry,
  }
}
