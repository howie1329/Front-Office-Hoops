import { describe, expect, it } from "vitest"

import { RATING_MAX, RATING_MIN, VETERAN_TAG } from "@workspace/shared/constants"
import type { LeagueRecord, Player, TeamWithRoster } from "@workspace/shared/types"

import { beginOffseason } from "../src/beginOffseason"
import { applyOffseasonProgression } from "../src/development/applyOffseasonProgression"
import { collectModifiers } from "../src/development/collectModifiers"
import { progressPlayer } from "../src/development/progressPlayer"
import { createLeague, createRng, simulateSeason, startNextSeason } from "../src"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { simulatePlayoffs } from "../src/simulatePlayoffs"
import { normalizeLeagueRecord } from "../src/normalizeLeague"

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p_test_01",
    teamId: "team_test",
    firstName: "Test",
    lastName: "Player",
    age: 20,
    peakAge: 28,
    heightInches: 78,
    weightLbs: 210,
    position: "SG",
    ratings: {
      overall: 55,
      potential: 75,
      shooting: 55,
      inside: 55,
      passing: 55,
      rebounding: 55,
      defense: 55,
      stamina: 55,
      usage: 15,
    },
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: 0,
    ...overrides,
  }
}

function sumSkills(player: Player): number {
  const { shooting, inside, passing, rebounding, defense, stamina } = player.ratings
  return shooting + inside + passing + rebounding + defense + stamina
}

function createTestTeam(players: Player[]): TeamWithRoster {
  return {
    id: "team_test",
    name: "Test Team",
    abbrev: "TST",
    overall: 60,
    pace: 100,
    players,
  }
}

