import type { SeasonHistoryEntry, SeasonState } from "./seasonTypes"

export const SAVE_VERSION = 3 as const

export type League = {
  id: string
  name: string
  saveVersion: typeof SAVE_VERSION
  createdAt: string
  updatedAt: string
  userTeamId: string | null
}

export type LeagueRecord = League & {
  seasonState: SeasonState
  seasonHistory: SeasonHistoryEntry[]
}

export type LeagueSummary = Pick<
  League,
  "id" | "name" | "updatedAt" | "userTeamId"
> & {
  teamCount: number
}
