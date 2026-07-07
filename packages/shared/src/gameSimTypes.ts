export type CoachingPace = "slow" | "balanced" | "fast"
export type CoachingOffense = "attack_rim" | "balanced" | "perimeter"
export type CoachingRotation = "tight" | "standard" | "deep"

export type CoachingPhilosophy = {
  pace: CoachingPace
  offense: CoachingOffense
  rotation: CoachingRotation
}

export type SegmentKind = "q1" | "q2" | "q3" | "q4" | "ot"

export type LineupSynergyGrade = "A" | "B" | "C" | "D" | "F"

export type TeamMomentumState = {
  rollingNetRtg: number
  sampleSize: number
}

export type GameSimSegmentMeta = {
  kind: SegmentKind
  index: number
  homePoints: number
  awayPoints: number
  homePossessions: number
  awayPossessions: number
}

export type SynergyBreakdown = {
  grade: LineupSynergyGrade
  score: number
  bonuses: string[]
  penalties: string[]
}

export const DEFAULT_TEAM_MOMENTUM: TeamMomentumState = {
  rollingNetRtg: 0,
  sampleSize: 0,
}
