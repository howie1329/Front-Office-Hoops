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
import { applyPreseasonProgression } from "../src/preseason/applyPreseasonProgression"
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
import { pastStaffPhaseState } from "./helpers/offseason"

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

function runProgress(
  player: Player,
  team: TeamWithRoster,
  baseSeed: string,
  playerSeasonProfiles: PlayerSeasonProfile[] = [],
  playerSeasonStats: PlayerSeasonStats[] = [],
): Player {
  const result = progressPlayer({
    player,
    team,
    priorSeason: 1,
    newSeason: 2,
    playerSeasonStats,
    playerSeasonProfiles,
    baseSeed,
  })

  expect(result.player).not.toBeNull()
  return result.player!
}

function createTestTeam(players: Player[]): TeamWithRoster {
  return {
    id: "team_test",
    name: "Test Team",
    abbrev: "TST",
    overall: 60,
    players,
  }
}

function createSeasonStats(
  player: Player,
  overrides: Partial<PlayerSeasonStats> = {},
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
  overrides: Partial<PlayerSeasonProfile> = {},
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

    const progressed = runProgress(player, team, "dev-seed")

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

    const progressed = runProgress(player, team, "regression-seed")

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

    const progressed = runProgress(player, team, "ceiling-seed")

    expect(Math.abs(progressed.ratings.overall - 78)).toBeLessThanOrEqual(3)
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

    const early = runProgress(youngEarlyPeak, team, "peak-age-seed")
    const late = runProgress(youngLatePeak, team, "peak-age-seed")

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

    const withoutVet = runProgress(
      youngPlayer,
      createTestTeam([youngPlayer]),
      "vet-seed",
    )
    const withVet = runProgress(
      youngPlayer,
      createTestTeam([youngPlayer, veteran]),
      "vet-seed",
    )

    expect(withVet.ratings.overall).toBeGreaterThanOrEqual(
      withoutVet.ratings.overall,
    )
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

    const first = runProgress(player, team, "deterministic-seed")
    const second = runProgress(player, team, "deterministic-seed")

    expect(second).toEqual(first)
  })

  it("keeps ratings within bounds", () => {
    const player = createTestPlayer({
      age: 38,
      peakAge: 30,
      ratings: makeTestRatings({ overall: 45, potential: 45, usage: 10 }),
    })
    const team = createTestTeam([player])

    const progressed = runProgress(player, team, "bounds-seed")

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
    const result = applyPreseasonProgression({
      teams: [team],
      priorSeason: 1,
      newSeason: 2,
      playerSeasonStats: [],
      playerSeasonProfiles: [],
      baseSeed: "team-overall-seed",
    })
    const updatedTeam = result.teams[0]!

    expect(updatedTeam.players[0]!.ratings.overall).toBeGreaterThan(50)
    expect(updatedTeam.overall).toBe(updatedTeam.players[0]!.ratings.overall)
    expect(result.records.length).toBeGreaterThan(0)
  })

  it("ages and develops unsigned players during preseason progression", () => {
    const freeAgent = createTestPlayer({
      id: "p_unsigned",
      teamId: null,
      status: "free_agent",
      age: 20,
      peakAge: 30,
      ratings: makeTestRatings({ overall: 50, potential: 80, usage: 12 }),
    })

    const result = applyPreseasonProgression({
      teams: [],
      freeAgentPool: [freeAgent],
      priorSeason: 1,
      newSeason: 2,
      playerSeasonStats: [],
      playerSeasonProfiles: [],
      baseSeed: "unsigned-progression-seed",
    })
    const progressed = result.freeAgentPool[0]!

    expect(progressed.age).toBe(21)
    expect(progressed.teamId).toBeNull()
    expect(progressed.status).toBe("free_agent")
    expect(progressed.ratings.overall).toBeGreaterThan(50)
    expect(result.records).toContainEqual(
      expect.objectContaining({
        playerId: freeAgent.id,
        teamId: "free_agent_pool",
        ageBefore: 20,
        ageAfter: 21,
      }),
    )
  })

  it("can retire unsigned players during preseason progression", () => {
    const freeAgents = Array.from({ length: 20 }, (_, index) =>
      createTestPlayer({
        id: `p_unsigned_veteran_${index}`,
        teamId: null,
        status: "free_agent",
        age: 38,
        careerPeakOverall: 85,
        ratings: makeTestRatings({ overall: 60, potential: 60, usage: 12 }),
        injuryHistory: {
          totalGamesMissed: 100,
          majorInjuryCount: 2,
          lastMajorInjurySeason: 1,
        },
      }),
    )

    const result = applyPreseasonProgression({
      teams: [],
      freeAgentPool: freeAgents,
      priorSeason: 1,
      newSeason: 2,
      playerSeasonStats: [],
      playerSeasonProfiles: [],
      baseSeed: "unsigned-retirement-seed",
    })

    expect(result.retirements.length).toBeGreaterThan(0)
    expect(
      result.freeAgentPool.some((player) =>
        result.retirements.some((retirement) => retirement.playerId === player.id),
      ),
    ).toBe(false)
  })

  it("adds the veteran tag when a player ages into veteran status", () => {
    const player = createTestPlayer({
      age: 29,
      peakAge: 31,
      tags: [],
    })
    const team = createTestTeam([player])

    const progressed = runProgress(player, team, "veteran-tag-seed")

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
      1,
    )

    expect(
      profiles.find((entry) => entry.playerId === starter.id),
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
      profiles.find((entry) => entry.playerId === inactive.id),
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

    const withoutProfile = runProgress(player, team, "role-opportunity-seed")
    const withProfile = runProgress(
      player,
      team,
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
      ],
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

    const neutral = runProgress(player, team, "role-buried-seed")
    const buried = runProgress(player, team, "role-buried-seed", [
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

  it("records development reasons on progression", () => {
    const player = createTestPlayer({ age: 21, peakAge: 29 })
    const team = createTestTeam([player])
    const result = progressPlayer({
      player,
      team,
      priorSeason: 1,
      newSeason: 2,
      playerSeasonStats: [],
      playerSeasonProfiles: [],
      baseSeed: "record-seed",
    })

    expect(result.record.modifierIds.length).toBeGreaterThanOrEqual(0)
    expect(result.record.events.some((e) => e.startsWith("potential:"))).toBe(
      true,
    )
  })
})

describe("preseason progression phase", () => {
  it("begins offseason without aging players", () => {
    const league = createLeague({
      skipPreseason: true,
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

    state = beginOffseason(state)

    expect(state.phase).toBe("offseason")
    for (const before of beforePlayers) {
      const after = state.teams[0]!.players.find(
        (player) => player.id === before.id,
      )!
      expect(after.age).toBe(before.age)
      expect(after.ratings.overall).toBe(before.overall)
    }
  })

  it("requires offseason before starting the next season", () => {
    const league = createLeague({
      skipPreseason: true,
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

    state = beginOffseason(state)
    const prepared = prepareDraft(
      advanceToDraftPhase(pastStaffPhaseState(state, league)),
    )
    const completed = simDraftUntilComplete(prepared, [])
    const trimmed = applyAiRosterTrimming(
      completed.seasonState.teams,
      completed.freeAgentPool,
      null,
    )
    const next = startNextSeason({
      seasonState: {
        ...advanceToFreeAgencyPhase(completed.seasonState),
        teams: trimmed.teams,
      },
      userTeamId: league.userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("offseason-guard-next"),
      playerSeasonProfiles: league.playerSeasonProfiles,
      seasonHistory: league.seasonHistory,
    })

    expect(next.seasonState.season).toBe(2)
    expect(next.seasonState.phase).toBe("preseason")
    expect(next.playerDevelopmentRecords.length).toBeGreaterThan(0)
    expect(next.developmentReport.season).toBe(2)
  })
})
