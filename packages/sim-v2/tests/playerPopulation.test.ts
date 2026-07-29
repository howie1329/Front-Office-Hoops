import { createStandardPlayerGenerationConfig } from "@workspace/domain-v2"
import { describe, expect, it } from "vitest"

import {
  generatePlayer,
  generatePlayerPopulation,
  PLAYER_IDENTITY_GENERATOR_VERSION,
  createDeterministicRandom,
} from "../src"
import type { PlayerPopulationInput } from "../src"

function createInput(
  overrides: Partial<PlayerPopulationInput> = {}
): PlayerPopulationInput {
  return {
    seed: "population-seed",
    context: { kind: "lab", id: "lab-population" },
    count: 3,
    startIndex: 1,
    identityMode: "generated",
    config: createStandardPlayerGenerationConfig(),
    ...overrides,
  }
}

describe("generatePlayerPopulation", () => {
  it("reproduces IDs, identities, profiles, and diagnostics", () => {
    const input = createInput()

    expect(generatePlayerPopulation(input)).toEqual(
      generatePlayerPopulation(input)
    )
  })

  it("generates nonempty names and stores nullable identity in none mode", () => {
    const generated = generatePlayerPopulation(createInput())
    const nameless = generatePlayerPopulation(
      createInput({ identityMode: "none" })
    )

    expect(generated.metadata.identityGeneratorVersion).toBe(
      PLAYER_IDENTITY_GENERATOR_VERSION
    )
    expect(
      generated.results.every(
        ({ player }) =>
          Boolean(player.identity.firstName) &&
          Boolean(player.identity.lastName)
      )
    ).toBe(true)
    expect(
      nameless.results.every(
        ({ player }) =>
          player.identity.firstName === null &&
          player.identity.lastName === null
      )
    ).toBe(true)
  })

  it("keeps basketball data isolated from identity mode", () => {
    const generated = generatePlayerPopulation(createInput())
    const nameless = generatePlayerPopulation(
      createInput({ identityMode: "none" })
    )

    expect(
      generated.results.map(({ player, diagnostics }) => ({
        age: player.age,
        profile: player.profile,
        diagnostics,
      }))
    ).toEqual(
      nameless.results.map(({ player, diagnostics }) => ({
        age: player.age,
        profile: player.profile,
        diagnostics,
      }))
    )
  })

  it("preserves the original prefix when count increases", () => {
    const shortPopulation = generatePlayerPopulation(createInput({ count: 3 }))
    const longPopulation = generatePlayerPopulation(createInput({ count: 8 }))

    expect(longPopulation.results.slice(0, 3)).toEqual(shortPopulation.results)
  })

  it("uses context only for metadata and the player ID namespace", () => {
    const lab = generatePlayerPopulation(createInput())
    const draft = generatePlayerPopulation(
      createInput({
        context: { kind: "draft-class", id: "draft-2029" },
      })
    )

    expect(lab.metadata.context).toEqual({
      kind: "lab",
      id: "lab-population",
    })
    expect(draft.metadata.context).toEqual({
      kind: "draft-class",
      id: "draft-2029",
    })
    expect(lab.results.map(({ player }) => player.id)).not.toEqual(
      draft.results.map(({ player }) => player.id)
    )
    expect(
      lab.results.map(({ player, diagnostics }) => ({
        identity: player.identity,
        age: player.age,
        profile: player.profile,
        diagnostics,
      }))
    ).toEqual(
      draft.results.map(({ player, diagnostics }) => ({
        identity: player.identity,
        age: player.age,
        profile: player.profile,
        diagnostics,
      }))
    )
  })

  it("creates unique stable IDs while allowing duplicate display names", () => {
    const population = generatePlayerPopulation(createInput({ count: 20 }))
    const ids = population.results.map(({ player }) => player.id)
    const sharedIdentity = { firstName: "Alex", lastName: "Example" }
    const first = generatePlayer(createDeterministicRandom("duplicate-a"), {
      id: "player-a",
      identity: sharedIdentity,
    })
    const second = generatePlayer(createDeterministicRandom("duplicate-b"), {
      id: "player-b",
      identity: sharedIdentity,
    })

    expect(new Set(ids).size).toBe(ids.length)
    expect(first.identity).toEqual(second.identity)
    expect(first.id).not.toBe(second.id)
  })

  it.each([
    ["empty seed", { seed: " " }],
    ["zero count", { count: 0 }],
    ["fractional count", { count: 1.5 }],
    ["zero start index", { startIndex: 0 }],
    ["fractional start index", { startIndex: 1.5 }],
    ["empty context ID", { context: { kind: "lab", id: " " } }],
  ])("rejects %s", (_, overrides) => {
    expect(() =>
      generatePlayerPopulation(
        createInput(overrides as Partial<PlayerPopulationInput>)
      )
    ).toThrow()
  })
})
