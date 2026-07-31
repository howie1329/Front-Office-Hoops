import { describe, expect, it } from "vitest"

import {
  createPlayerContractFixture,
  type GameMatchupFixture,
} from "@workspace/domain-v2"
import { createStandardGameSimulationConfig } from "@workspace/sim-v2"

import {
  calculateRate,
  MODERN_BALANCED_BENCHMARK_PROFILE,
  runMatchupBatch,
  serializeMatchupBatchReport,
} from "../src"

function createFixture(seed: string): GameMatchupFixture {
  const players = Object.fromEntries(
    ["home", "away"].flatMap((teamId) =>
      Array.from({ length: 8 }, (_, index) => {
        const id = teamId + "-" + (index + 1)
        const positions = ["PG", "SG", "SF", "PF", "C"] as const
        const positionIndex = index % positions.length
        const player = createPlayerContractFixture({
          id,
          leagueStatus: { kind: "rostered", teamId },
        })
        return [
          id,
          {
            ...player,
            profile: {
              ...player.profile,
              role: {
                ...player.profile.role,
                primaryPosition: positions[positionIndex],
                secondaryPosition:
                  positions[(positionIndex + 1) % positions.length],
              },
            },
          },
        ]
      })
    )
  )
  const teamIds = ["home", "away"]
  const config = createStandardGameSimulationConfig()
  config.injuries = {
    ...config.injuries,
    frequency: "off",
    inGameInjuries: false,
  }

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
        const playerIds = Object.keys(players).filter((id) =>
          id.startsWith(teamId)
        )
        return [
          teamId,
          {
            starters: playerIds.slice(0, 5),
            depthOrder: playerIds,
            targetMinutes: Object.fromEntries(
              playerIds.map((id, index) => [id, index < 5 ? 32 : 8])
            ),
          },
        ]
      })
    ),
    availability: Object.fromEntries(
      Object.keys(players).map((id) => [
        id,
        { available: true, gamesRemaining: 0 },
      ])
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
    config,
  }
}

describe("runMatchupBatch", () => {
  it("runs deterministic games and reports expanded distributions", () => {
    const progress: number[] = []
    const first = runMatchupBatch({
      baseSeed: "batch",
      count: 3,
      createFixture,
      onProgress: (nextProgress) => progress.push(nextProgress.completed),
    })
    const second = runMatchupBatch({
      baseSeed: "batch",
      count: 3,
      createFixture,
    })

    expect(first).toEqual(second)
    expect(progress).toEqual([1, 2, 3])
    for (const key of [
      "homeScore",
      "awayScore",
      "totalScore",
      "homePossessions",
      "awayPossessions",
      "reconciliationPass",
      "overtimePeriods",
      "injuryEvents",
      "failureRate",
      "topPlayerPoints",
      "topPlayerOpportunities",
      "teamPoints",
      "teamPossessions",
      "offensiveEfficiency",
      "fieldGoalsMade",
      "fieldGoalsAttempted",
      "threePointersMade",
      "threePointersAttempted",
      "freeThrowsMade",
      "freeThrowsAttempted",
      "fieldGoalPercentage",
      "threePointPercentage",
      "freeThrowPercentage",
      "threePointAttemptRate",
      "freeThrowAttemptRate",
      "rimAttemptRate",
      "midrangeAttemptRate",
      "assists",
      "assistRate",
      "turnovers",
      "turnoverRate",
      "rebounds",
      "offensiveRebounds",
      "defensiveRebounds",
      "steals",
      "blocks",
      "blockRate",
      "fouls",
      "shootingFouls",
      "nonShootingFouls",
      "shootingFoulRate",
      "nonShootingFoulRate",
      "offensiveReboundRate",
      "secondChanceAttempts",
      "secondChancePoints",
      "secondChanceAttemptRate",
      "secondChancePointsPerOffensiveRebound",
      "topPlayerOpportunityShare",
      "benchPointsShare",
      "starterMinutes",
      "benchMinutes",
    ]) {
      expect(first.metrics[key]).toBeDefined()
    }
    expect(first.version).toBe(2)
    expect(first.completed).toBe(3)
    expect(first.metrics.totalScore?.count).toBe(3)
    expect(first.metrics.teamPoints?.count).toBe(6)
    expect(first.metrics.starterMinutes?.count).toBe(6)
    expect(first.metrics.failureRate?.count).toBe(3)
    expect(first.metrics.reconciliationPass?.mean).toBe(1)
    expect(first.effectiveConfig.injuries.frequency).toBe("off")
    expect(first.benchmark).toBeNull()
    expect(JSON.parse(serializeMatchupBatchReport(first))).toMatchObject({
      schema: "foh-matchup-calibration",
      version: 2,
      count: 3,
      effectiveConfig: first.effectiveConfig,
      benchmark: null,
    })
  })

  it("reports benchmark checks without turning misses into exceptions", () => {
    const report = runMatchupBatch({
      baseSeed: "benchmark",
      count: 3,
      createFixture,
      benchmarkProfile: MODERN_BALANCED_BENCHMARK_PROFILE,
    })

    expect(report.benchmark?.profileId).toBe("modern-balanced-v1")
    expect(report.benchmark?.checks.teamPoints?.actual.count).toBe(6)
    expect(report.benchmark?.checks.teamPoints?.target).toEqual({
      min: 105,
      max: 123,
    })
    expect(typeof report.benchmark?.passed).toBe("boolean")
  })

  it("uses safe percentage and rate calculations", () => {
    expect(calculateRate(2, 4)).toBe(50)
    expect(calculateRate(4, 0)).toBe(0)
    expect(calculateRate(Number.NaN, 4)).toBe(0)
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
    expect(report.metrics.teamPoints?.count).toBe(0)
    expect(report.metrics.failureRate?.mean).toBe(1)
    expect(report.metrics.reconciliationPass?.count).toBe(0)
  })

  it("retains an effective config when cancellation happens before game one", () => {
    const report = runMatchupBatch({
      baseSeed: "cancelled",
      count: 3,
      createFixture,
      shouldCancel: () => true,
    })

    expect(report.completed).toBe(0)
    expect(report.failed).toBe(0)
    expect(report.effectiveConfig.presetId).toBe("standard")
    expect(report.metrics.teamPoints?.count).toBe(0)
  })

  it("rejects batches that mix effective configurations", () => {
    expect(() =>
      runMatchupBatch({
        baseSeed: "mixed-config",
        count: 2,
        createFixture: (seed) => {
          const fixture = createFixture(seed)
          if (seed.endsWith(":2")) {
            fixture.config = {
              ...fixture.config,
              environment: {
                ...fixture.config.environment,
                pace: 100,
              },
            }
          }
          return fixture
        },
      })
    ).toThrow("one effective game simulation config")
  })
})
