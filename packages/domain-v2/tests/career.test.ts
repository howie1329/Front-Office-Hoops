import { describe, expect, it } from "vitest"

import { createPlayerContractFixture, type PlayerLeagueStatus } from "../src"

describe("career domain contracts", () => {
  it("includes hidden career timing in the authoritative player profile", () => {
    const player = createPlayerContractFixture()

    expect(player.profile.development).toMatchObject({
      potential: 82,
      peakAge: 27,
      declineStartAge: 32,
    })
    expect(player.profile.development.declineStartAge).toBeGreaterThan(
      player.profile.development.peakAge
    )
  })

  it("supports final retirement as a league status", () => {
    const status: PlayerLeagueStatus = { kind: "retired" }
    expect(status).toEqual({ kind: "retired" })
  })
})
