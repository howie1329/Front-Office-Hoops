import { describe, expect, it } from "vitest"

import {
  createFoundationLeague,
  createPlayerContractFixture,
  formatPlayerIdentity,
} from "../src"

describe("createFoundationLeague", () => {
  it("creates a stable minimal document", () => {
    const league = createFoundationLeague({
      id: "league-1",
      name: "League 1",
    })

    expect(league.schema).toEqual({
      name: "foh-league",
      version: 1,
      rulesVersion: 1,
    })
    expect(league.metadata).toMatchObject({
      id: "league-1",
      name: "League 1",
    })
    expect(league.entities.teams).toEqual({})
  })
})

describe("createPlayerContractFixture", () => {
  it("contains the approved authoritative player profile", () => {
    const player = createPlayerContractFixture()

    expect(player).toMatchObject({
      id: "player-fixture",
      identity: {
        firstName: "Alex",
        lastName: "Example",
      },
      age: 24,
      profile: {
        physical: {
          heightInches: 78,
          weightPounds: 220,
          wingspanInches: 82,
        },
        skills: {
          shooting: 74,
          basketballIQ: 73,
          stamina: 80,
        },
        injuryResistance: 77,
        development: {
          potential: 82,
          rating: 62,
          volatility: 25,
        },
        traits: ["hard-worker"],
      },
    })
  })

  it("formats complete, partial, and nameless identities", () => {
    expect(
      formatPlayerIdentity({ firstName: "Alex", lastName: "Example" })
    ).toBe("Alex Example")
    expect(formatPlayerIdentity({ firstName: "Alex", lastName: null })).toBe(
      "Alex"
    )
    expect(formatPlayerIdentity({ firstName: null, lastName: null })).toBeNull()
  })
})
