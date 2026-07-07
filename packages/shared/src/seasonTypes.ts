import type { TeamMatchupResult } from "./types"
import type { TeamWithRoster } from "./playerTypes"
import type { DraftState } from "./draftTypes"

export type ScheduleGameStatus = "scheduled" | "final"

export type GameType = "exhibition" | "regular" | "playoff"

export type ScheduleGame = {
  id: string
  season: number
  day: number
  homeTeamId: string
  awayTeamId: string
  status: ScheduleGameStatus
  gameType: GameType
  gameId?: string
  seriesId?: string
  playoffRound?: PlayoffRound
}

export type SeasonPhase =
  | "preseason"
  | "regular"
  | "playoffs"
  | "complete"
  | "offseason"
export type OffseasonPhase = "re_signing" | "draft" | "free_agency"

export type PlayoffRound = 1 | 2 | 3 | 4

export type PlayoffSeries = {
  id: string
  season: number
  round: PlayoffRound
  conferenceId?: "east" | "west"
  higherSeedTeamId: string
  lowerSeedTeamId: string
  higherSeed: number
  lowerSeed: number
  winsHigher: number
  winsLower: number
  winnerId?: string
  loserId?: string
}

export type PlayoffBracket = {
  series: PlayoffSeries[]
  championTeamId?: string
  runnerUpTeamId?: string
}

export type UserPlayoffResult =
  | "champion"
  | "runner_up"
  | "conference_finals"
  | "semifinals"
  | "first_round"
  | "missed_playoffs"

export type SeasonHistoryEntry = {
  season: number
  championTeamId: string
  runnerUpTeamId: string | null
  standings: Standing[]
  userTeamId: string | null
  userWins: number
  userLosses: number
  userPlayoffResult: UserPlayoffResult | null
  completedAt: string
}

export type Game = {
  id: string
  season: number
  day: number
  homeTeamId: string
  awayTeamId: string
  gameType?: GameType
  rngSeed: string
  rngNonce: number
  result: TeamMatchupResult
}

export type Standing = {
  teamId: string
  season: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  streak: number
}

export type PlayerSeasonStats = {
  id: string
  playerId: string
  teamId: string
  season: number
  gp: number
  gs: number
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
}

export type ScheduleConfig = {
  season: number
  teams: TeamWithRoster[]
  gamesPerTeam: number
  seasonLengthDays: number
}

export type SeasonState = {
  season: number
  teams: TeamWithRoster[]
  schedule: ScheduleGame[]
  games: Game[]
  standings: Standing[]
  playerSeasonStats: PlayerSeasonStats[]
  currentDay: number
  baseSeed: string
  phase: SeasonPhase
  offseasonPhase?: OffseasonPhase
  playoffBracket?: PlayoffBracket
  draftState?: DraftState
}

export type SimulateGameContext = {
  season: number
  day: number
  gameId: string
  baseSeed: string
  rngNonce?: number
}
