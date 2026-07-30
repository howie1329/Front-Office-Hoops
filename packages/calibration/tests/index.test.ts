import { describe, expect, it } from "vitest"

import {
  createPlayerContractFixture,
  type GameMatchupFixture,
} from "@workspace/domain-v2"
import {
  createStandardGameSimulationConfig,
} from "@workspace/sim-v2"

import { runMatchupBatch, serializeMatchupBatchReport } from "../src"

function createFixture(seed: string): GameMatchupFixture {
  const players = Object.fromEntries(
    ["home", "away"].flatMap((teamId) =>
      Array.from({ length: 5 }, (_, index) => {
        const id = `${teamId}-${index + 1}`
        return [
          id,
          {
            ...createPlayerContractFixture({
              id,
              leagueStatus: { kind: "rostered", teamId },
            }),
          },
        ]
      })
    )
  )
  const teamIds = ["home", "away"]
  return {
    version: 1,
    source: { kind: "manual", id: "calibration-test", version: 1 },
    seed,
    homeTeamId: "home",
    awayTeamId: "away",
    teams: {
      home: { id: "home", name: "Home" },
      away: { id: "away", name: "Away" },
    },
    players,
    rotations: Object.fromEntries(
      teamIds.map((teamId) => {
        const playerIds = Object.keys(players).filter((id) => id.startsWith(teamId))
        return [
          teamId,
          {
            starters: playerIds,
            depthOrder: playerIds,
            targetMinutes: Object.fromEntries(playerIds.map((id) => [id, 48])),
          },
        ]
      })
    ),
    availability: Object.fromEntries(
      Object.keys(players).map((id) => [id, { available: true, gamesRemaining: 0 }])
    ),
    coaching: Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        {
          pace: 50,
          offensiveStyle: 50,
          defensivePressure: 50,
          shotSelection: 50,
          rotationDepth: 50,
        },
      ])
    ),
    config: {
      ...createStandardGameSimulationConfig(),
      injuries: { ...createStandardGameSimulationConfig().injuries, frequency: "off", inGameInjuries: false },
    },
  }
}

describe("runMatchupBatch", () => {
  it("runs deterministic games and reports distributions", () => {
    const first = runMatchupBatch({
      baseSeed: "batch",
      count: 3,
      createFixture,
    })
    const second = runMatchupBatch({
      baseSeed: "batch",
      count: 3,
      createFixture,
    })

    expect(first).toEqual(second)
    expect(first.completed).toBe(3)
    expect(first.metrics.totalScore?.count).toBe(3)
    expect(JSON.parse(serializeMatchupBatchReport(first))).toMatchObject({
      schema: "foh-matchup-calibration",
      count: 3,
    })
  })

  it("keeps invalid runs as retained failures", () => {
    const report = runMatchupBatch({
      baseSeed: "invalid-batch",
      count: 1,
      createFixture: (seed) => ({
        ...createFixture(seed),
        homeTeamId: "missing",
      }),
    })

    expect(report.failed).toBe(1)
    expect(report.failures[0]?.seed).toBe("invalid-batch:1")
  })
})
