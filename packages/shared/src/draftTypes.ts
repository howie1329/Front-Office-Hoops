import type {
  PlayerArchetype,
  PlayerPosition,
  PlayerRatings,
} from "./playerTypes"

export type DraftInfo = {
  year: number
  round: 1 | 2
  overallPick: number
  originalTeamId: string
}

export type DraftProspect = {
  id: string
  firstName: string
  lastName: string
  age: number
  peakAge: number
  heightInches: number
  weightLbs: number
  position: PlayerPosition
  archetype: PlayerArchetype
  ratings: PlayerRatings
  tags: string[]
}

export type DraftPick = {
  overallPick: number
  round: 1 | 2
  pickInRound: number
  teamId: string
  playerId: string | null
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
