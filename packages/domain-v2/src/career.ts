import type { PlayerEntity, PlayerSkillKey, PlayerSkills } from "./types"

export type { CareerDevelopmentProfile } from "./types"

export type CareerPhase = "growth" | "plateau" | "decline"

export type CareerAvailabilitySummary = {
  gamesScheduled: number
  gamesPlayed: number
  minutes: number
  availabilityRate: number
  injuryDevelopmentPenalty: number
  injuryAffected: boolean
}

export type CareerAnnualContext = {
  season: number
  minutes: number
  gamesPlayed: number
  gamesScheduled: number
  injuryDevelopmentPenalty: number
  coachingDevelopmentEmphasis: number
}

export type CareerDevelopmentEvent = {
  id: string
  type:
    | "phase-change"
    | "skill-development"
    | "plateau-noise"
    | "injury-effect"
    | "availability"
  season: number
  playerId: string
  phase: CareerPhase
  skill: PlayerSkillKey | null
  delta: number
  summary: string
}

export type CareerTransitionResult = {
  player: PlayerEntity
  phase: CareerPhase
  skillDeltas: Record<PlayerSkillKey, number>
  events: CareerDevelopmentEvent[]
  availability: CareerAvailabilitySummary
}

export type RetirementFactor = {
  key:
    | "age"
    | "health"
    | "injury-history"
    | "current-ability"
    | "role"
    | "opportunity"
    | "contract-opportunity"
  label: string
  contribution: number
  explanation: string
}

export type CareerRetirementContext = {
  season: number
  gamesPlayed?: number
  gamesScheduled?: number
  minutes?: number
  injuryHistory?: number
  health?: number
  opportunity?: number
  contractOpportunity?: number
}

export type RetirementEvaluation = {
  eligible: boolean
  retired: boolean
  probability: number
  factors: RetirementFactor[]
}

export type CareerContextPreset = "healthy" | "normal" | "injured"
export type CareerMinutesPreset = "zero" | "low" | "typical" | "high"
export type CareerCoachingPreset = "weak" | "standard" | "strong"
export type CareerDevelopmentPreset =
  "standard" | "high-potential" | "low-potential" | "high-volatility"

export type CareerCohortOptions = {
  seed: string
  startingAge: number
  sampleSize: number
  runYears: number
  minutesContext: CareerMinutesPreset
  coachingContext: CareerCoachingPreset
  injuryContext: CareerContextPreset
  developmentContext: CareerDevelopmentPreset
  season?: number
}

export type CareerIndividualOptions = Omit<CareerCohortOptions, "sampleSize">

export type CareerSnapshot = {
  season: number
  age: number
  player: PlayerEntity
  currentAbility: number
  potentialForecast: number
  peakAge: number
  declineStartAge: number
  phase: CareerPhase
  events: CareerDevelopmentEvent[]
  availability: CareerAvailabilitySummary
  retirement: RetirementEvaluation
}

export type CareerTimeline = {
  playerId: string
  seed: string
  startingAge: number
  snapshots: CareerSnapshot[]
  finalPlayer: PlayerEntity
  retired: boolean
  retirementAge: number | null
  peakAbility: number
  realizedPeakAge: number
  plateauLength: number
}

export type CareerSkillTrajectory = {
  season: number
  age: number
  activePlayers: number
  average: PlayerSkills
  p10: PlayerSkills
  median: PlayerSkills
  p90: PlayerSkills
  currentAbility: {
    average: number
    p10: number
    median: number
    p90: number
  }
}

export type CareerRetirementAgeDistribution = {
  age: number
  count: number
  rate: number
}

export type CareerCohortSummary = {
  playerCount: number
  startingAge: number
  runYears: number
  skillTrajectories: CareerSkillTrajectory[]
  averagePeakAge: number
  averageDeclineStartAge: number
  averagePlateauLength: number
  growthToPeak: number
  declineRate: number
  breakoutRate: number
  bustRate: number
  lateBloomerRate: number
  availabilityRate: number
  injuryAffectedSeasons: number
  retirementRate: number
  retirementAgeDistribution: CareerRetirementAgeDistribution[]
  potentialForecastVsRealizedPeak: {
    averageForecast: number
    averageRealizedPeak: number
    correlation: number
  }
  failedSeeds: string[]
  outlierTimelines: CareerTimeline[]
}

export type CareerBenchmarkCheck = {
  metric: string
  actual: number
  target: { min: number; max: number }
  passed: boolean
}

export type CareerBenchmarkResult = {
  profileId: string
  label: string
  passed: boolean
  checks: Record<string, CareerBenchmarkCheck>
}

export type FailedCareerFixture = {
  seed: string
  message: string
  playerId?: string
}

export type CareerCohortReport = {
  schema: "foh-career-cohort-lab"
  version: 1
  options: CareerCohortOptions
  completed: number
  cancelled: boolean
  summary: CareerCohortSummary
  timelines?: CareerTimeline[]
  benchmark: CareerBenchmarkResult | null
  failedFixtures: FailedCareerFixture[]
}

export type CareerIndividualReport = {
  schema: "foh-career-individual-lab"
  version: 1
  options: CareerIndividualOptions
  timeline: CareerTimeline
  failedFixtures: FailedCareerFixture[]
}
