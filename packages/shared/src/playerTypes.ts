import type { DraftInfo } from "./draftTypes"
import type { Team } from "./teamTypes"

export type { DraftInfo, DraftPick, DraftProspect, DraftSelection, DraftState } from "./draftTypes"

export type ID = string

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C"

export type PlayerTag = string

export type PlayerStatus = "active" | "injured" | "inactive" | "free_agent"

export type SkillKey =
  | "shooting"
  | "inside"
  | "passing"
  | "rebounding"
  | "defense"
  | "stamina"

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
  teamId: ID | null
  firstName: string
  lastName: string
  age: number
  peakAge: number
  heightInches: number
  weightLbs: number
  position: PlayerPosition
  ratings: PlayerRatings
  tags: PlayerTag[]
  status: PlayerStatus
  injury: null
  draftInfo: DraftInfo | null
  activeContractId: string | null
  seasonsWithTeam: number
  yearsOfService: number
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

export type QuarterScores = [number, number, number, number]
