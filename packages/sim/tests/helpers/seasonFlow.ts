import type { LeagueRecord } from "@workspace/shared/types"

import { applyLeagueCommand } from "../../src/leagueCommands"

export function withRegularSeason(league: LeagueRecord): LeagueRecord {
  if (league.seasonState.phase === "regular") {
    return league
  }

  return applyLeagueCommand(league, { type: "skipRemainingExhibitions" })
}

export function withPreseasonComplete(league: LeagueRecord): LeagueRecord {
  let next = league
  let safety = 0

  while (
    next.seasonState.phase === "preseason" &&
    next.seasonState.schedule.some(
      (game) => game.gameType === "exhibition" && game.status === "scheduled",
    ) &&
    safety < 100
  ) {
    next = applyLeagueCommand(next, { type: "simDay" })
    safety += 1
  }

  return next
}
