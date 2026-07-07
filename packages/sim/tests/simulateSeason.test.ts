import { describe, expect, it } from "vitest"

import { SIX_TEAM_GAMES_PER_TEAM } from "@workspace/shared/constants"

import { createRng } from "../src/rng"
import { createInitialSeason } from "../src/createInitialSeason"
import { simulateSeason } from "../src/simulateSeason"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

function gamesPlayedByTeam(
  state: ReturnType<typeof simulateSeason>,
  teamId: string,
): number {
  return state.games.filter(
    (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
  ).length
}

describe("simulateSeason", () => {
  it("completes the full six-team schedule deterministically", () => {
    const season = createInitialSeason(
      SAMPLE_ROSTERS,
      "season-full",
      createRng("season-init"),
      1,
      { skipPreseason: true },
    )
    const first = simulateSeason(season)
    const second = simulateSeason(
      createInitialSeason(SAMPLE_ROSTERS, "season-full", createRng("season-init"), 1, { skipPreseason: true }),
    )

    expect(second).toEqual(first)
    expect(first.schedule.every((game) => game.status === "final")).toBe(true)
    expect(first.games).toHaveLength(30)

    for (const team of SAMPLE_ROSTERS) {
      expect(gamesPlayedByTeam(first, team.id)).toBe(SIX_TEAM_GAMES_PER_TEAM)
    }
  })
})
