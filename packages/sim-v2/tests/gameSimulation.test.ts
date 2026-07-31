import { describe, expect, it } from "vitest"

import {
  createPlayerContractFixture,
  type GameMatchupFixture,
  type GameSimulationConfig,
  type PlayerEntity,
} from "@workspace/domain-v2"

import {
  createStandardGameSimulationConfig,
  simulateGameMatchup,
  validateGameMatchupFixture,
} from "../src"

function createPlayer(
  id: string,
  teamId: string,
  ability: number,
  skills: Partial<PlayerEntity["profile"]["skills"]> = {}
): PlayerEntity {
  const player = createPlayerContractFixture({
    id,
    identity: { firstName: id, lastName: "Fixture" },
    leagueStatus: { kind: "rostered", teamId },
  })
  const value = Math.max(20, Math.min(100, ability))
  const positions = ["PG", "SG", "SF", "PF", "C"] as const
  const positionIndex = Math.max(0, Number(id.split("-").at(-1) ?? 1) - 1)
  const primaryPosition = positions[positionIndex % positions.length]
  const secondaryPosition = positions[(positionIndex + 1) % positions.length]
  return {
    ...player,
    profile: {
      ...player.profile,
      role: {
        ...player.profile.role,
        primaryPosition,
        secondaryPosition,
      },
      skills: {
        shooting: value,
        finishing: value,
        passing: value,
        handling: value,
        rebounding: value,
        defense: value,
        basketballIQ: value,
        stamina: value,
        ...skills,
      },
    },
  }
}

