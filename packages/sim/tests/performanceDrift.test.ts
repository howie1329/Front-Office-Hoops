import { describe, expect, it } from "vitest"

import type { PlayerSeasonStats } from "@workspace/shared/types"

import { progressPlayer } from "../src/development/progressPlayer"
import { estimatePerformanceDrift } from "../src/playerValue/performanceDrift"
import { makeTestPlayer, makeTestRatings } from "./helpers/playerRatings"

function stats(overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    id: "stats_1",
    playerId: "p_test",
    teamId: "t_test",
    season: 1,
    gp: 25,
    gs: 20,
    min: 700,
    pts: 500,
    reb: 190,
    ast: 210,
    stl: 35,
    blk: 18,
    tov: 65,
    fgm: 185,
    fga: 340,
    tpm: 65,
    tpa: 170,
    ftm: 65,
    fta: 78,
    ...overrides,
  }
}

describe("performance drift", () => {
  const player = makeTestPlayer({
    age: 24,
    position: "PG",
    ratings: makeTestRatings({ overall: 70, potential: 78 }),
  })

  it("preserves drift for players below the 500-minute qualification", () => {
    expect(
      estimatePerformanceDrift(
        { ...player, performanceDrift: 1.25 },
        stats({ min: 499 }),
      ),
    ).toBe(1.25)
  })

  it("moves drift directionally from a qualified role-adjusted season", () => {
    const strong = estimatePerformanceDrift(player, stats())
    const weak = estimatePerformanceDrift(
      player,
      stats({
        pts: 220,
        reb: 70,
        ast: 60,
        stl: 8,
        blk: 3,
        tov: 105,
        fgm: 80,
        fga: 300,
        ftm: 35,
        fta: 60,
      }),
    )

    expect(strong).toBeGreaterThan(0)
    expect(weak).toBeLessThan(0)
  })

  it("persists the completed-season signal during preseason progression", () => {
    const result = progressPlayer({
      player,
      team: {
        id: player.teamId!,
        name: "Test Team",
        abbrev: "TST",
        overall: player.ratings.overall,
        players: [player],
      },
      priorSeason: 1,
      newSeason: 2,
      playerSeasonStats: [stats()],
      playerSeasonProfiles: [],
      baseSeed: "performance-drift",
    })

    expect(result.player?.performanceDrift).toBeGreaterThan(0)
  })
})
