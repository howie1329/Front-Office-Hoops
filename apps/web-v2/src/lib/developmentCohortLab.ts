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

const PRESET_ADJUSTMENTS: Record<
  DevelopmentCohortPresetId,
  {
    label: string
    description: string
    age: number
    growth: number
    volatility: number
    availability: number
    peakAge: number
  }
> = {
  "balanced-rookies": {
    label: "Balanced rookies",
    description: "A broad baseline for first-year development outcomes.",
    age: 20,
    growth: 5.2,
    volatility: 1.4,
    availability: 0.91,
    peakAge: 27,
  },
  "high-volatility": {
    label: "High volatility",
    description:
      "Wider outcomes with more pronounced late breakouts and busts.",
    age: 20,
    growth: 5.6,
    volatility: 3.1,
    availability: 0.86,
    peakAge: 26,
  },
  "durable-veterans": {
    label: "Durable veterans",
    description:
      "Established players with later skill growth and strong availability.",
    age: 28,
    growth: 1.3,
    volatility: 0.9,
    availability: 0.96,
    peakAge: 29,
  },
}

function seedOffset(seed: string): number {
  return (
    [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) %
    11
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function createCohort(
  presetId: DevelopmentCohortPresetId,
  options: DevelopmentCohortOptions,
  index: number
): DevelopmentCohort {
  const preset = PRESET_ADJUSTMENTS[presetId]
  const offset = seedOffset(options.seed) + index * 2
  const minutesAdjustment = { low: -0.8, typical: 0, high: 0.9 }[
    options.minutesContext
  ]
  const coachingAdjustment = { weak: -0.9, standard: 0, strong: 1.1 }[
    options.coachingContext
  ]
  const growth =
    preset.growth + minutesAdjustment + coachingAdjustment + (offset - 5) / 10
  const years = Array.from({ length: options.careerYears + 1 }, (_, year) => {
    const agingEffect =
      preset.age > 25 ? -year * 0.9 : year < 4 ? year * 0.7 : -(year - 3) * 0.6
    const development = year === 0 ? 0 : growth * (year < 3 ? 1 : 0.65)
    const overall = clamp(
      61 + development + agingEffect + (index ? 1.7 : 0),
      35,
      86
    )
    return {
      year,
      age: preset.age + year,
      overall: Math.round(overall * 10) / 10,
      shooting:
        Math.round(
          clamp(
            58 + year * (growth * 0.55) + agingEffect * 0.35 + index * 2,
            30,
            90
          ) * 10
        ) / 10,
      creation:
        Math.round(
          clamp(
            60 + year * (growth * 0.7) + agingEffect * 0.55 + index * 1.5,
            30,
            90
          ) * 10
        ) / 10,
      defense:
        Math.round(
          clamp(
            62 + year * (growth * 0.35) + agingEffect * 0.7 + index * 1.2,
            30,
            90
          ) * 10
        ) / 10,
      athleticism:
        Math.round(
          clamp(
            65 + year * (growth * 0.18) + agingEffect * 1.2 + index * 0.8,
            30,
            90
          ) * 10
        ) / 10,
      availability:
        Math.round(
          clamp(
            preset.availability -
              year * (preset.age > 25 ? 0.006 : 0.003) -
              index * 0.008,
            0.65,
            0.99
          ) * 1000
        ) / 10,
      developmentEvents:
        year === 0
          ? 0
          : Math.max(
              1,
              Math.round(3 + growth / 2 + (index ? 1 : 0) - year * 0.15)
            ),
    }
  })

  return {
    id: `${presetId}-${index}`,
    label: preset.label,
    description: preset.description,
    players: options.sampleSize,
    startingAge: preset.age,
    peakAge: preset.peakAge,
    averageNetChange:
      Math.round((years[years.length - 1].overall - years[0].overall) * 10) /
      10,
    availability: years[years.length - 1].availability,
    retirementRate:
      Math.round(
        (preset.age > 25
          ? 0.025 + options.careerYears * 0.006
          : 0.004 + options.careerYears * 0.002 + index * 0.002) * 1000
      ) / 10,
    years,
  }
}

export function createDevelopmentCohortReport(
  options: DevelopmentCohortOptions
): DevelopmentCohortReport {
  return {
    version: DEVELOPMENT_COHORT_REPORT_VERSION,
    generatedAt: "fixture",
    options: { ...options },
    cohorts: [
      createCohort(options.presetId, options, 0),
      createCohort(options.comparisonPresetId, options, 1),
    ],
    diagnostics: {
      failedSeeds: options.sampleSize < 500 ? 2 : 0,
      forecastAccuracy: 72 + (seedOffset(options.seed) % 8),
      injuryRecoveryRate: 78 + (seedOffset(options.seed) % 6),
      notes: [
        "Fixture preview only: no authoritative development transition has run.",
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
