import type { TeamMatchupResult } from "./types"
import type { TeamWithRoster } from "./playerTypes"

export type ScheduleGameStatus = "scheduled" | "final"

export type ScheduleGame = {
  id: string
  season: number
  day: number
  homeTeamId: string
  awayTeamId: string
  status: ScheduleGameStatus
  gameId?: string
}

export type Game = {
  id: string
  season: number
  day: number
  homeTeamId: string
  awayTeamId: string
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
}

export type SimulateGameContext = {
  season: number
  day: number
  gameId: string
  baseSeed: string
}
