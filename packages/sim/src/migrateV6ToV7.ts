import type { LeagueRecord, OffseasonPhase, SeasonState } from "@workspace/shared/types"

function inferOffseasonPhase(state: SeasonState): OffseasonPhase | undefined {
  if (state.phase !== "offseason") {
    return undefined
  }

  if (state.draftState?.completed) {
    return "free_agency"
  }

  if (state.draftState) {
    return "draft"
  }

  return "re_signing"
}

export function migrateV6ToV7(record: LeagueRecord): LeagueRecord {
  const offseasonPhase = record.seasonState.offseasonPhase ?? inferOffseasonPhase(record.seasonState)

  return {
    ...record,
    seasonState: {
      ...record.seasonState,
      ...(offseasonPhase ? { offseasonPhase } : {}),
    },
  }
}
