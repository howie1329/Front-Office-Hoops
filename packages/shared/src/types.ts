import type { PlayerGameStats, QuarterScores, TeamWithRoster } from "./playerTypes"

export type Team = {
  id: string
  name: string
  abbrev: string
  overall: number
  pace: number
  conferenceId?: string
  divisionId?: string
}

export type TeamMatchupInput = {
  home: TeamWithRoster
  away: TeamWithRoster
  homeCourtAdvantage?: number
}

export type TeamMatchupMeta = {
  homePossessions: number
  awayPossessions: number
  homeOffRtg: number
  awayOffRtg: number
}

export type TeamMatchupResult = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  winnerId: string
  meta: TeamMatchupMeta
  homeQuarterScores: QuarterScores
  awayQuarterScores: QuarterScores
  homePlayerStats: PlayerGameStats[]
  awayPlayerStats: PlayerGameStats[]
}

export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  normal: (mean?: number, stdDev?: number) => number
}

export type {
  ID,
  Player,
  PlayerGameStats,
  PlayerPosition,
  PlayerRatings,
  PlayerStatus,
  QuarterScores,
  RotationEntry,
  TeamWithRoster,
} from "./playerTypes"

export type {
  Game,
  PlayerSeasonStats,
  ScheduleConfig,
  ScheduleGame,
  ScheduleGameStatus,
  SeasonState,
  SimulateGameContext,
  Standing,
} from "./seasonTypes"

export {
  SAVE_VERSION,
  type League,
  type LeagueRecord,
  type LeagueSummary,
} from "./leagueTypes"
