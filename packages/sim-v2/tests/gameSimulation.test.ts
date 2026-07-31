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
  return {
    ...player,
    profile: {
      ...player.profile,
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
            playerIds.map((playerId, index) => [
              playerId,
              index < 5 ? 32 : 8,
            ])
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

    expect(diagnostics.some((entry) => entry.code === "unavailable-starter")).toBe(
      true
    )
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
    fixture.rotations.home!.starters = ["home-2", "home-3", "home-4", "home-5", "home-6"]

    const result = simulateGameMatchup(fixture)

    expect(result.status).toBe("completed")
    expect(result.players["home-1"]?.minutes).toBeLessThanOrEqual(12)
  })
})
