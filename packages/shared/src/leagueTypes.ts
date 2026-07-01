import type { SeasonState } from "./seasonTypes"

export const SAVE_VERSION = 1 as const

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
}

export type LeagueSummary = Pick<League, "id" | "name" | "updatedAt">