function createFixture(
  config: GameSimulationConfig = createStandardGameSimulationConfig()
): GameMatchupFixture {
  const teams = {
    home: { id: "home", name: "Home Team" },
    away: { id: "away", name: "Away Team" },
  }
  const players = Object.fromEntries(
    ["home", "away"].flatMap((teamId) =>
      Array.from({ length: 8 }, (_, index) => {
        const id = `${teamId}-${index + 1}`
        return [id, createPlayer(id, teamId, index === 0 ? 92 : 62)]
      })
    )
  )
  const availability = Object.fromEntries(
    Object.keys(players).map((playerId) => [
      playerId,
      { available: true, gamesRemaining: 0, restriction: "none" as const },
    ])
  )
  const rotations = Object.fromEntries(
    ["home", "away"].map((teamId) => {
      const playerIds = Object.keys(players).filter((id) =>
        id.startsWith(`${teamId}-`)
      )
      return [
        teamId,
        {
          starters: playerIds.slice(0, 5),
          depthOrder: playerIds,
          targetMinutes: Object.fromEntries(
            playerIds.map((playerId, index) => [playerId, index < 5 ? 32 : 8])
          ),
        },
      ]
    })
  )
  const coaching = {
    home: {
      pace: 50,
      offensiveStyle: 50,
      defensivePressure: 50,
      shotSelection: 50,
      rotationDepth: 50,
    },
    away: {
      pace: 50,
      offensiveStyle: 50,
      defensivePressure: 50,
      shotSelection: 50,
      rotationDepth: 50,
    },
  }
  return {
    version: 1,
    source: { kind: "manual", id: "game-test", version: 1 },
    seed: "game-simulation-test",
    homeTeamId: "home",
    awayTeamId: "away",
    teams,
    players,
    rotations,
    availability,
    coaching,
    config: {
      ...config,
      injuries: { ...config.injuries, frequency: "off", inGameInjuries: false },
    },
  }
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function runSeries(
  config: GameSimulationConfig,
  customize?: (fixture: GameMatchupFixture) => void,
  count = 20
) {
  return Array.from({ length: count }, (_, index) => {
    const fixture = createFixture(structuredClone(config))
    fixture.seed = "sensitivity-" + (index + 1)
    customize?.(fixture)
    return simulateGameMatchup(fixture)
  })
}

describe("simulateGameMatchup", () => {
  it("reruns the same seeded fixture exactly", () => {
    const fixture = createFixture()

    expect(simulateGameMatchup(fixture)).toEqual(simulateGameMatchup(fixture))
  })

  it("produces periods, box scores, and reconciled totals", () => {
    const result = simulateGameMatchup(createFixture())
    expect(result.status).toBe("completed")
    expect(result.periods.length).toBeGreaterThanOrEqual(4)
    expect(result.reconciliation.passed).toBe(true)
    expect(result.teams.home?.points).toBe(
      Object.values(result.players)
        .filter((player) => player.teamId === "home")
        .reduce((sum, player) => sum + player.points, 0)
    )
    expect(result.teams.away?.points).toBeGreaterThan(0)
  })

  it("records valid five-player lineups across the game clock", () => {
    const result = simulateGameMatchup(createFixture())

    expect(result.lineupSegments.length).toBeGreaterThan(8)
    expect(
      new Set(
        result.lineupSegments
          .filter((segment) => segment.teamId === "home")
          .map((segment) => segment.playerIds.join("|"))
      ).size
    ).toBeGreaterThan(1)
    for (const segment of result.lineupSegments) {
      expect(segment.playerIds).toHaveLength(5)
      expect(new Set(segment.playerIds).size).toBe(5)
      expect(segment.endMinute).toBeGreaterThanOrEqual(segment.startMinute)
      expect(
        segment.playerIds.every(
          (playerId) => result.players[playerId]?.teamId === segment.teamId
        )
      ).toBe(true)
    }
  })

  it("lets high-creation stars earn more opportunities without a position cap", () => {
    const fixture = createFixture({
      ...createStandardGameSimulationConfig(),
      environment: {
        ...createStandardGameSimulationConfig().environment,
        talentSeparation: 100,
      },
      offense: {
        ...createStandardGameSimulationConfig().offense,
        starUsage: 100,
      },
    })
    fixture.players["home-1"] = createPlayer("home-1", "home", 98, {
      shooting: 99,
      finishing: 96,
      handling: 98,
      passing: 96,
    })
    const result = simulateGameMatchup(fixture)
    const star = result.players["home-1"]!
    const teammate = result.players["home-2"]!

    expect(star.opportunities).toBeGreaterThan(teammate.opportunities)
    expect(star.role.label).toMatch(/creator|scoring/i)
  })

  it("rejects unavailable starters with an actionable diagnostic", () => {
    const fixture = createFixture()
    fixture.availability["home-1"] = {
      available: false,
      gamesRemaining: 3,
      restriction: "none",
    }

    const diagnostics = validateGameMatchupFixture(fixture)
    const result = simulateGameMatchup(fixture)

    expect(
      diagnostics.some((entry) => entry.code === "unavailable-starter")
    ).toBe(true)
    expect(result.status).toBe("rejected")
    expect(result.diagnostics[0]?.message).toContain("unavailable")
  })

  it("honors a minutes restriction without making the player unavailable", () => {
    const fixture = createFixture()
    fixture.availability["home-1"] = {
      available: true,
      gamesRemaining: 0,
      restriction: "minutes-limited",
      minutesLimit: 12,
    }
    fixture.rotations.home!.starters = [
      "home-2",
      "home-3",
      "home-4",
      "home-5",
      "home-6",
    ]

    const result = simulateGameMatchup(fixture)

    expect(result.status).toBe("completed")
    expect(result.players["home-1"]?.minutes).toBeLessThanOrEqual(12)
  })

  it("uses rotation adherence to move minutes toward manual targets", () => {
    const targetMinutes = Object.fromEntries(
      Object.keys(createFixture().players)
        .filter((playerId) => playerId.startsWith("home-"))
        .map((playerId, index) => [playerId, index === 0 ? 42 : 3])
    )
    const lowAdherence = createStandardGameSimulationConfig()
    lowAdherence.rotation.adherence = 0
    const highAdherence = createStandardGameSimulationConfig()
    highAdherence.rotation.adherence = 100
    const lowFixture = createFixture(lowAdherence)
    const highFixture = createFixture(highAdherence)
    lowFixture.rotations.home!.targetMinutes = targetMinutes
    highFixture.rotations.home!.targetMinutes = targetMinutes

    const low = simulateGameMatchup(lowFixture)
    const high = simulateGameMatchup(highFixture)

    expect(high.players["home-1"]?.minutes).toBeGreaterThan(
      low.players["home-1"]?.minutes ?? 0
    )
    expect(high.reconciliation.passed).toBe(true)
    expect(low.reconciliation.passed).toBe(true)
  })

  it("makes transition rate change the early-offense shot proxy", () => {
    const lowConfig = createStandardGameSimulationConfig()
    lowConfig.offense.transitionRate = 0
    const highConfig = createStandardGameSimulationConfig()
    highConfig.offense.transitionRate = 100
    const lowResults = runSeries(lowConfig)
    const highResults = runSeries(highConfig)
    const proxy = (result: ReturnType<typeof simulateGameMatchup>) =>
      Object.values(result.teams).reduce(
        (total, team) =>
          total +
          team.shotProfile.rimAttempts +
          team.shotProfile.threePointAttempts,
        0
      ) /
      Object.values(result.teams).reduce(
        (total, team) => total + team.fieldGoalsAttempted,
        0
      )

    expect(average(highResults.map(proxy))).toBeGreaterThan(
      average(lowResults.map(proxy))
    )
  })

  it("uses shot-selection discipline when player shot qualities differ", () => {
    const lowConfig = createStandardGameSimulationConfig()
    lowConfig.offense.shotSelectionDiscipline = 0
    const highConfig = createStandardGameSimulationConfig()
    highConfig.offense.shotSelectionDiscipline = 100
    const customize = (fixture: GameMatchupFixture) => {
      const player = fixture.players["home-1"]!
      player.profile.skills = {
        ...player.profile.skills,
        shooting: 99,
        finishing: 35,
        handling: 35,
        basketballIQ: 95,
      }
    }
    const lowResults = runSeries(lowConfig, customize)
    const highResults = runSeries(highConfig, customize)

    expect(
      average(
        highResults.map((result) => result.teams.home?.offensiveEfficiency ?? 0)
      )
    ).toBeGreaterThan(
      average(
        lowResults.map((result) => result.teams.home?.offensiveEfficiency ?? 0)
      )
    )
  })

  it("makes double-team pressure affect primary creator turnovers", () => {
    const lowConfig = createStandardGameSimulationConfig()
    lowConfig.defense.doubleTeamRate = 0
    const highConfig = createStandardGameSimulationConfig()
    highConfig.defense.doubleTeamRate = 100
    const lowResults = runSeries(lowConfig)
    const highResults = runSeries(highConfig)

    expect(
      average(
        lowResults.map((result) => result.players["home-1"]?.turnovers ?? 0)
      )
    ).toBeLessThan(
      average(
        highResults.map((result) => result.players["home-1"]?.turnovers ?? 0)
      )
    )
  })

  it("uses defender fit and stamina to change possession efficiency", () => {
    const lowDefenseConfig = createStandardGameSimulationConfig()
    const highDefenseConfig = createStandardGameSimulationConfig()
    const lowDefense = runSeries(lowDefenseConfig, (fixture) => {
      for (const playerId of Object.keys(fixture.players).filter((id) =>
        id.startsWith("away-")
      )) {
        fixture.players[playerId]!.profile.skills = {
          ...fixture.players[playerId]!.profile.skills,
          defense: 20,
          basketballIQ: 20,
        }
        fixture.players[playerId]!.profile.physical = {
          ...fixture.players[playerId]!.profile.physical,
          speed: 25,
          vertical: 25,
        }
      }
    })
    const highDefense = runSeries(highDefenseConfig, (fixture) => {
      for (const playerId of Object.keys(fixture.players).filter((id) =>
        id.startsWith("away-")
      )) {
        fixture.players[playerId]!.profile.skills = {
          ...fixture.players[playerId]!.profile.skills,
          defense: 95,
          basketballIQ: 95,
        }
        fixture.players[playerId]!.profile.physical = {
          ...fixture.players[playerId]!.profile.physical,
          speed: 95,
          vertical: 95,
        }
      }
    })

    expect(
      average(
        highDefense.map((result) => result.teams.home?.offensiveEfficiency ?? 0)
      )
    ).toBeLessThan(
      average(
        lowDefense.map((result) => result.teams.home?.offensiveEfficiency ?? 0)
      )
    )
  })

  it("amplifies non-neutral coaching profiles through coaching influence", () => {
    const lowConfig = createStandardGameSimulationConfig()
    lowConfig.coaching.influence = 0
    const highConfig = createStandardGameSimulationConfig()
    highConfig.coaching.influence = 100
    const customize = (fixture: GameMatchupFixture) => {
      fixture.coaching.home!.pace = 85
      fixture.coaching.away!.pace = 20
      fixture.coaching.home!.shotSelection = 85
      fixture.coaching.away!.shotSelection = 20
    }
    const lowResults = runSeries(lowConfig, customize)
    const highResults = runSeries(highConfig, customize)
    const possessionGap = (result: ReturnType<typeof simulateGameMatchup>) =>
      (result.teams.home?.possessions ?? 0) -
      (result.teams.away?.possessions ?? 0)

    expect(average(highResults.map(possessionGap))).toBeGreaterThan(
      average(lowResults.map(possessionGap))
    )
  })

  it("adds an efficiency edge to home-court advantage", () => {
    const lowConfig = createStandardGameSimulationConfig()
    lowConfig.environment.homeCourtAdvantage = 0
    const highConfig = createStandardGameSimulationConfig()
    highConfig.environment.homeCourtAdvantage = 100
    const lowResults = runSeries(lowConfig)
    const highResults = runSeries(highConfig)
    const scoreGap = (result: ReturnType<typeof simulateGameMatchup>) =>
      (result.teams.home?.points ?? 0) - (result.teams.away?.points ?? 0)

    expect(average(highResults.map(scoreGap))).toBeGreaterThan(
      average(lowResults.map(scoreGap))
    )
  })

  it("matches the current single-game characterization", () => {
    const result = simulateGameMatchup(createFixture())

    expect({
      status: result.status,
      periods: result.periods.length,
      home: {
        points: result.teams.home?.points,
        possessions: result.teams.home?.possessions,
        fieldGoalsMade: result.teams.home?.fieldGoalsMade,
        fieldGoalsAttempted: result.teams.home?.fieldGoalsAttempted,
        threePointersMade: result.teams.home?.threePointersMade,
        threePointersAttempted: result.teams.home?.threePointersAttempted,
        freeThrowsMade: result.teams.home?.freeThrowsMade,
        freeThrowsAttempted: result.teams.home?.freeThrowsAttempted,
        rebounds: result.teams.home?.rebounds,
        assists: result.teams.home?.assists,
        turnovers: result.teams.home?.turnovers,
        steals: result.teams.home?.steals,
        blocks: result.teams.home?.blocks,
        fouls: result.teams.home?.fouls,
      },
      away: {
        points: result.teams.away?.points,
        possessions: result.teams.away?.possessions,
        fieldGoalsMade: result.teams.away?.fieldGoalsMade,
        fieldGoalsAttempted: result.teams.away?.fieldGoalsAttempted,
        threePointersMade: result.teams.away?.threePointersMade,
        threePointersAttempted: result.teams.away?.threePointersAttempted,
        freeThrowsMade: result.teams.away?.freeThrowsMade,
        freeThrowsAttempted: result.teams.away?.freeThrowsAttempted,
        rebounds: result.teams.away?.rebounds,
        assists: result.teams.away?.assists,
        turnovers: result.teams.away?.turnovers,
        steals: result.teams.away?.steals,
        blocks: result.teams.away?.blocks,
        fouls: result.teams.away?.fouls,
      },
      topPlayer: {
        playerId: Object.values(result.players).sort(
          (left, right) => right.points - left.points
        )[0]?.playerId,
        points: Object.values(result.players).sort(
          (left, right) => right.points - left.points
        )[0]?.points,
        opportunities: Object.values(result.players).sort(
          (left, right) => right.points - left.points
        )[0]?.opportunities,
      },
      reconciliation: result.reconciliation.passed,
    }).toEqual({
      status: "completed",
      periods: 4,
      home: {
        points: 95,
        possessions: 109,
        fieldGoalsMade: 36,
        fieldGoalsAttempted: 83,
        threePointersMade: 7,
        threePointersAttempted: 29,
        freeThrowsMade: 16,
        freeThrowsAttempted: 19,
        rebounds: 49,
        assists: 16,
        turnovers: 17,
        steals: 8,
        blocks: 3,
        fouls: 5,
      },
      away: {
        points: 85,
        possessions: 103,
        fieldGoalsMade: 35,
        fieldGoalsAttempted: 85,
        threePointersMade: 7,
        threePointersAttempted: 28,
        freeThrowsMade: 8,
        freeThrowsAttempted: 10,
        rebounds: 48,
        assists: 12,
        turnovers: 13,
        steals: 8,
        blocks: 1,
        fouls: 9,
      },
      topPlayer: {
        playerId: "home-1",
        points: 36,
        opportunities: 32,
      },
      reconciliation: true,
    })
  })

  it("preserves box-score accounting invariants", () => {
    const result = simulateGameMatchup(createFixture())
    const teamIds = ["home", "away"] as const
    const playerFields = [
      "points",
      "fieldGoalsMade",
      "fieldGoalsAttempted",
      "threePointersMade",
      "threePointersAttempted",
      "freeThrowsMade",
      "freeThrowsAttempted",
      "offensiveRebounds",
      "defensiveRebounds",
      "rebounds",
      "assists",
      "turnovers",
      "steals",
      "blocks",
      "fouls",
    ] as const

    expect(result.reconciliation.passed).toBe(true)
    for (const teamId of teamIds) {
      const team = result.teams[teamId]!
      const players = Object.values(result.players).filter(
        (player) => player.teamId === teamId
      )
      const sumPlayerField = (field: (typeof playerFields)[number]) =>
        players.reduce((total, player) => total + player[field], 0)
      const periodPoints = result.periods.reduce(
        (total, period) => total + (period.teamPoints[teamId] ?? 0),
        0
      )
      const shotAttempts =
        team.shotProfile.rimAttempts +
        team.shotProfile.midrangeAttempts +
        team.shotProfile.threePointAttempts

      expect(team.points).toBe(
        team.fieldGoalsMade * 2 + team.threePointersMade + team.freeThrowsMade
      )
      expect(team.fieldGoalsMade).toBeLessThanOrEqual(team.fieldGoalsAttempted)
      expect(team.threePointersMade).toBeLessThanOrEqual(
        team.threePointersAttempted
      )
      expect(team.threePointersMade).toBeLessThanOrEqual(team.fieldGoalsMade)
      expect(team.freeThrowsMade).toBeLessThanOrEqual(team.freeThrowsAttempted)
      expect(team.fieldGoalsAttempted).toBe(shotAttempts)
      expect(team.shotProfile.threePointAttempts).toBe(
        team.threePointersAttempted
      )
      expect(team.rebounds).toBe(
        team.offensiveRebounds + team.defensiveRebounds
      )
      expect(team.points).toBe(periodPoints)
      for (const field of playerFields) {
        expect(team[field]).toBe(sumPlayerField(field))
      }

      const minutes = players.reduce(
        (total, player) => total + player.minutes,
        0
      )
      const expectedMinutes =
        result.periods.reduce((total, period) => total + period.minutes, 0) * 5
      expect(minutes).toBeCloseTo(expectedMinutes, 0)
    }
  })
})
