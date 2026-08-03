import type {
  PlayerEntity,
  PlayerSkills,
  LeagueEvent,
  LeagueGameRecord,
  LeaguePlayerAvailability,
  GameRotationInput,
} from "./types"
import type { CareerPhase } from "./career"
import type { ContractLifecycleStatus } from "./market"
import type {
  PlayerSeasonProduction,
  PlayerTeamSeasonSplit,
  TeamSeasonProduction,
  UniversalPlayerValue,
  LeagueProductionSummary,
} from "./seasonProduction"

export type PlayerGameLogEntry = {
  scheduleId: string
  season: number
  date: string
  kind: LeagueGameRecord["kind"]
  teamId: string
  opponentTeamId: string
  won: boolean
  boxScore: NonNullable<LeagueGameRecord["result"]["players"][string]>
}

export type PlayerRatingSnapshot = {
  season: number
  age: number
  overall: number
  skills: PlayerSkills
  phase: CareerPhase
}

export type PlayerInjuryHistoryEntry = {
  id: string
  playerId: string
  season: number
  startDate: string
  expectedReturnDate?: string
  returnDate?: string
  description: string
  gamesMissed: number
  sourceScheduleId?: string
}

export type PlayerSeasonLog = {
  season: number
  playerId: string
  total: PlayerSeasonProduction
  teamSplits: Record<string, PlayerTeamSeasonSplit>
  value?: UniversalPlayerValue
  rating?: PlayerRatingSnapshot
}

export type LeagueSeasonArchive = {
  season: number
  completedAt: string
  games: LeagueGameRecord[]
  playerProduction: Record<string, PlayerSeasonProduction>
  teamProduction: Record<string, TeamSeasonProduction>
  leagueSummary: LeagueProductionSummary
  playerValues: Record<string, UniversalPlayerValue>
  ratingSnapshots: Record<string, PlayerRatingSnapshot>
  injuries: PlayerInjuryHistoryEntry[]
  modelVersions?: {
    game: number
    production: number
    value: number
    development: number
  }
}

export type PlayerContractSummary = {
  contractId: string | null
  playerId: string
  teamId: string | null
  annualSalary: number[]
  years: number
  startSeason: number | null
  endSeason: number | null
  totalValue: number
  source: string | null
  expiringSeason: number | null
  status: ContractLifecycleStatus
  yearsRemaining: number
  remainingValue: number
}

export type PlayerInformationView = {
  player: PlayerEntity
  currentRating: PlayerRatingSnapshot
  ratingHistory: PlayerRatingSnapshot[]
  availability: LeaguePlayerAvailability
  contract: PlayerContractSummary | null
  rotation: GameRotationInput | null
  currentProduction: PlayerSeasonProduction | null
  currentValue: UniversalPlayerValue | null
  seasonLogs: PlayerSeasonLog[]
  gameLog: PlayerGameLogEntry[]
  injuries: PlayerInjuryHistoryEntry[]
  recentEvents: LeagueEvent[]
}
