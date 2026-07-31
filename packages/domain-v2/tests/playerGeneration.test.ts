import { describe, expect, it } from "vitest"

import {
  createPlayerPopulationPreset,
  createStandardPlayerGenerationConfig,
  PLAYER_POPULATION_PRESET_VERSION,
  STANDARD_PLAYER_GENERATION_CONFIG,
} from "../src"

describe("standard player generation config", () => {
  it("uses the approved standard population defaults", () => {
    const config = createStandardPlayerGenerationConfig()

    expect(config).toMatchObject({
      version: 5,
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

  it("isolates the roster preset from mutations to the exported standard config", () => {
    const originalMinimumAge = STANDARD_PLAYER_GENERATION_CONFIG.age.min

    try {
      STANDARD_PLAYER_GENERATION_CONFIG.age.min = 99

      expect(
        createPlayerPopulationPreset("initial-roster").config.age.min
      ).toBe(originalMinimumAge)
    } finally {
      STANDARD_PLAYER_GENERATION_CONFIG.age.min = originalMinimumAge
    }
  })

  it("provides independent production population presets", () => {
    const roster = createPlayerPopulationPreset("initial-roster")
    const freeAgents = createPlayerPopulationPreset("initial-free-agents")
    const draftClass = createPlayerPopulationPreset("draft-class")
    const secondDraftClass = createPlayerPopulationPreset("draft-class")

    expect(roster).toMatchObject({
      version: PLAYER_POPULATION_PRESET_VERSION,
      defaultCount: 450,
      contextKind: "initial-league",
    })
    expect(freeAgents).toMatchObject({
      defaultCount: 100,
      config: {
        age: { min: 20, max: 36 },
        talentDistribution: { center: 43, spread: 9 },
        starTailFrequency: { above70: 0.02, above80: 0.002, above90: 0 },
      },
    })
    expect(draftClass).toMatchObject({
      defaultCount: 90,
      config: {
        age: { min: 18, max: 23 },
        talentDistribution: { center: 44, spread: 11 },
        development: {
          potential: { center: 14, spread: 7, maxHeadroom: 30 },
          rating: { center: 65, spread: 18 },
          volatility: { center: 50, spread: 22 },
        },
      },
    })

    draftClass.config.age.min = 99
    expect(secondDraftClass.config.age.min).toBe(18)
    expect(roster.config).toEqual(createStandardPlayerGenerationConfig())
  })
})
