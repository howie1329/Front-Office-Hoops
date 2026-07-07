import type {
  PlayerArchetype,
  PlayerPosition,
  PlayerRatings,
  ProspectType,
} from "./playerTypes"

export type DraftInfo = {
  year: number
  round: 1 | 2
  overallPick: number
  originalTeamId: string
}

export type DraftPickProtection = null

export type DraftProspect = {
  id: string
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
  prospectType: ProspectType
  ratings: PlayerRatings
  tags: string[]
}

export type DraftPick = {
  assetId?: string
  overallPick: number
  round: 1 | 2
  pickInRound: number
  teamId: string
  originalTeamId: string
  playerId: string | null
}

export type DraftPickAsset = {
  id: string
  originalTeamId: string
  currentTeamId: string
  season: number
  round: 1 | 2
  protection: DraftPickProtection
}

export type DraftSelection = {
  overallPick: number
  round: 1 | 2
  teamId: string
  playerId: string
  prospectId: string
}

export type DraftState = {
  year: number
  prospects: DraftProspect[]
  order: DraftPick[]
  currentPickIndex: number
  completed: boolean
  selections: DraftSelection[]
}
