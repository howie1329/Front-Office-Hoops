import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

import { isRegularSeasonComplete } from "./isRegularSeasonComplete"

export function normalizeSeasonState(state: SeasonState): SeasonState {
  if (state.phase) {
    return state
  }

  if (state.playoffBracket?.championTeamId) {
    return { ...state, phase: "complete" }
  }

  if (state.playoffBracket) {
    return { ...state, phase: "playoffs" }
  }

  if (isRegularSeasonComplete({ ...state, phase: "regular" })) {
    return { ...state, phase: "regular" }
  }

  return { ...state, phase: "regular" }
}

export function normalizeLeagueRecord(record: LeagueRecord): LeagueRecord {
  return {
    ...record,
    seasonHistory: record.seasonHistory ?? [],
    seasonState: normalizeSeasonState(record.seasonState),
  }
}
