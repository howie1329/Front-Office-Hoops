import type { SeasonHistoryEntry, SeasonState } from "@workspace/shared/types"

import { deriveUserPlayoffResult } from "./deriveUserPlayoffResult"

export function archiveSeason(
  state: SeasonState,
  userTeamId: string | null,
): SeasonHistoryEntry {
  const championTeamId = state.playoffBracket?.championTeamId

  if (!championTeamId) {
    throw new Error("Cannot archive season without a champion")
  }

  const userStanding = userTeamId
    ? state.standings.find((standing) => standing.teamId === userTeamId)
    : undefined

  return {
    season: state.season,
    championTeamId,
    runnerUpTeamId: state.playoffBracket?.runnerUpTeamId ?? null,
    standings: state.standings.map((standing) => ({ ...standing })),
    userTeamId,
    userWins: userStanding?.wins ?? 0,
    userLosses: userStanding?.losses ?? 0,
    userPlayoffResult: deriveUserPlayoffResult(state, userTeamId),
    completedAt: new Date().toISOString(),
  }
}
