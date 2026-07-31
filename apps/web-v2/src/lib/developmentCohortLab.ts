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

export const DEFAULT_DEVELOPMENT_COHORT_OPTIONS: DevelopmentCohortOptions = {
  presetId: "balanced-rookies",
  comparisonPresetId: "high-volatility",
  seed: "career-cohort-01",
  sampleSize: 1000,
  careerYears: 5,
  minutesContext: "typical",
  coachingContext: "standard",
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
