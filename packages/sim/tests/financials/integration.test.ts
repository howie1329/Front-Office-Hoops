import { describe, expect, it } from "vitest"

import { createLeague, createRng } from "../../src"

describe("financials integration", () => {
  it("creates a league with contracts and team financials", () => {
    const league = createLeague({
      name: "Financial Test League",
      baseSeed: "financial-test",
      rng: createRng("financial-test"),
      useMiniLeague: true,
    })

    expect(league.saveVersion).toBe(5)
    expect(league.contracts.length).toBeGreaterThan(0)
    expect(league.teamFinancials.length).toBe(6)
    expect(league.seasonState.teams[0]?.players[0]?.activeContractId).toBeTruthy()
  })
})
