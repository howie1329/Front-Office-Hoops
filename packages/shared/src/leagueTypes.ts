import type { Contract } from "./contractTypes"
import type { LeagueFinancials, SpendingProfileEvent, TeamFinancials } from "./financialTypes"
import type { Player } from "./playerTypes"
import type { SeasonHistoryEntry, SeasonState } from "./seasonTypes"

export const SAVE_VERSION = 7 as const

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
  freeAgentPool: Player[]
  contracts: Contract[]
  leagueFinancials: LeagueFinancials
  teamFinancials: TeamFinancials[]
  spendingProfileEvents: SpendingProfileEvent[]
}

export type LeagueSummary = Pick<
  League,
  "id" | "name" | "updatedAt" | "userTeamId"
> & {
  teamCount: number
}
