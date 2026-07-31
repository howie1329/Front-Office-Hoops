import type {
  CareerDeclineCurve,
  CareerDeclineCurveWeights,
  CareerGrowthCurve,
  CareerGrowthCurveWeights,
  PlayerEntity,
  PlayerSkillKey,
  PlayerSkills,
} from "./types"

export type {
  CareerDeclineCurve,
  CareerDevelopmentProfile,
  CareerGrowthCurve,
} from "./types"

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
    | "development-stall"
    | "development-surge"
    | "injury-effect"
    | "availability"
    | "trajectory-change"
  season: number
  playerId: string
  phase: CareerPhase
  skill: PlayerSkillKey | null
  delta: number
  summary: string
  curveDimension?: "growth" | "decline"
  fromCurve?: CareerGrowthCurve | CareerDeclineCurve
  toCurve?: CareerGrowthCurve | CareerDeclineCurve
  reason?: "age-transition" | "calibration"
}

export type CareerTransitionResult = {
  player: PlayerEntity
  phase: CareerPhase
  skillDeltas: Record<PlayerSkillKey, number>
  events: CareerDevelopmentEvent[]
  availability: CareerAvailabilitySummary
}

export type CareerSeasonDevelopment = {
  phase: CareerPhase
  growthCurve: CareerGrowthCurve
  declineCurve: CareerDeclineCurve
  appliedGrowthMultiplier: number
  appliedDeclineMultiplier: number
  skillDeltas: Record<PlayerSkillKey, number>
  events: CareerDevelopmentEvent[]
}

export type CareerSeasonResult = {
  availability: CareerAvailabilitySummary
  retirement: RetirementEvaluation
  development: CareerSeasonDevelopment | null
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
export type CareerTimingPreset = "standard" | "early" | "late"
export type CareerPopulationContext =
  "draft-class" | "roster" | "free-agent" | "veteran"
export type CareerDevelopmentPreset =
  "standard" | "high-potential" | "low-potential" | "high-volatility"

export type CareerCurveRules = {
  growthMultipliers: Record<CareerGrowthCurve, number>
  declineMultipliers: Record<CareerDeclineCurve, number>
  growthTransitionChance: number
  declineTransitionChance: number
  growthRateScale: number
  growthNoiseScale: number
  stallChance: number
  stallMagnitude: number
  surgeChance: number
  surgeMagnitude: number
  timingPreset: CareerTimingPreset
}

export type CareerDevelopmentSettings = {
  growthMultipliers?: Partial<Record<CareerGrowthCurve, number>>
  declineMultipliers?: Partial<Record<CareerDeclineCurve, number>>
  growthTransitionChance?: number
  declineTransitionChance?: number
  growthRateScale?: number
  growthNoiseScale?: number
  stallChance?: number
  stallMagnitude?: number
  surgeChance?: number
  surgeMagnitude?: number
  timingPreset?: CareerTimingPreset
}

export type CareerResolvedSettings = CareerCurveRules & {
  settingsVersion: number
  populationContext: CareerPopulationContext
  growthCurve: CareerGrowthCurve | "distribution"
  declineCurve: CareerDeclineCurve | "distribution"
  growthCurveWeights: CareerGrowthCurveWeights
  declineCurveWeights: CareerDeclineCurveWeights
}

export type CareerCohortOptions = {
  seed: string
  startingAge: number
  sampleSize: number
  runYears: number
  minutesContext: CareerMinutesPreset
  coachingContext: CareerCoachingPreset
  injuryContext: CareerContextPreset
  developmentContext: CareerDevelopmentPreset
  populationContext: CareerPopulationContext
  growthCurve: CareerGrowthCurve | "distribution"
  declineCurve: CareerDeclineCurve | "distribution"
  settings?: CareerDevelopmentSettings
  season?: number
}

export type CareerIndividualOptions = Omit<CareerCohortOptions, "sampleSize">

export type CareerSnapshot = {
  season: number
  ageAtSeasonStart: number
  playerAtSeasonStart: PlayerEntity
  currentAbility: number
  potentialForecast: number
  peakAge: number
  declineStartAge: number
  phase: CareerPhase
  seasonResult: CareerSeasonResult
}

export type CareerTimeline = {
  playerId: string
  seed: string
  startingAge: number
  snapshots: CareerSnapshot[]
  finalPlayer: PlayerEntity
  retired: boolean
  retirementAge: number | null
  retirementSeason: number | null
  seasonsSimulated: number
  terminationReason: "retired" | "horizon-complete"
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

export type CareerPlayerSummary = {
  playerId: string
  seed: string
  startingAge: number
  finalAge: number
  finalAbility: number
  peakAbility: number
  realizedPeakAge: number
  peakAge: number
  declineStartAge: number
  growthCurve: CareerGrowthCurve
  declineCurve: CareerDeclineCurve
  retired: boolean
  retirementAge: number | null
  seasonsSimulated: number
  terminationReason: CareerTimeline["terminationReason"]
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
  version: 4
  options: CareerCohortOptions
  completed: number
  cancelled: boolean
  summary: CareerCohortSummary
  resolvedSettings: CareerResolvedSettings
  playerIndex: CareerPlayerSummary[]
  timelines?: CareerTimeline[]
  benchmark: CareerBenchmarkResult | null
  failedFixtures: FailedCareerFixture[]
}

export type CareerIndividualReport = {
  schema: "foh-career-individual-lab"
  version: 4
  options: CareerIndividualOptions
  timeline: CareerTimeline
  resolvedSettings: CareerResolvedSettings
  failedFixtures: FailedCareerFixture[]
}
