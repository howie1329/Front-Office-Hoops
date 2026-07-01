import type { PlayerGameStats, TeamWithRoster } from "./playerTypes"

export type Team = {
  id: string
  name: string
  abbrev: string
  overall: number
  pace: number
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
  RotationEntry,
  TeamWithRoster,
} from "./playerTypes"