describe("player development", () => {
  it("develops a young high-potential player", () => {
    const player = createTestPlayer({
      age: 20,
      peakAge: 30,
      ratings: {
        overall: 50,
        potential: 80,
        shooting: 50,
        inside: 50,
        passing: 50,
        rebounding: 50,
        defense: 50,
        stamina: 50,
        usage: 12,
      },
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "dev-seed")

    expect(progressed.age).toBe(21)
    expect(progressed.ratings.overall).toBeGreaterThan(50)
  })

  it("regresses an old player past peak", () => {
    const player = createTestPlayer({
      age: 34,
      peakAge: 30,
      ratings: {
        overall: 70,
        potential: 72,
        shooting: 70,
        inside: 70,
        passing: 70,
        rebounding: 70,
        defense: 70,
        stamina: 70,
        usage: 20,
      },
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "regression-seed")

    expect(progressed.age).toBe(35)
    expect(progressed.ratings.overall).toBeLessThan(70)
  })

  it("changes little for a player already at their ceiling near peak", () => {
    const player = createTestPlayer({
      age: 27,
      peakAge: 28,
      ratings: {
        overall: 78,
        potential: 78,
        shooting: 78,
        inside: 78,
        passing: 78,
        rebounding: 78,
        defense: 78,
        stamina: 78,
        usage: 22,
      },
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "ceiling-seed")

    expect(Math.abs(progressed.ratings.overall - 78)).toBeLessThanOrEqual(2)
  })

  it("produces different trajectories for different peak ages at the same age", () => {
    const youngEarlyPeak = createTestPlayer({
      id: "p_early",
      age: 24,
      peakAge: 26,
      ratings: {
        overall: 60,
        potential: 75,
        shooting: 60,
        inside: 60,
        passing: 60,
        rebounding: 60,
        defense: 60,
        stamina: 60,
        usage: 15,
      },
    })
    const youngLatePeak = createTestPlayer({
      id: "p_late",
      age: 24,
      peakAge: 32,
      ratings: youngEarlyPeak.ratings,
    })
    const team = createTestTeam([youngEarlyPeak, youngLatePeak])

    const early = progressPlayer(youngEarlyPeak, team, 1, [], "peak-age-seed")
    const late = progressPlayer(youngLatePeak, team, 1, [], "peak-age-seed")

    expect(late.ratings.overall).toBeGreaterThan(early.ratings.overall)
  })

  it("boosts young player growth when veterans are on the roster", () => {
    const youngPlayer = createTestPlayer({
      id: "p_young",
      age: 20,
      peakAge: 30,
      ratings: {
        overall: 50,
        potential: 80,
        shooting: 50,
        inside: 50,
        passing: 50,
        rebounding: 50,
        defense: 50,
        stamina: 50,
        usage: 12,
      },
    })
    const veteran = createTestPlayer({
      id: "p_vet",
      age: 33,
      peakAge: 30,
      tags: [VETERAN_TAG],
      ratings: {
        overall: 68,
        potential: 68,
        shooting: 68,
        inside: 68,
        passing: 68,
        rebounding: 68,
        defense: 68,
        stamina: 68,
        usage: 18,
      },
    })

    const withoutVet = progressPlayer(
      youngPlayer,
      createTestTeam([youngPlayer]),
      1,
      [],
      "vet-seed",
    )
    const withVet = progressPlayer(
      youngPlayer,
      createTestTeam([youngPlayer, veteran]),
      1,
      [],
      "vet-seed",
    )

    expect(sumSkills(withVet)).toBeGreaterThan(sumSkills(withoutVet))
  })

  it("applies a veteran regression modifier for post-peak players", () => {
    const agingStar = createTestPlayer({
      id: "p_star",
      age: 33,
      peakAge: 30,
    })
    const veteran = createTestPlayer({
      id: "p_vet",
      age: 35,
      peakAge: 31,
      tags: [VETERAN_TAG],
    })
    const team = createTestTeam([agingStar, veteran])

    const modifiers = collectModifiers({
      player: { ...agingStar, age: agingStar.age + 1 },
      team,
      season: 1,
      teammates: [veteran],
      rng: createRng("vet-modifier-seed"),
    })

    expect(
      modifiers.some(
        (modifier) =>
          modifier.id === "team:veteran_mentorship_regression" &&
          modifier.regressionMultiplier !== undefined &&
          modifier.regressionMultiplier < 1,
      ),
    ).toBe(true)
  })

  it("is deterministic for the same seed", () => {
    const player = createTestPlayer()
    const team = createTestTeam([player])

    const first = progressPlayer(player, team, 1, [], "deterministic-seed")
    const second = progressPlayer(player, team, 1, [], "deterministic-seed")

    expect(second).toEqual(first)
  })

  it("keeps ratings within bounds", () => {
    const player = createTestPlayer({
      age: 38,
      peakAge: 30,
      ratings: {
        overall: 45,
        potential: 45,
        shooting: 45,
        inside: 45,
        passing: 45,
        rebounding: 45,
        defense: 45,
        stamina: 45,
        usage: 10,
      },
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "bounds-seed")

    for (const skill of [
      "shooting",
      "inside",
      "passing",
      "rebounding",
      "defense",
      "stamina",
    ] as const) {
      expect(progressed.ratings[skill]).toBeGreaterThanOrEqual(RATING_MIN)
      expect(progressed.ratings[skill]).toBeLessThanOrEqual(RATING_MAX)
    }

    expect(progressed.ratings.overall).toBeGreaterThanOrEqual(RATING_MIN)
    expect(progressed.ratings.overall).toBeLessThanOrEqual(RATING_MAX)
    expect(progressed.ratings.potential).toBeGreaterThanOrEqual(RATING_MIN)
    expect(progressed.ratings.potential).toBeLessThanOrEqual(RATING_MAX)
  })

  it("updates team overall after progression", () => {
    const player = createTestPlayer({
      age: 20,
      peakAge: 30,
      ratings: {
        overall: 50,
        potential: 80,
        shooting: 50,
        inside: 50,
        passing: 50,
        rebounding: 50,
        defense: 50,
        stamina: 50,
        usage: 12,
      },
    })
    const team = createTestTeam([player])
    const [updatedTeam] = applyOffseasonProgression(
      [team],
      1,
      [],
      "team-overall-seed",
      createRng("team-overall-seed"),
    )

    expect(updatedTeam!.players[0]!.ratings.overall).toBeGreaterThan(50)
    expect(updatedTeam!.overall).toBe(updatedTeam!.players[0]!.ratings.overall)
  })

  it("adds the veteran tag when a player ages into veteran status", () => {
    const player = createTestPlayer({
      age: 29,
      peakAge: 31,
      tags: [],
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "veteran-tag-seed")

    expect(progressed.tags).toContain(VETERAN_TAG)
  })
})

describe("offseason phase", () => {
  it("begins offseason from a completed season and applies progression", () => {
    const league = createLeague({
      name: "Offseason Test",
      baseSeed: "offseason-test",
      rng: createRng("offseason-test"),
      useMiniLeague: true,
    })

    let state = simulateSeason(league.seasonState)
    state = beginPlayoffs(state)
    state = simulatePlayoffs(state)
    expect(state.phase).toBe("complete")

    const firstPlayer = state.teams[0]!.players[0]!
    const beforeOverall = firstPlayer.ratings.overall
    const beforeAge = firstPlayer.age

    state = beginOffseason(state, createRng("offseason-test:offseason:1"))

    expect(state.phase).toBe("offseason")
    expect(state.teams[0]!.players[0]!.age).toBe(beforeAge + 1)
    expect(state.teams[0]!.players[0]!.ratings.overall).not.toBe(beforeOverall)
  })

  it("requires offseason before starting the next season", () => {
    const league = createLeague({
      name: "Offseason Guard",
      baseSeed: "offseason-guard",
      rng: createRng("offseason-guard"),
      useMiniLeague: true,
    })

    let state = simulateSeason(league.seasonState)
    state = beginPlayoffs(state)
    state = simulatePlayoffs(state)

    expect(() =>
      startNextSeason({
        seasonState: state,
        userTeamId: league.userTeamId,
        freeAgentPool: [],
        rng: createRng("offseason-guard-next"),
      }),
    ).toThrow("offseason")

    state = beginOffseason(state, createRng("offseason-guard:offseason:1"))
    const next = startNextSeason({
      seasonState: state,
      userTeamId: league.userTeamId,
      freeAgentPool: [],
      rng: createRng("offseason-guard-next"),
    })

    expect(next.seasonState.season).toBe(2)
    expect(next.seasonState.phase).toBe("regular")
  })

  it("migrates older saves without peakAge and tags", () => {
    const league = createLeague({
      name: "Migration Test",
      baseSeed: "migration-test",
      rng: createRng("migration-test"),
      useMiniLeague: true,
    })

    const legacyRecord = {
      ...league,
      saveVersion: 2 as const,
      seasonState: {
        ...league.seasonState,
        teams: league.seasonState.teams.map((team) => ({
          ...team,
          players: team.players.map(({ peakAge: _peakAge, tags: _tags, ...player }) => player),
        })),
      },
    }

    const normalized = normalizeLeagueRecord(legacyRecord as unknown as LeagueRecord)

    expect(normalized.saveVersion).toBe(5)
    for (const team of normalized.seasonState.teams) {
      for (const player of team.players) {
        expect(player.peakAge).toBeGreaterThanOrEqual(26)
        expect(player.tags).toBeDefined()
      }
    }
  })
})
