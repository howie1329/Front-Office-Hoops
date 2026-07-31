import { describe, expect, it } from "vitest"

import {
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
        comparisonPresetId: DEFAULT_DEVELOPMENT_COHORT_OPTIONS.presetId,
      })
    ).toEqual([
      "A deterministic seed is required.",
      "Sample size must be between 100 and 10,000 players.",
      "Choose two different cohorts to compare.",
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
})
