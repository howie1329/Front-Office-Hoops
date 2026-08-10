import { describe, expect, it } from "vitest"
import { validateLeagueDocument } from "@workspace/league-schema"

import {
  aggregateSeasonProduction,
  advanceToNextSeason,
  createDefaultSeasonFixture,
  createLeague,
  createStandardGameSimulationConfig,
  createStandardSeasonProductionConfig,
  getCompletedGames,
  getPlayerGameHistory,
  getPlayerInformationView,
  runSeason,
  simulateOneLeagueDate,
} from "../src"

function createTestLeague() {
  return createLeague({
    id: "player-information-test",
    name: "Player Information Test League",
    seed: "player-information-seed",
    mode: "deterministic-lab",
    createdWithEntropy: false,
    now: "2026-08-02T00:00:00.000Z",
  }).document
}

describe("player information data foundation", () => {
  it("keeps team splits when a player appears for multiple teams", () => {
    const gameConfig = createStandardGameSimulationConfig()
    gameConfig.injuries.frequency = "off"
    gameConfig.injuries.inGameInjuries = false
    const config = {
      ...createStandardSeasonProductionConfig("smoke"),
      gamesPerTeam: 1,
      schedule: {
        ...createStandardSeasonProductionConfig("smoke").schedule,
        teamCount: 30,
      },
      injuries: { mode: "off" as const },
    }
    const fixture = createDefaultSeasonFixture("team-split-seed", {
      config,
      gameConfig,
    })
    const result = runSeason(fixture)
    const first = result.games[0]!
    const second = structuredClone(first)
    const player = Object.values(second.players)[0]!
    const alternateTeamId = Object.keys(fixture.teams).find(
      (teamId) => teamId !== player.teamId
    )!
    player.teamId = alternateTeamId

    const aggregation = aggregateSeasonProduction(fixture, [first, second], 2)
    const production = aggregation.players[player.playerId]!

    expect(Object.keys(production.teamSplits ?? {})).toEqual(
      expect.arrayContaining([player.teamId, alternateTeamId])
    )
    expect(
      Object.values(production.teamSplits ?? {}).reduce(
        (sum, split) => sum + split.points,
        0
      )
    ).toBe(production.points)
  })

  it("reads current games and archived games through one player history selector", () => {
    let league = createTestLeague()
    const firstDate = simulateOneLeagueDate(
      league,
      league.state.calendar.currentDate,
      "player-information-game"
    )
    league = firstDate.league
    const playerId = league.entities.teams["team:01"]!.rosterPlayerIds![0]!
    const currentHistory = getPlayerGameHistory(league, playerId)
    expect(currentHistory.length).toBeGreaterThan(0)

    league.state.calendar.schedule = league.state.calendar.schedule.map(
      (entry) =>
        entry.kind === "regular-season" && entry.status === "scheduled"
          ? { ...entry, status: "completed" as const }
          : entry
    )
    const transition = advanceToNextSeason(league, {
      type: "AdvanceToNextSeason",
      commandId: "player-information-season-close",
    })
    const allGames = getCompletedGames(transition.league)

    expect(transition.archive.season).toBe(1)
    expect(transition.league.history.seasonArchives).toHaveLength(1)
    expect(allGames).toHaveLength(transition.archive.games.length)
    expect(getPlayerGameHistory(transition.league, playerId)).toHaveLength(
      currentHistory.length
    )
    expect(transition.league.state.season).toBe(2)
    expect(transition.league.entities.players[playerId]!.age).toBe(
      league.entities.players[playerId]!.age + 1
    )
    expect(getPlayerInformationView(transition.league, playerId)).toMatchObject(
      {
        player: { id: playerId },
        seasonLogs: [{ season: 1 }],
        gameLog: currentHistory,
      }
    )

    const duplicateArchive = structuredClone(transition.league)
    duplicateArchive.history.seasonArchives.push(transition.archive)
    expect(validateLeagueDocument(duplicateArchive).valid).toBe(false)
  })
})
