import { describe, expect, it } from "vitest"

import { createFoundationLeague } from "../src"

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
