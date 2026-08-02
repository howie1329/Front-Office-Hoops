import { describe, expect, it } from "vitest"

import { validateLeagueDocument } from "@workspace/league-schema"

import {
  createLeague,
  LEAGUE_TEAM_COUNT,
} from "../src"

describe("league creation", () => {
  const input = {
    id: "league-created",
    name: "The First Office League",
    seed: "league-creation-test",
    mode: "deterministic-lab" as const,
    createdWithEntropy: false,
    now: "2026-08-02T00:00:00.000Z",
  }

  it("promotes the initial universe into a valid league document", () => {
    const result = createLeague(input)

    expect(result.document.state.phase).toBe("preseason")
    expect(Object.keys(result.document.entities.teams)).toHaveLength(
      LEAGUE_TEAM_COUNT,
    )
    expect(Object.keys(result.document.entities.players)).toHaveLength(640)
    expect(result.teamPreviews).toHaveLength(LEAGUE_TEAM_COUNT)
    expect(
      Object.values(result.document.entities.teams).every(
        (team) => team.rosterPlayerIds?.length === 15,
      ),
    ).toBe(true)
    expect(validateLeagueDocument(result.document)).toMatchObject({
      valid: true,
    })
  })

  it("is reproducible when the creation seed is fixed", () => {
    expect(createLeague(input)).toEqual(createLeague(input))
  })
})
