import { describe, expect, it } from "vitest"

import { createStandardPlayerGenerationConfig } from "@workspace/domain-v2"

import { createDeterministicRandom, generatePlayer } from "../src"

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
      player.profile.development.rating,
      player.profile.development.volatility,
      ...Object.values(player.profile.skills),
    ]

    expect(ratings.every((rating) => rating >= 25 && rating <= 92)).toBe(true)
    expect(player.profile.traits.length).toBeLessThanOrEqual(3)
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
    const player = generatePlayer(
      createDeterministicRandom("age-seed"),
      { id: "player-age", name: "Age Test" },
    )

    expect(player.age).toBeGreaterThanOrEqual(19)
    expect(player.age).toBeLessThanOrEqual(34)
  })
})
