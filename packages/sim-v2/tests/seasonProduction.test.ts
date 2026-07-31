import { describe, expect, it } from "vitest"
import {
  seasonCheckpointReportSchema,
  seasonFixtureSchema,
  productionValueLabReportSchema,
  seasonRunResultSchema,
} from "@workspace/league-schema"

import {
  createStandardGameSimulationConfig,
  createStandardSeasonProductionConfig,
  createDefaultSeasonFixture,
  createSeasonFixtureFromUniverse,
  generateInitialPlayerUniverse,
  runSeason,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "../src"

function createSmallSeasonFixture(seed = "season-test") {
  const teamIds = [
    "season:team:01",
    "season:team:02",
    "season:team:03",
    "season:team:04",
  ]
  const universe = generateInitialPlayerUniverse({
    seed: `${seed}:universe`,
    leagueId: "season-test",
    teamIds,
    config: {
      ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG),
      rosterAssembly: {
        ...structuredClone(
          STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly
        ),
        coreDepthPerPosition: 1,
      },
    },
  })
  const config = {
    ...createStandardSeasonProductionConfig("smoke"),
    gamesPerTeam: 2,
    schedule: {
      teamCount: 4,
      homeAwayBalanced: true,
      scheduleSeed: `${seed}:schedule`,
    },
    injuries: { mode: "off" as const },
  }
  const gameConfig = createStandardGameSimulationConfig()
  gameConfig.injuries.frequency = "off"
  gameConfig.injuries.inGameInjuries = false
  return createSeasonFixtureFromUniverse(universe, {
    seed,
    config,
    gameConfig,
  })
}

describe("season production runner", () => {
  it("creates a deterministic balanced schedule", () => {
    const first = createSmallSeasonFixture("schedule-seed")
    const second = createSmallSeasonFixture("schedule-seed")

    expect(first.schedule).toEqual(second.schedule)
    expect(first.schedule).toHaveLength(4)
    expect(
      first.schedule.every((game) => game.homeTeamId !== game.awayTeamId)
    ).toBe(true)
    const appearances = new Map<string, number>()
    for (const game of first.schedule) {
      appearances.set(
        game.homeTeamId,
        (appearances.get(game.homeTeamId) ?? 0) + 1
      )
      appearances.set(
        game.awayTeamId,
        (appearances.get(game.awayTeamId) ?? 0) + 1
      )
    }
    expect([...appearances.values()]).toEqual([2, 2, 2, 2])
  })

  it("runs games through the matchup engine and records checkpoints", () => {
    const fixture = createSmallSeasonFixture("run-seed")
    const result = runSeason(fixture)

    expect(result.status).toBe("completed")
    expect(result.games).toHaveLength(4)
    expect(result.games.every((game) => game.status === "completed")).toBe(true)
    expect(result.games.every((game) => game.events.length === 0)).toBe(true)
    expect(
      result.checkpoints.map((checkpoint) => checkpoint.gamesPerTeam)
    ).toEqual([0, 2])
    expect(
      result.checkpoints.at(-1)?.leagueSummary.reconciliationPassRate
    ).toBe(100)
    expect(Object.keys(result.checkpoints.at(-1)!.values)).toHaveLength(
      Object.keys(fixture.players).length
    )
    expect(seasonFixtureSchema.safeParse(fixture).success).toBe(true)
    expect(
      seasonCheckpointReportSchema.safeParse(result.checkpoints.at(-1)).success
    ).toBe(true)
    expect(seasonRunResultSchema.safeParse(result).success).toBe(true)
    expect(
      productionValueLabReportSchema.safeParse({
        schema: "foh-production-value-lab",
        version: 1,
        baseSeed: fixture.seed,
        fixture,
        result,
      }).success
    ).toBe(true)
  })

  it("keeps unassigned populations projection-based", () => {
    const fixture = createSmallSeasonFixture("population-seed")
    const result = runSeason(fixture)
    const final = result.checkpoints.at(-1)!
    const freeAgentId = fixture.populations.freeAgents[0]!
    const prospectId = fixture.populations.draftProspects[0]!

    expect(final.playerProduction[freeAgentId]?.gamesPlayed).toBe(0)
    expect(final.playerProduction[prospectId]?.gamesPlayed).toBe(0)
    expect(final.values[freeAgentId]?.confidence).toBe("provisional")
    expect(final.values[prospectId]?.confidence).toBe("provisional")

    for (const playerIds of [
      fixture.populations.rostered,
      fixture.populations.freeAgents,
      fixture.populations.draftProspects,
    ]) {
      const ranks = playerIds.map(
        (playerId) => final.values[playerId]!.diagnostics.rank
      )
      expect(Math.min(...ranks)).toBe(1)
      expect(Math.max(...ranks)).toBe(playerIds.length)
      expect(new Set(ranks).size).toBe(playerIds.length)
    }
  })

  it("preserves the last completed checkpoint when cancelled", () => {
    const fixture = createSmallSeasonFixture("cancel-seed")
    const result = runSeason(fixture, { shouldCancel: () => true })

    expect(result.status).toBe("cancelled")
    expect(result.games).toHaveLength(0)
    expect(result.checkpoints).toHaveLength(1)
    expect(result.checkpoints[0]?.gamesPerTeam).toBe(0)
  })

  it("completes the standard full-season fixture", () => {
    const fixture = createDefaultSeasonFixture("full-season-smoke", {
      runPreset: "full",
      gameConfig: createStandardGameSimulationConfig(),
    })
    const result = runSeason(fixture)

    expect(result.status).toBe("completed")
    expect(result.games).toHaveLength((30 * 82) / 2)
    expect(result.games.some((game) => game.events.length > 0)).toBe(true)
    for (const teamId of Object.keys(fixture.teams)) {
      const homeGames = fixture.schedule.filter(
        (game) => game.homeTeamId === teamId
      ).length
      const awayGames = fixture.schedule.filter(
        (game) => game.awayTeamId === teamId
      ).length
      expect(homeGames + awayGames).toBe(82)
      expect(homeGames).toBeGreaterThanOrEqual(40)
      expect(homeGames).toBeLessThanOrEqual(42)
      expect(awayGames).toBeGreaterThanOrEqual(40)
      expect(awayGames).toBeLessThanOrEqual(42)
    }
    expect(
      result.checkpoints.map((checkpoint) => checkpoint.gamesPerTeam)
    ).toEqual([0, 10, 25, 41, 82])
    expect(
      result.checkpoints.at(-1)?.leagueSummary.reconciliationPassRate
    ).toBe(100)
    const final = result.checkpoints.at(-1)!
    const rosteredProduction = fixture.populations.rostered.map(
      (playerId) => final.playerProduction[playerId]!
    )
    const limitedOpportunity = rosteredProduction.reduce((lowest, current) =>
      current.minutes / Math.max(1, current.gamesPlayed) <
      lowest.minutes / Math.max(1, lowest.gamesPlayed)
        ? current
        : lowest
    )
    const highestOpportunity = rosteredProduction.reduce((highest, current) =>
      current.minutes / Math.max(1, current.gamesPlayed) >
      highest.minutes / Math.max(1, highest.gamesPlayed)
        ? current
        : highest
    )
    expect(
      final.values[limitedOpportunity.playerId]!.breakdown.opportunity
    ).toBeLessThan(
      final.values[highestOpportunity.playerId]!.breakdown.opportunity
    )
    expect(
      final.values[limitedOpportunity.playerId]!.diagnostics.outlierFlags.some(
        (flag) =>
          flag === "limited-opportunity" || flag === "no-production-sample"
      )
    ).toBe(true)
  }, 120_000)
})
