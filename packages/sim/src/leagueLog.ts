import type {
  LeagueLogEntry,
  LeagueLogEntryType,
  LeagueRecord,
} from "@workspace/shared/types"

import { getCalendarDate } from "./calendar"

export function createLeagueLogEntry({
  league,
  type,
  teamId,
  playerId,
  payload = {},
  sequence = 1,
}: {
  league: LeagueRecord
  type: LeagueLogEntryType
  teamId?: string
  playerId?: string
  payload?: LeagueLogEntry["payload"]
  sequence?: number
}): LeagueLogEntry {
  const date = getCalendarDate(league.seasonState.currentDay)
  return {
    id: `log_${league.seasonState.season}_${league.seasonState.currentDay}_${league.leagueLog.length + sequence}`,
    season: league.seasonState.season,
    day: league.seasonState.currentDay,
    dateLabel: date.label,
    type,
    teamId,
    playerId,
    payload,
    createdAt: new Date().toISOString(),
  }
}

export function appendLeagueLog(
  league: LeagueRecord,
  entries: LeagueLogEntry[]
): LeagueRecord {
  return {
    ...league,
    leagueLog: [...league.leagueLog, ...entries],
  }
}
