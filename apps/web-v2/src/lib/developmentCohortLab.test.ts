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
})
