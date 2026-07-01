import type { Team } from "./types"

export type ID = string

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C"

export type PlayerStatus = "active" | "injured" | "inactive"

export type PlayerRatings = {
  overall: number
  potential: number
  shooting: number
  inside: number
  passing: number
  rebounding: number
  defense: number
  stamina: number
  usage: number
}

export type Player = {
  id: ID
  teamId: ID
  firstName: string
  lastName: string
  age: number
  heightInches: number
  weightLbs: number
  position: PlayerPosition
  ratings: PlayerRatings
  status: PlayerStatus
  injury: null
  draftInfo: null
}

export type TeamWithRoster = Team & {
  players: Player[]
}

export type PlayerGameStats = {
  playerId: ID
  teamId: ID
  starter: boolean
  minutes: number
  pts: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
}

export type RotationEntry = {
  player: Player
  minutes: number
}
