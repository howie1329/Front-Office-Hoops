import type {
  CoachingPace,
  CoachingRotation,
  DefensiveScheme,
  OffensiveScheme,
} from "./gameSimTypes"

export type StaffRole =
  | "head_coach"
  | "offensive_coordinator"
  | "defensive_coordinator"
  | "scouting_head"

export type StaffSource = "employed" | "market" | "college"

export type StaffRatings = {
  overall: number
  offense: number
  defense: number
  scouting: number
  development: number
}

export type StaffMember = {
  id: string
  firstName: string
  lastName: string
  role: StaffRole
  teamId: string | null
  source: StaffSource
  age: number
  /** Prevents lifecycle callers from aging a staff member more than once per season. */
  lastAgedSeason: number
  ratings: StaffRatings
  preferredOffense: OffensiveScheme
  preferredDefense: DefensiveScheme
  /** Head coach only */
  pace?: CoachingPace
  /** Head coach only */
  rotation?: CoachingRotation
  /** College pipeline only */
  potential?: number
  /** College pipeline only */
  seasonsInCollege?: number
}

export type StaffCareerSnapshot = {
  id: string
  staffId: string
  season: number
  teamId: string
  role: StaffRole
  age: number
  wins: number
  losses: number
  madePlayoffs: boolean
  wonChampionship: boolean
}

export type StaffRetirementEntry = {
  staffId: string
  season: number
  age: number
  role: StaffRole
  teamId: string | null
  reason: "age"
}

export type StaffOffer = {
  years: number
  firstYearSalary: number
}

export type StaffExtensionOffer = {
  years: number
  firstYearSalary: number
}
