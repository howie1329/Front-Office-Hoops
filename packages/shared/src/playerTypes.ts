import type { DraftInfo } from "./draftTypes"
import type { Team } from "./teamTypes"

export type {
  DraftInfo,
  DraftPick,
  DraftProspect,
  DraftSelection,
  DraftState,
} from "./draftTypes"

export type ID = string

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C"

export type PlayerTag = string

export type PlayerArchetype =
  | "lead_guard"
  | "scoring_guard"
  | "three_and_d_wing"
  | "slasher"
  | "point_forward"
  | "stretch_big"
  | "rim_protector"
  | "post_scorer"
  | "rebounding_big"
  | "defensive_specialist"
  | "bench_scorer"
  | "raw_athlete"

export type PlayerStatus = "active" | "injured" | "inactive" | "free_agent"

export type SkillKey =
  "shooting" | "inside" | "passing" | "rebounding" | "defense" | "stamina"

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
  archetype: PlayerArchetype
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

export type RotationRole =
  "star" | "starter" | "sixth_man" | "rotation" | "bench"

export type RotationEntry = {
  player: Player
  minutes: number
  role?: RotationRole
  starter?: boolean
}

export type RotationPlanEntry = {
  playerId: ID
  role: RotationRole
  targetMinutes: number
  minMinutes?: number
  maxMinutes?: number
}

export type RotationPlan = {
  teamId: ID
  source: "auto" | "user"
  entries: RotationPlanEntry[]
}

export type GameRotationEntry = RotationPlanEntry & {
  minutes: number
  starter: boolean
}

export type GameRotation = {
  teamId: ID
  source: "auto" | "user"
  entries: GameRotationEntry[]
}

export type QuarterScores = [number, number, number, number]
