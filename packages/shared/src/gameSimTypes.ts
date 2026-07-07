export type CoachingPace = "slow" | "balanced" | "fast"

export type OffensiveScheme =
  | "attack_rim"
  | "balanced"
  | "perimeter"
  | "post_hub"
  | "pace_space"

export type DefensiveScheme =
  | "drop_coverage"
  | "switch_everything"
  | "zone_23"
  | "full_court_press"
  | "aggressive_help"

/** @deprecated Use OffensiveScheme */
export type CoachingOffense = OffensiveScheme

export type CoachingRotation = "tight" | "standard" | "deep"

export type CoachingPhilosophy = {
  pace: CoachingPace
  offense: OffensiveScheme
  defense: DefensiveScheme
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
