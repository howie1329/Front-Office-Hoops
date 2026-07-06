export type PlayerCareerSnapshot = {
  id: string
  playerId: string
  season: number
  teamId: string
  age: number
  overall: number
  potential: number
  contractSalary: number
  contractYearsRemaining: number
  gp: number
  gs: number
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  awards: string[]
}

export type PlayerSeasonProfileRole =
  | "star"
  | "starter"
  | "sixth_man"
  | "rotation"
  | "bench"
  | "inactive"

export type PlayerSeasonProfile = {
  id: string
  playerId: string
  teamId: string
  season: number
  gp: number
  gs: number
  totalMinutes: number
  mpg: number
  primaryRole: PlayerSeasonProfileRole
  gamesMissed: number
  usageRateEstimate: number
}
