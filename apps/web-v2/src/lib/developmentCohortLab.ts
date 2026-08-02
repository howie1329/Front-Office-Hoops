import type {
  CareerCohortOptions,
  CareerCurveRules,
  CareerDevelopmentSettings,
  CareerDevelopmentPreset,
  CareerPopulationContext,
  CareerGrowthCurve,
  CareerDeclineCurve,
} from "@workspace/domain-v2"
import {
  STANDARD_CAREER_CURVE_RULES,
  resolveCareerDevelopmentSettings,
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
  comparisonSetting: CareerMatchedSettingPath
  comparisonValue: number
}

export type CareerMatchedSettingPath =
  | "growthRateScale"
  | "growthNoiseScale"
  | "stallChance"
  | "stallMagnitude"
  | "surgeChance"
  | "surgeMagnitude"
  | "growthTransitionChance"
  | "declineTransitionChance"
  | `growthMultipliers.${CareerGrowthCurve}`
  | `declineMultipliers.${CareerDeclineCurve}`

export type CareerMatchedSettingDescriptor = {
  path: CareerMatchedSettingPath
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}

export const CAREER_MATCHED_SETTING_OPTIONS: Array<CareerMatchedSettingDescriptor> =
  [
    {
      path: "growthRateScale",
      label: "Growth rate scale",
      min: 0.25,
      max: 3,
      step: 0.05,
      defaultValue: 1.25,
    },
    {
      path: "growthNoiseScale",
      label: "Growth noise scale",
      min: 0,
      max: 3,
      step: 0.05,
      defaultValue: 1.25,
    },
    {
      path: "stallChance",
      label: "Development stall chance",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.1,
    },
    {
      path: "stallMagnitude",
      label: "Development stall magnitude",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.15,
    },
    {
      path: "surgeChance",
      label: "Development surge chance",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.1,
    },
    {
      path: "surgeMagnitude",
      label: "Development surge magnitude",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.15,
    },
    {
      path: "growthTransitionChance",
      label: "Growth curve transition chance",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.01,
    },
    {
      path: "declineTransitionChance",
      label: "Decline curve transition chance",
      min: 0,
      max: 1,
      step: 0.01,
      defaultValue: 0.01,
    },
    ...(["slow", "standard", "fast", "elite"] as const).map(
      (curve): CareerMatchedSettingDescriptor => ({
        path: `growthMultipliers.${curve}`,
        label: `Growth ${curve} multiplier`,
        min: 0.1,
        max: 3,
        step: 0.05,
        defaultValue: STANDARD_CAREER_CURVE_RULES.growthMultipliers[curve],
      })
    ),
    ...(["durable", "standard", "early", "steep"] as const).map(
      (curve): CareerMatchedSettingDescriptor => ({
        path: `declineMultipliers.${curve}`,
        label: `Decline ${curve} multiplier`,
        min: 0.1,
        max: 3,
        step: 0.05,
        defaultValue: STANDARD_CAREER_CURVE_RULES.declineMultipliers[curve],
      })
    ),
  ]

const DEFAULT_CAREER_DEVELOPMENT_SETTINGS: CareerDevelopmentSettings =
  structuredClone(STANDARD_CAREER_CURVE_RULES)

export const DEFAULT_DEVELOPMENT_COHORT_OPTIONS: DevelopmentCohortOptions = {
  mode: "cohort",
  presetId: "balanced-rookies",
  comparisonSetting: "growthRateScale",
  comparisonValue: 1.25,
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

export function getMatchedSettingDescriptor(
  path: CareerMatchedSettingPath
): CareerMatchedSettingDescriptor {
  return (
    CAREER_MATCHED_SETTING_OPTIONS.find((setting) => setting.path === path) ??
    CAREER_MATCHED_SETTING_OPTIONS[0]
  )
}

export function createMatchedVariantSettings(
  options: DevelopmentCohortOptions
): CareerDevelopmentSettings {
  const path = options.comparisonSetting
  const variant: CareerDevelopmentSettings = { ...options.settings }
  if (path.startsWith("growthMultipliers.")) {
    const curve = path.slice("growthMultipliers.".length) as CareerGrowthCurve
    return {
      ...variant,
      growthMultipliers: {
        ...variant.growthMultipliers,
        [curve]: options.comparisonValue,
      },
    }
  }
  if (path.startsWith("declineMultipliers.")) {
    const curve = path.slice("declineMultipliers.".length) as CareerDeclineCurve
    return {
      ...variant,
      declineMultipliers: {
        ...variant.declineMultipliers,
        [curve]: options.comparisonValue,
      },
    }
  }
  return { ...variant, [path]: options.comparisonValue }
}

function getResolvedMatchedSetting(
  rules: CareerCurveRules,
  path: CareerMatchedSettingPath
): number {
  if (path.startsWith("growthMultipliers.")) {
    const curve = path.slice("growthMultipliers.".length) as CareerGrowthCurve
    return rules.growthMultipliers[curve]
  }
  if (path.startsWith("declineMultipliers.")) {
    const curve = path.slice("declineMultipliers.".length) as CareerDeclineCurve
    return rules.declineMultipliers[curve]
  }
  switch (path) {
    case "growthRateScale":
      return rules.growthRateScale
    case "growthNoiseScale":
      return rules.growthNoiseScale
    case "stallChance":
      return rules.stallChance
    case "stallMagnitude":
      return rules.stallMagnitude
    case "surgeChance":
      return rules.surgeChance
    case "surgeMagnitude":
      return rules.surgeMagnitude
    case "growthTransitionChance":
      return rules.growthTransitionChance
    case "declineTransitionChance":
      return rules.declineTransitionChance
  }
  return rules.growthRateScale
}

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
  if (
    !(CAREER_RUN_HORIZONS as ReadonlyArray<number>).includes(options.runYears)
  ) {
    errors.push("Run horizon must be 1, 5, 10, 20, or 30 years.")
  }
  const settingsErrors = validateCareerDevelopmentSettings(options.settings)
  errors.push(...settingsErrors)
  if (options.mode === "comparison" && settingsErrors.length === 0) {
    const rules = resolveCareerDevelopmentSettings(options.settings)
    if (
      getResolvedMatchedSetting(rules, options.comparisonSetting) ===
      options.comparisonValue
    ) {
      errors.push("Choose a different comparison value.")
    }
    errors.push(
      ...validateCareerDevelopmentSettings(
        createMatchedVariantSettings(options)
      )
    )
  }
  return errors
}
