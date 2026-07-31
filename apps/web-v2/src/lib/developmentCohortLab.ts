import { runCareerCohort } from "@workspace/calibration"
import type { CareerCohortReport } from "@workspace/domain-v2"

export const DEVELOPMENT_COHORT_REPORT_VERSION = 1

export const DEVELOPMENT_COHORT_PRESETS = [
  {
    id: "balanced-rookies",
    label: "Balanced rookies",
    description: "A broad baseline for first-year development outcomes.",
  },
  {
    id: "high-volatility",
    label: "High volatility",
    description:
      "Wider outcomes with more pronounced late breakouts and busts.",
  },
  {
    id: "durable-veterans",
    label: "Durable veterans",
    description:
      "Established players with later skill growth and strong availability.",
  },
] as const

export type DevelopmentCohortPresetId =
  (typeof DEVELOPMENT_COHORT_PRESETS)[number]["id"]

export type DevelopmentCohortOptions = {
  presetId: DevelopmentCohortPresetId
  comparisonPresetId: DevelopmentCohortPresetId
  seed: string
  sampleSize: number
  careerYears: 3 | 5 | 10
  minutesContext: "low" | "typical" | "high"
  coachingContext: "weak" | "standard" | "strong"
}

export type DevelopmentSkill =
  "shooting" | "creation" | "defense" | "athleticism"

export type CohortYear = {
  year: number
  age: number
  overall: number
  shooting: number
  creation: number
  defense: number
  athleticism: number
  availability: number
  developmentEvents: number
}

export type DevelopmentCohort = {
  id: string
  label: string
  description: string
  players: number
  startingAge: number
  peakAge: number
  averageNetChange: number
  availability: number
  retirementRate: number
  years: Array<CohortYear>
}

export type DevelopmentCohortReport = {
  version: number
  generatedAt: string
  options: DevelopmentCohortOptions
  cohorts: [DevelopmentCohort, DevelopmentCohort]
  diagnostics: {
    failedSeeds: number
    forecastAccuracy: number
    injuryRecoveryRate: number
    notes: Array<string>
  }
}

export const DEFAULT_DEVELOPMENT_COHORT_OPTIONS: DevelopmentCohortOptions = {
  presetId: "balanced-rookies",
  comparisonPresetId: "high-volatility",
  seed: "career-cohort-01",
  sampleSize: 1000,
  careerYears: 5,
  minutesContext: "typical",
  coachingContext: "standard",
}

const PRESET_CONTEXT: Record<
  DevelopmentCohortPresetId,
  {
    age: number
    developmentContext: "standard" | "high-volatility"
    injuryContext: "healthy" | "normal" | "injured"
  }
> = {
  "balanced-rookies": {
    age: 20,
    developmentContext: "standard",
    injuryContext: "normal",
  },
  "high-volatility": {
    age: 20,
    developmentContext: "high-volatility",
    injuryContext: "injured",
  },
  "durable-veterans": {
    age: 28,
    developmentContext: "standard",
    injuryContext: "healthy",
  },
}

function average(values: Array<number>): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function createCohort(
  presetId: DevelopmentCohortPresetId,
  options: DevelopmentCohortOptions
): { cohort: DevelopmentCohort; report: CareerCohortReport } {
  const preset = PRESET_CONTEXT[presetId]
  const report = runCareerCohort({
    seed: `${options.seed}:${presetId}`,
    startingAge: preset.age,
    sampleSize: options.sampleSize,
    runYears: options.careerYears,
    minutesContext: options.minutesContext,
    coachingContext: options.coachingContext,
    injuryContext: preset.injuryContext,
    developmentContext: preset.developmentContext,
    retainTimelines: true,
  })
  const trajectory = report.summary.skillTrajectories
  const years = trajectory.map((year, index) => {
    const snapshots = report.timelines
      ?.map((timeline) => timeline.snapshots[index])
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> =>
        Boolean(snapshot)
      )
    return {
      year: index,
      age: year.age,
      overall: year.currentAbility.average,
      shooting: year.average.shooting,
      creation: average([year.average.passing, year.average.handling]),
      defense: year.average.defense,
      athleticism: year.average.stamina,
      availability:
        Math.round(
          average(
            snapshots?.map(
              (snapshot) => snapshot.availability.availabilityRate
            ) ?? []
          ) * 1000
        ) / 10,
      developmentEvents:
        snapshots?.reduce((sum, snapshot) => sum + snapshot.events.length, 0) ??
        0,
    }
  })
  const first = years[0] ?? { overall: 0, availability: 0 }
  const last = years.at(-1) ?? first
  return {
    report,
    cohort: {
      id: `${presetId}-authoritative`,
      label: DEVELOPMENT_COHORT_PRESETS.find(
        (candidate) => candidate.id === presetId
      )!.label,
      description: DEVELOPMENT_COHORT_PRESETS.find(
        (candidate) => candidate.id === presetId
      )!.description,
      players: report.summary.playerCount,
      startingAge: preset.age,
      peakAge: report.summary.averagePeakAge,
      averageNetChange:
        Math.round((last.overall - first.overall) * 10) / 10,
      availability: last.availability,
      retirementRate: report.summary.retirementRate * 100,
      years,
    },
  }
}

export function createDevelopmentCohortReport(
  options: DevelopmentCohortOptions
): DevelopmentCohortReport {
  const primary = createCohort(options.presetId, options)
  const comparison = createCohort(options.comparisonPresetId, options)
  return {
    version: DEVELOPMENT_COHORT_REPORT_VERSION,
    generatedAt: "deterministic-lab",
    options: { ...options },
    cohorts: [primary.cohort, comparison.cohort],
    diagnostics: {
      failedSeeds:
        primary.report.failedFixtures.length +
        comparison.report.failedFixtures.length,
      forecastAccuracy: Math.round(
        average([
          primary.report.summary.potentialForecastVsRealizedPeak.correlation,
          comparison.report.summary.potentialForecastVsRealizedPeak.correlation,
        ]) * 100
      ),
      injuryRecoveryRate: Math.round(
        average([
          primary.report.summary.availabilityRate,
          comparison.report.summary.availabilityRate,
        ]) * 100
      ),
      notes: [
        "Report generated by the authoritative V2 career transition engine.",
        "Availability is shown as a percentage of the cohort active at each year.",
        "True trajectory, forecast, and realized production remain separate contracts.",
      ],
    },
  }
}

export function validateDevelopmentCohortOptions(
  options: DevelopmentCohortOptions
): Array<string> {
  const errors: Array<string> = []
  if (!options.seed.trim()) errors.push("A deterministic seed is required.")
  if (options.sampleSize < 100 || options.sampleSize > 10000) {
    errors.push("Sample size must be between 100 and 10,000 players.")
  }
  if (options.presetId === options.comparisonPresetId) {
    errors.push("Choose two different cohorts to compare.")
  }
  return errors
}

export function serializeDevelopmentCohortReport(
  report: DevelopmentCohortReport
): string {
  return JSON.stringify(
    {
      schema: "foh-development-cohort-lab",
      ...report,
    },
    null,
    2
  )
}
