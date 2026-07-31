import { describe, expect, it } from "vitest"

import {
  createMatchedVariantSettings,
  DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
  validateDevelopmentCohortOptions,
} from "./developmentCohortLab"

describe("career cohort lab options", () => {
  it("keeps report validation explicit", () => {
    expect(
      validateDevelopmentCohortOptions({
        ...DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
        mode: "comparison",
        seed: "",
        sampleSize: 20,
        comparisonSetting: "growthRateScale",
        comparisonValue: 1.6,
      })
    ).toEqual([
      "A deterministic seed is required.",
      "Sample size must be between 100 and 10,000 players.",
      "Choose a different comparison value.",
    ])
  })

  it("rejects invalid engine settings before a run starts", () => {
    expect(
      validateDevelopmentCohortOptions({
        ...DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
        settings: { growthRateScale: 4 },
      })
    ).toEqual(["Growth rate scale must be between 0.25 and 3."])
  })

  it("changes only the selected matched setting", () => {
    const variant = createMatchedVariantSettings({
      ...DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
      mode: "comparison",
      comparisonSetting: "growthMultipliers.fast",
      comparisonValue: 1.8,
    })

    expect(variant.growthMultipliers).toMatchObject({ fast: 1.8 })
    expect(variant.growthMultipliers?.standard).toBe(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS.settings?.growthMultipliers?.standard
    )
    expect(variant.declineMultipliers).toEqual(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS.settings?.declineMultipliers
    )
    expect(variant.growthRateScale).toBe(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS.settings?.growthRateScale
    )
  })
})
