import type { SkillKey } from "./playerTypes"

export type PlayerInjuryHistory = {
  totalGamesMissed: number
  majorInjuryCount: number
  lastMajorInjurySeason: number | null
}

export type PotentialRange = {
  low: number
  mid: number
  high: number
}

export type PlayerDevelopmentRecord = {
  id: string
  playerId: string
  season: number
  teamId: string
  ageBefore: number
  ageAfter: number
  overallBefore: number
  overallAfter: number
  potentialBefore: number
  potentialAfter: number
  skillDeltas: Partial<Record<SkillKey, number>>
  modifierIds: string[]
  events: string[]
  momentumApplied: number
  retired: boolean
}

export type RetirementEntry = {
  playerId: string
  season: number
  age: number
  finalOverall: number
  reasons: string[]
}

export type PreseasonDevelopmentReport = {
  season: number
  topRisers: PlayerDevelopmentRecord[]
  topFallers: PlayerDevelopmentRecord[]
  breakouts: PlayerDevelopmentRecord[]
  regressions: PlayerDevelopmentRecord[]
  retirements: RetirementEntry[]
}

export const EMPTY_INJURY_HISTORY: PlayerInjuryHistory = {
  totalGamesMissed: 0,
  majorInjuryCount: 0,
  lastMajorInjurySeason: null,
}
