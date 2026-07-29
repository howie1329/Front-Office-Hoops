import { describe, expect, it } from "vitest"

import {
  createStandardPlayerGenerationConfig,
  STANDARD_PLAYER_GENERATION_CONFIG,
} from "../src"

describe("standard player generation config", () => {
  it("uses the approved standard population defaults", () => {
    const config = createStandardPlayerGenerationConfig()

    expect(config).toMatchObject({
      version: 4,
      age: { min: 19, max: 34 },
      ratingBounds: { min: 25, max: 92 },
      talentDistribution: {
        center: 50,
        spread: 10,
        shape: "long-tailed",
      },
      traitFrequency: 0.35,
      starTailFrequency: {
        above70: 0.1,
        above80: 0.02,
        above90: 0.002,
      },
      development: {
        potential: {
          center: 8,
          spread: 5,
          maxHeadroom: 25,
          shape: "long-tailed",
        },
      },
    })
  })

  it("keeps correlations bounded and star frequencies ordered", () => {
    const config = STANDARD_PLAYER_GENERATION_CONFIG

    expect(config.starTailFrequency.above70).toBeGreaterThan(
      config.starTailFrequency.above80
    )
    expect(config.starTailFrequency.above80).toBeGreaterThan(
      config.starTailFrequency.above90
    )

    for (const correlation of config.skillCorrelations) {
      expect(correlation.strength).toBeGreaterThanOrEqual(-1)
      expect(correlation.strength).toBeLessThanOrEqual(1)
      expect(correlation.first).not.toBe(correlation.second)
    }
  })

  it("returns an independent config copy", () => {
    const first = createStandardPlayerGenerationConfig()
    const second = createStandardPlayerGenerationConfig()

    first.availableTraits.push("test-only")

    expect(second.availableTraits).not.toContain("test-only")
  })
})
