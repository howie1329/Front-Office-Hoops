import { describe, expect, it } from "vitest"

import {
  RATING_MAX,
  RATING_MIN,
  VETERAN_TAG,
} from "@workspace/shared/constants"
import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

import { beginOffseason } from "../src/beginOffseason"
import { applyOffseasonProgression } from "../src/development/applyOffseasonProgression"
import { collectModifiers } from "../src/development/collectModifiers"
import { progressPlayer } from "../src/development/progressPlayer"
import { derivePlayerSeasonProfiles } from "../src/playerSeasonProfiles"
import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  createLeague,
  createRng,
  prepareDraft,
  simDraftUntilComplete,
  simulateSeason,
  startNextSeason,
} from "../src"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"
import { makeTestPlayer, makeTestRatings } from "./helpers/playerRatings"

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  const { ratings: ratingOverrides, ...rest } = overrides

  return makeTestPlayer({
    id: "p_test_01",
    teamId: "team_test",
    age: 20,
    peakAge: 28,
    seasonsWithTeam: 0,
    yearsOfService: 0,
    ...rest,
    ratings: makeTestRatings({
      overall: 55,
      potential: 75,
      usage: 15,
      ...(ratingOverrides ?? {}),
    }),
  })
}

function sumSkills(player: Player): number {
  const {
    threePoint,
    midRange,
    freeThrow,
    inside,
    passing,
    ballHandling,
    rebounding,
    defense,
    stamina,
    offensiveIQ,
    defensiveIQ,
  } = player.ratings
  return (
    threePoint +
    midRange +
    freeThrow +
    inside +
    passing +
    ballHandling +
    rebounding +
    defense +
    stamina +
    offensiveIQ +
    defensiveIQ
  )
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

function createSeasonStats(
  player: Player,
  overrides: Partial<PlayerSeasonStats> = {}
): PlayerSeasonStats {
  return {
    id: `pss_1_${player.id}`,
    playerId: player.id,
    teamId: player.teamId ?? "team_test",
    season: 1,
    gp: 0,
    gs: 0,
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    ...overrides,
  }
}

function createSeasonProfile(
  player: Player,
  overrides: Partial<PlayerSeasonProfile> = {}
): PlayerSeasonProfile {
  return {
    id: `psp_1_${player.id}`,
    playerId: player.id,
    teamId: player.teamId ?? "team_test",
    season: 1,
    gp: 0,
    gs: 0,
    totalMinutes: 0,
    mpg: 0,
    primaryRole: "inactive",
    gamesMissed: 10,
    usageRateEstimate: 0,
    ...overrides,
  }
}

describe("player development", () => {
  it("develops a young high-potential player", () => {
    const player = createTestPlayer({
      age: 20,
      peakAge: 30,
      ratings: makeTestRatings({ overall: 50, potential: 80, usage: 12 }),
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
      ratings: makeTestRatings({ overall: 70, potential: 72, usage: 20 }),
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "regression-seed")

    expect(progressed.age).toBe(35)
    expect(progressed.ratings.overall).toBeLessThan(70)
  })

  it("changes little for a veteran already near peak", () => {
    const player = createTestPlayer({
      age: 28,
      peakAge: 28,
      ratings: makeTestRatings({ overall: 78, potential: 78, usage: 22 }),
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
      ratings: makeTestRatings({ overall: 60, potential: 75, usage: 15 }),
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
      ratings: makeTestRatings({ overall: 50, potential: 80, usage: 12 }),
    })
    const veteran = createTestPlayer({
      id: "p_vet",
      age: 33,
      peakAge: 30,
      tags: [VETERAN_TAG],
      ratings: makeTestRatings({ overall: 68, potential: 68, usage: 18 }),
    })

    const withoutVet = progressPlayer(
      youngPlayer,
      createTestTeam([youngPlayer]),
      1,
      [],
      "vet-seed"
    )
    const withVet = progressPlayer(
      youngPlayer,
      createTestTeam([youngPlayer, veteran]),
      1,
      [],
      "vet-seed"
    )

    expect(withVet.ratings.overall).toBeGreaterThanOrEqual(withoutVet.ratings.overall)
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
          modifier.regressionMultiplier < 1
      )
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
      ratings: makeTestRatings({ overall: 45, potential: 45, usage: 10 }),
    })
    const team = createTestTeam([player])

    const progressed = progressPlayer(player, team, 1, [], "bounds-seed")

    for (const skill of [
      "threePoint",
      "midRange",
      "freeThrow",
      "inside",
      "passing",
      "ballHandling",
      "rebounding",
      "defense",
      "stamina",
      "offensiveIQ",
      "defensiveIQ",
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
      ratings: makeTestRatings({ overall: 50, potential: 80, usage: 12 }),
    })
    const team = createTestTeam([player])
    const [updatedTeam] = applyOffseasonProgression(
      [team],
      1,
      [],
      "team-overall-seed",
      createRng("team-overall-seed")
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

  it("derives role profiles for starters, bench players, missed games, and inactive roster players", () => {
    const starter = createTestPlayer({ id: "p_starter" })
    const bench = createTestPlayer({ id: "p_bench" })
    const inactive = createTestPlayer({ id: "p_inactive" })
    const team = createTestTeam([starter, bench, inactive])
    const profiles = derivePlayerSeasonProfiles(
      [team],
      [
        createSeasonStats(starter, {
          gp: 10,
          gs: 10,
          min: 330,
          fga: 120,
          fta: 40,
          tov: 20,
        }),
        createSeasonStats(bench, {
          gp: 6,
          min: 72,
          fga: 20,
          fta: 8,
          tov: 4,
        }),
      ],
      5,
      1
    )

    expect(
      profiles.find((entry) => entry.playerId === starter.id)
    ).toMatchObject({
      primaryRole: "star",
      mpg: 33,
      gamesMissed: 0,
    })
    expect(profiles.find((entry) => entry.playerId === bench.id)).toMatchObject({
      primaryRole: "rotation",
      mpg: 12,
      gamesMissed: 4,
    })
    expect(
      profiles.find((entry) => entry.playerId === inactive.id)
    ).toMatchObject({
      primaryRole: "inactive",
      gp: 0,
      gamesMissed: 10,
    })
  })

  it("uses role profiles to boost young players with meaningful minutes", () => {
    const player = createTestPlayer({
      id: "p_opportunity",
      age: 20,
      peakAge: 30,
    })
    const team = createTestTeam([player])

    const withoutProfile = progressPlayer(
      player,
      team,
      1,
      [],
      "role-opportunity-seed"
    )
    const withProfile = progressPlayer(
      player,
      team,
      1,
      [],
      "role-opportunity-seed",
      [
        createSeasonProfile(player, {
          gp: 40,
          gs: 20,
          totalMinutes: 960,
          mpg: 24,
          primaryRole: "starter",
          gamesMissed: 0,
        }),
      ]
    )

    expect(withProfile.ratings.overall).toBeGreaterThanOrEqual(
      withoutProfile.ratings.overall,
    )
  })

  it("uses role profiles to slow buried young player growth", () => {
    const player = createTestPlayer({
      id: "p_buried",
      age: 20,
      peakAge: 30,
    })
    const team = createTestTeam([player])

    const neutral = progressPlayer(player, team, 1, [], "role-buried-seed")
    const buried = progressPlayer(player, team, 1, [], "role-buried-seed", [
      createSeasonProfile(player, {
        gp: 5,
        totalMinutes: 25,
        mpg: 5,
        primaryRole: "bench",
        gamesMissed: 35,
      }),
    ])

    expect(buried.ratings.overall).toBeLessThanOrEqual(neutral.ratings.overall)
  })
})

describe("offseason phase", () => {
  it("begins offseason from a completed season and applies progression", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Offseason Test",
      baseSeed: "offseason-test",
      rng: createRng("offseason-test"),
      useMiniLeague: true,
    })

    let state = simulateSeason(league.seasonState)
    state = beginPlayoffs(state)
    state = simulatePlayoffs(state)
    expect(state.phase).toBe("complete")

    const beforePlayers = state.teams[0]!.players.map((player) => ({
      id: player.id,
      age: player.age,
      overall: player.ratings.overall,
    }))

    state = beginOffseason(state, createRng("offseason-test:offseason:1"))

    expect(state.phase).toBe("offseason")
    for (const before of beforePlayers) {
      const after = state.teams[0]!.players.find(
        (player) => player.id === before.id
      )!
      expect(after.age).toBe(before.age + 1)
    }
    expect(
      state.teams[0]!.players.some((player) => {
        const before = beforePlayers.find((entry) => entry.id === player.id)!
        return player.ratings.overall !== before.overall
      })
    ).toBe(true)
  })

  it("requires offseason before starting the next season", () => {
    const league = createLeague({ skipPreseason: true,
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
      })
    ).toThrow("offseason")

    state = beginOffseason(state, createRng("offseason-guard:offseason:1"))
    const prepared = prepareDraft(advanceToDraftPhase(state))
    const completed = simDraftUntilComplete(prepared, [])
    const trimmed = applyAiRosterTrimming(
      completed.seasonState.teams,
      completed.freeAgentPool,
      null
    )
    const next = startNextSeason({
      seasonState: {
        ...advanceToFreeAgencyPhase(completed.seasonState),
        teams: trimmed.teams,
      },
      userTeamId: league.userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("offseason-guard-next"),
    })

    expect(next.seasonState.season).toBe(2)
    expect(next.seasonState.phase).toBe("preseason")
  })
})
