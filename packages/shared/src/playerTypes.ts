import type { DraftInfo } from "./draftTypes"
import type { PlayerInjuryHistory } from "./developmentTypes"
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

export type ProspectType = "tools" | "polish" | "balanced" | "camp_fringe"

export type PlayerStatus = "active" | "injured" | "inactive" | "free_agent"

export type PlayerInjury = {
  type: "minor" | "moderate" | "major"
  gamesRemaining: number
  description: string
}

export type PlayerMood = {
  money: number
  winning: number
  loyalty: number
  fame: number
}

export type { PlayerInjuryHistory } from "./developmentTypes"

export type SkillKey =
  | "threePoint"
  | "midRange"
  | "freeThrow"
  | "inside"
  | "passing"
  | "ballHandling"
  | "rebounding"
  | "defense"
  | "stamina"
  | "offensiveIQ"
  | "defensiveIQ"

export type SkillRatings = Record<SkillKey, number>

export type PlayerRatings = SkillRatings & {
  overall: number
  potential: number
  usage: number
  fuzz: Record<SkillKey, number>
  /** Deterministic uncertainty shown to teams with different scouting quality. */
  potentialFuzz?: number
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
  wingspanInches: number
  reachRating: number
  position: PlayerPosition
  archetype: PlayerArchetype
  ratings: PlayerRatings
  tags: PlayerTag[]
  status: PlayerStatus
  injury: PlayerInjury | null
  draftInfo: DraftInfo | null
  activeContractId: string | null
  seasonsWithTeam: number
  yearsOfService: number
  mood: PlayerMood
  performanceDrift: number
  careerPeakOverall: number
  developmentMomentum: number
  injuryHistory: PlayerInjuryHistory
  reinventionSeasonsRemaining: number
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
  | "star"
  | "starter"
  | "sixth_man"
  | "rotation"
  | "bench"

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
