import { describe, expect, it } from "vitest"

import { createStandardPlayerGenerationConfig } from "@workspace/domain-v2"

import {
  createDeterministicRandom,
  generatePlayer,
  generatePlayerWithDiagnostics,
} from "../src"

const input = {
  id: "player-1",
  name: "Test Player",
  age: 24,
}

describe("generatePlayer", () => {
  it("reproduces the same profile for the same seed", () => {
    const config = createStandardPlayerGenerationConfig()

    expect(
      generatePlayer(createDeterministicRandom("player-seed"), input, config)
    ).toEqual(
      generatePlayer(createDeterministicRandom("player-seed"), input, config)
    )
  })

  it("keeps diagnostics out of the player while exposing reproducible lab facts", () => {
    const config = createStandardPlayerGenerationConfig()
    const result = generatePlayerWithDiagnostics(
      createDeterministicRandom("diagnostic-seed"),
      input,
      config
    )

    expect(result.player).toEqual(
      generatePlayer(
        createDeterministicRandom("diagnostic-seed"),
        input,
        config
      )
    )
    expect(result.diagnostics.latentTalent).toBeGreaterThanOrEqual(
      config.ratingBounds.min
    )
    expect(result.diagnostics.latentTalent).toBeLessThanOrEqual(
      config.ratingBounds.max
    )
    expect(result.diagnostics.currentAbility).toBeLessThanOrEqual(
      result.diagnostics.potentialBase
    )
    expect(result.diagnostics.latentTalent).toBeLessThanOrEqual(
      result.diagnostics.potentialBase
    )
    expect(result.diagnostics.potentialUpside).toBeGreaterThanOrEqual(0)
    expect(result.diagnostics.potentialUpside).toBeLessThanOrEqual(
      config.development.potential.maxHeadroom
    )
    expect(result.player.profile.development.potential).toBe(
      result.diagnostics.potentialBase + result.diagnostics.potentialUpside
    )
    expect(result.player).not.toHaveProperty("latentTalent")
  })

  it("generates a bounded, contract-complete profile", () => {
    const config = createStandardPlayerGenerationConfig()
    const player = generatePlayer(
      createDeterministicRandom("bounded-player-seed"),
      input,
      config
    )

    expect(player).toMatchObject({
      id: input.id,
      name: input.name,
      age: input.age,
    })
    expect(player.profile.physical.heightInches).toBeGreaterThanOrEqual(70)
    expect(player.profile.physical.heightInches).toBeLessThanOrEqual(90)
    expect(player.profile.physical.weightPounds).toBeGreaterThanOrEqual(160)
    expect(player.profile.physical.weightPounds).toBeLessThanOrEqual(300)
    expect(player.profile.physical.wingspanInches).toBeGreaterThanOrEqual(68)
    expect(player.profile.physical.wingspanInches).toBeLessThanOrEqual(98)

    const ratings = [
      player.profile.physical.speed,
      player.profile.physical.strength,
      player.profile.physical.vertical,
      player.profile.injuryResistance,
      player.profile.development.potential,
      player.profile.development.rating,
      player.profile.development.volatility,
      ...Object.values(player.profile.skills),
    ]

    expect(ratings.every((rating) => rating >= 25 && rating <= 92)).toBe(true)
    const currentAbility = Math.round(
      Object.values(player.profile.skills).reduce(
        (sum, rating) => sum + rating,
        0
      ) / Object.values(player.profile.skills).length
    )
    expect(player.profile.development.potential).toBeGreaterThanOrEqual(
      currentAbility
    )
    expect(player.profile.traits.length).toBeLessThanOrEqual(3)
  })

  it("uses an isolated potential stream without changing the existing profile", () => {
    const standardConfig = createStandardPlayerGenerationConfig()
    const higherPotentialConfig = createStandardPlayerGenerationConfig()
    higherPotentialConfig.development.potential = {
      center: 25,
      spread: 0,
      maxHeadroom: 25,
      shape: "long-tailed",
    }

    const standardPlayer = generatePlayer(
      createDeterministicRandom("potential-isolation-seed"),
      input,
      standardConfig
    )
    const higherPotentialPlayer = generatePlayer(
      createDeterministicRandom("potential-isolation-seed"),
      input,
      higherPotentialConfig
    )
    const { potential: standardPotential, ...standardDevelopment } =
      standardPlayer.profile.development
    const { potential: higherPotential, ...higherDevelopment } =
      higherPotentialPlayer.profile.development

    expect(higherPotential).toBeGreaterThanOrEqual(standardPotential)
    expect(higherDevelopment).toEqual(standardDevelopment)
    expect({
      ...higherPotentialPlayer.profile,
      development: higherDevelopment,
    }).toEqual({
      ...standardPlayer.profile,
      development: standardDevelopment,
    })
  })

  it("anchors potential to the player profile and caps configured upside", () => {
    const config = createStandardPlayerGenerationConfig()
    config.talentDistribution = {
      center: 25,
      spread: 0,
      shape: "long-tailed",
    }
    config.starTailFrequency = {
      above70: 0,
      above80: 0,
      above90: 0,
    }
    config.development.potential = {
      center: 25,
      spread: 0,
      maxHeadroom: 25,
      shape: "long-tailed",
    }

    const result = generatePlayerWithDiagnostics(
      createDeterministicRandom("low-base-potential-seed"),
      input,
      config
    )

    expect(result.diagnostics.latentTalent).toBe(25)
    expect(result.diagnostics.currentAbility).toBe(25)
    expect(result.diagnostics.potentialBase).toBe(25)
    expect(result.diagnostics.potentialUpside).toBe(25)
    expect(result.player.profile.development.potential).toBe(50)
  })

  it("applies configured skill correlations across a population", () => {
    const standardConfig = createStandardPlayerGenerationConfig()
    const uncorrelatedConfig = {
      ...standardConfig,
      skillCorrelations: [],
    }
    const correlatedPassingIQ = standardConfig.skillCorrelations.find(
      (correlation) =>
        correlation.first === "passing" && correlation.second === "basketballIQ"
    )

    expect(correlatedPassingIQ?.strength).toBeGreaterThan(0)

    const createPopulation = (config: typeof standardConfig) =>
      Array.from({ length: 500 }, (_, index) =>
        generatePlayer(
          createDeterministicRandom(`correlation-seed-${index}`),
          { id: `player-${index}`, name: `Player ${index}` },
          config
        )
      )

    const correlation = (values: number[][]): number => {
      const left = values.map(([first]) => first)
      const right = values.map(([, second]) => second)
      const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length
      const rightMean =
        right.reduce((sum, value) => sum + value, 0) / right.length
      const numerator = left.reduce(
        (sum, value, index) =>
          sum + (value - leftMean) * ((right[index] ?? rightMean) - rightMean),
        0
      )
      const leftVariance = left.reduce(
        (sum, value) => sum + (value - leftMean) ** 2,
        0
      )
      const rightVariance = right.reduce(
        (sum, value) => sum + (value - rightMean) ** 2,
        0
      )

      return numerator / Math.sqrt(leftVariance * rightVariance)
    }

    const correlated = createPopulation(standardConfig).map((player) => [
      player.profile.skills.passing,
      player.profile.skills.basketballIQ,
    ])
    const uncorrelated = createPopulation(uncorrelatedConfig).map((player) => [
      player.profile.skills.passing,
      player.profile.skills.basketballIQ,
    ])

    expect(correlation(correlated)).toBeGreaterThan(correlation(uncorrelated))
    expect(correlation(correlated)).toBeGreaterThan(0.5)
  })

  it("uses scoped randomness so different seeds produce different players", () => {
    const first = generatePlayer(
      createDeterministicRandom("player-seed-a"),
      input
    )
    const second = generatePlayer(
      createDeterministicRandom("player-seed-b"),
      input
    )

    expect(first.profile).not.toEqual(second.profile)
  })

  it("generates age when the caller does not provide one", () => {
    const player = generatePlayer(createDeterministicRandom("age-seed"), {
      id: "player-age",
      name: "Age Test",
    })

    expect(player.age).toBeGreaterThanOrEqual(19)
    expect(player.age).toBeLessThanOrEqual(34)
  })
})
