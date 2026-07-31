import type {
  CareerCohortOptions,
  CareerDevelopmentSettings,
  CareerDevelopmentPreset,
  CareerPopulationContext,
  CareerGrowthCurve,
  CareerDeclineCurve,
} from "@workspace/domain-v2"
import {
  STANDARD_CAREER_CURVE_RULES,
  validateCareerDevelopmentSettings,
} from "@workspace/sim-v2"

export const DEVELOPMENT_COHORT_PRESETS = [
  {
    id: "balanced-rookies",
    label: "Balanced rookies",
    description: "A broad baseline for first-year development outcomes.",
    defaults: {
      startingAge: 19,
      populationContext: "draft-class" as CareerPopulationContext,
      developmentContext: "standard" as CareerDevelopmentPreset,
      growthCurve: "distribution" as const,
      declineCurve: "distribution" as const,
    },
  },
  {
    id: "high-volatility",
    label: "High volatility",
    description:
      "Wider outcomes with more pronounced late breakouts and busts.",
    defaults: {
      startingAge: 20,
      populationContext: "roster" as CareerPopulationContext,
      developmentContext: "high-volatility" as CareerDevelopmentPreset,
      growthCurve: "distribution" as const,
      declineCurve: "distribution" as const,
    },
  },
  {
    id: "durable-veterans",
    label: "Durable veterans",
    description:
      "Established players with later skill growth and durable decline.",
    defaults: {
      startingAge: 28,
      populationContext: "veteran" as CareerPopulationContext,
      developmentContext: "standard" as CareerDevelopmentPreset,
      growthCurve: "standard" as CareerGrowthCurve,
      declineCurve: "durable" as CareerDeclineCurve,
    },
  },
] as const

export type DevelopmentCohortPresetId =
  (typeof DEVELOPMENT_COHORT_PRESETS)[number]["id"]

export type DevelopmentCohortMode = "cohort" | "individual" | "comparison"

export type DevelopmentCohortOptions = CareerCohortOptions & {
  mode: DevelopmentCohortMode
  presetId: DevelopmentCohortPresetId
  comparisonPresetId: DevelopmentCohortPresetId
}

const DEFAULT_CAREER_DEVELOPMENT_SETTINGS: CareerDevelopmentSettings =
  structuredClone(STANDARD_CAREER_CURVE_RULES)

export const DEFAULT_DEVELOPMENT_COHORT_OPTIONS: DevelopmentCohortOptions = {
  mode: "cohort",
  presetId: "balanced-rookies",
  comparisonPresetId: "high-volatility",
  seed: "career-cohort-01",
  sampleSize: 1000,
  runYears: 10,
  startingAge: 19,
  season: 1,
  populationContext: "draft-class",
  minutesContext: "typical",
  coachingContext: "standard",
  injuryContext: "normal",
  developmentContext: "standard",
  growthCurve: "distribution",
  declineCurve: "distribution",
  settings: DEFAULT_CAREER_DEVELOPMENT_SETTINGS,
}

export const CAREER_RUN_HORIZONS = [1, 5, 10, 20, 30] as const

export function validateDevelopmentCohortOptions(
  options: DevelopmentCohortOptions
): Array<string> {
  const errors: Array<string> = []
  if (!options.seed.trim()) errors.push("A deterministic seed is required.")
  if (options.sampleSize < 100 || options.sampleSize > 10000) {
    errors.push("Sample size must be between 100 and 10,000 players.")
  }
  if (options.startingAge < 18 || options.startingAge > 40) {
    errors.push("Starting age must be between 18 and 40.")
  }
  if (!(CAREER_RUN_HORIZONS as ReadonlyArray<number>).includes(options.runYears)) {
    errors.push("Run horizon must be 1, 5, 10, 20, or 30 years.")
  }
  if (
    options.mode === "comparison" &&
    options.presetId === options.comparisonPresetId
  ) {
    errors.push("Choose two different cohorts to compare.")
  }
  errors.push(...validateCareerDevelopmentSettings(options.settings))
  return errors
}
