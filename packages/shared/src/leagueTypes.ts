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
import type {
  PlayerDevelopmentRecord,
  PreseasonDevelopmentReport,
  RetirementEntry,
} from "./developmentTypes"
import type { SeasonAward } from "./awardTypes"
import type {
  SeasonHistoryEntry,
  SeasonPhase,
  SeasonState,
} from "./seasonTypes"
import type { StaffMember } from "./coachTypes"
import type { StaffContract } from "./staffContractTypes"
import type { PendingTradeOffer, TradeHistoryEntry } from "./tradeTypes"

export const SAVE_VERSION = 15 as const

export type DraftClassCache = {
  season: number
  overallOffset: number
  potentialOffset: number
  pickValues: number[]
}

export type League = {
  id: string
  name: string
  saveVersion: typeof SAVE_VERSION
  createdAt: string
  updatedAt: string
  userTeamId: string | null
  rngNonce: number
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
  pendingTradeOffers: PendingTradeOffer[]
  draftClassCache: DraftClassCache | null
  leagueLog: LeagueLogEntry[]
  owners: Owner[]
  ownerGoals: OwnerGoal[]
  seasonAwards: SeasonAward[]
  playerCareerSnapshots: PlayerCareerSnapshot[]
  playerSeasonProfiles: PlayerSeasonProfile[]
  playerDevelopmentRecords: PlayerDevelopmentRecord[]
  developmentReports: PreseasonDevelopmentReport[]
  retiredPlayers: RetirementEntry[]
  staff: StaffMember[]
  staffContracts: StaffContract[]
  collegeCoaches: StaffMember[]
}

export type LeagueSummary = Pick<
  League,
  "id" | "name" | "updatedAt" | "userTeamId"
> & {
  teamCount: number
  season: number
  phase: SeasonPhase
  /** Name of the user's team, or null before a team is picked. */
  teamName: string | null
  wins: number | null
  losses: number | null
}
