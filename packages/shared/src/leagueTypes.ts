import type { Contract } from "./contractTypes"
import type {
  LeagueFinancials,
  SpendingProfileEvent,
  TeamFinancials,
} from "./financialTypes"
import type { Player } from "./playerTypes"
import type { DraftPickAsset } from "./draftTypes"
import type { LeagueLogEntry } from "./logTypes"
import type { Owner, OwnerGoal } from "./ownerTypes"
import type {
  PlayerCareerSnapshot,
  PlayerSeasonProfile,
} from "./playerProfileTypes"
import type { SeasonAward } from "./awardTypes"
import type { SeasonHistoryEntry, SeasonState } from "./seasonTypes"
import type { TradeHistoryEntry } from "./tradeTypes"

export const SAVE_VERSION = 9 as const

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
  draftPickAssets: DraftPickAsset[]
  tradeHistory: TradeHistoryEntry[]
  leagueLog: LeagueLogEntry[]
  owners: Owner[]
  ownerGoals: OwnerGoal[]
  seasonAwards: SeasonAward[]
  playerCareerSnapshots: PlayerCareerSnapshot[]
  playerSeasonProfiles: PlayerSeasonProfile[]
}

export type LeagueSummary = Pick<
  League,
  "id" | "name" | "updatedAt" | "userTeamId"
> & {
  teamCount: number
}
