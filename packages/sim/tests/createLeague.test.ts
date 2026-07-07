import { describe, expect, it } from "vitest"

import { SAVE_VERSION } from "@workspace/shared/leagueTypes"

import { createRng } from "../src/rng"
import { createLeague } from "../src/createLeague"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

describe("createLeague", () => {
  it("returns a league record with initial season state", () => {
    const league = createLeague({ skipPreseason: true,
      id: "league_test",
      name: "Test League",
      baseSeed: "league-seed",
      rng: createRng("schedule:league-seed"),
      useMiniLeague: true,
    })

    expect(league).toMatchObject({
      id: "league_test",
      name: "Test League",
      saveVersion: SAVE_VERSION,
      userTeamId: null,
    })
    expect(league.seasonState.teams).toHaveLength(SAMPLE_ROSTERS.length)
    expect(league.seasonState.teams.map((team) => team.id)).toEqual(
      SAMPLE_ROSTERS.map((team) => team.id),
    )
    expect(league.contracts.length).toBeGreaterThan(0)
    expect(league.teamFinancials).toHaveLength(SAMPLE_ROSTERS.length)
    expect(league.seasonState.games).toEqual([])
    expect(league.seasonState.schedule.length).toBe(30)
    expect(league.seasonState.standings.length).toBe(SAMPLE_ROSTERS.length)
    expect(league.seasonState.playerSeasonStats).toEqual([])
    expect(league.seasonState.phase).toBe("regular")
    expect(league.seasonHistory).toEqual([])
    expect(league.createdAt).toBe(league.updatedAt)
  })
})
