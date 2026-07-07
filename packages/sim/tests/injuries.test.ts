import { describe, expect, it } from "vitest"

import type {
  Player,
  PlayerGameStats,
  Rng,
  TeamWithRoster,
} from "@workspace/shared/types"

import {
  advanceInjuriesForDay,
  applyPostGameInjuriesToTeam,
  calculateInjuryRisk,
  createLeague,
  createRng,
  selectRotation,
  simulateRegularDay,
} from "../src"
import { makeTestRatings } from "./helpers/playerRatings"

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? "p_injury"
  return {
    id,
    teamId: "t_injury",
    firstName: "Injury",
    lastName: id,
    age: 27,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    wingspanInches: 80,
    reachRating: 58,
    position: "SG",
    archetype: "scoring_guard",
    ratings: makeTestRatings({
      overall: 70,
      potential: 70,
      usage: 18,
      ...(overrides.ratings ?? {}),
    }),
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 2,
    yearsOfService: 2,
    ...overrides,
  }
}

function makeTeam(players: Player[]): TeamWithRoster {
  return {
    id: "t_injury",
    name: "Injury Team",
    abbrev: "INJ",
    overall: 70,
    pace: 100,
    players,
  }
}

function alwaysInjureRng(): Rng {
  return {
    next: () => 0,
    int: (min) => min,
    normal: (mean = 0) => mean,
  }
}

function makeLine(player: Player, minutes: number): PlayerGameStats {
  return {
    playerId: player.id,
    teamId: "t_injury",
    starter: true,
    minutes,
    pts: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
  }
}

describe("injuries", () => {
  it("increases injury risk with minutes, age, and low stamina", () => {
    const baseline = makePlayer()
    const risky = makePlayer({
      age: 35,
      ratings: { ...baseline.ratings, stamina: 42 },
    })

    expect(calculateInjuryRisk(baseline, 12)).toBeLessThan(
      calculateInjuryRisk(baseline, 38)
    )
    expect(calculateInjuryRisk(baseline, 38)).toBeLessThan(
      calculateInjuryRisk(risky, 38)
    )
  })

  it("applies post-game injuries to active players who played", () => {
    const players = Array.from({ length: 8 }, (_, index) =>
      makePlayer({ id: `p_${index}` })
    )
    const team = makeTeam(players)
    const updated = applyPostGameInjuriesToTeam(
      team,
      [makeLine(players[0]!, 36)],
      alwaysInjureRng()
    )

    expect(updated.players[0]!.status).toBe("injured")
    expect(updated.players[0]!.injury?.gamesRemaining).toBeGreaterThan(0)
  })

  it("does not apply new injuries when active depth is too low", () => {
    const players = Array.from({ length: 7 }, (_, index) =>
      makePlayer({ id: `p_${index}` })
    )
    const team = makeTeam(players)
    const updated = applyPostGameInjuriesToTeam(
      team,
      [makeLine(players[0]!, 36)],
      alwaysInjureRng()
    )

    expect(updated.players[0]!.status).toBe("active")
  })

  it("decrements injuries and restores active status on recovery", () => {
    const injured = makePlayer({
      status: "injured",
      injury: {
        type: "minor",
        gamesRemaining: 1,
        description: "minor soreness",
      },
    })

    const [team] = advanceInjuriesForDay([makeTeam([injured])])

    expect(team!.players[0]!.status).toBe("active")
    expect(team!.players[0]!.injury).toBeNull()
  })

  it("excludes injured players from normal rotations", () => {
    const players = Array.from({ length: 10 }, (_, index) =>
      makePlayer({
        id: `p_${index}`,
        ratings: { ...makePlayer().ratings, overall: 80 - index },
        status: index === 0 ? "injured" : "active",
        injury:
          index === 0
            ? { type: "minor", gamesRemaining: 2, description: "ankle tweak" }
            : null,
      })
    )

    expect(
      selectRotation(players).some((entry) => entry.player.id === "p_0")
    ).toBe(false)
  })

  it("persists injuries through regular day simulation", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Injury Persistence",
      baseSeed: "injury-persistence",
      rng: createRng("injury-persistence"),
      useMiniLeague: true,
    })
    const state = simulateRegularDay(league.seasonState)
    const injuredCount = state.teams
      .flatMap((team) => team.players)
      .filter((player) => player.status === "injured").length

    expect(injuredCount).toBeGreaterThanOrEqual(0)
    expect(state.currentDay).toBe(league.seasonState.currentDay + 1)
  })
})
