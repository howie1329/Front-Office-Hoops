import { describe, expect, it } from "vitest"

import { createFoundationLeague, createPlayerContractFixture } from "../src"

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
      name: "Alex Example",
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
          rating: 62,
          volatility: 25,
        },
        traits: ["hard-worker"],
      },
    })
  })
})
