import { describe, expect, it } from "vitest"

import {
  DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
  createDevelopmentCohortReport,
  serializeDevelopmentCohortReport,
  validateDevelopmentCohortOptions,
} from "./developmentCohortLab"

describe("development cohort lab fixtures", () => {
  it("creates reproducible paired cohort reports", () => {
    const first = createDevelopmentCohortReport(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS
    )
    const second = createDevelopmentCohortReport(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS
    )

    expect(first).toEqual(second)
    expect(first.cohorts).toHaveLength(2)
    expect(first.cohorts[0].years).toHaveLength(6)
    expect(first.cohorts[0].players).toBe(1000)
  })

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

  it("serializes a versioned debug report envelope", () => {
    const report = createDevelopmentCohortReport(
      DEFAULT_DEVELOPMENT_COHORT_OPTIONS
    )
    const serialized = JSON.parse(serializeDevelopmentCohortReport(report))

    expect(serialized).toMatchObject({
      schema: "foh-development-cohort-lab",
      version: 1,
      options: DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
    })
  })
})
