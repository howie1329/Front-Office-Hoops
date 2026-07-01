export type Team = {
  id: string
  name: string
  abbrev: string
  overall: number
  pace: number
}

export type TeamMatchupInput = {
  home: Team
  away: Team
  homeCourtAdvantage?: number
}

export type TeamMatchupMeta = {
  homePossessions: number
  awayPossessions: number
  homeOffRtg: number
  awayOffRtg: number
}

export type TeamMatchupResult = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  winnerId: string
  meta: TeamMatchupMeta
}

export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  normal: (mean?: number, stdDev?: number) => number
}
