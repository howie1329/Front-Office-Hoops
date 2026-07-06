import { describe, expect, it } from "vitest"

import type { Game, PlayerGameStats } from "@workspace/shared/types"

import { createRng } from "../src/rng"
import { createInitialSeason } from "../src/createInitialSeason"
import {
  derivePlayerSeasonStats,
  sortPlayerSeasonStats,
} from "../src/derivePlayerSeasonStats"
import { simulateDay } from "../src/simulateDay"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

function makePlayerLine(
  overrides: Partial<PlayerGameStats> & Pick<PlayerGameStats, "playerId" | "teamId">,
): PlayerGameStats {
  return {
    starter: false,
    minutes: 0,
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
    ...overrides,
  }
}

function makeGame(
  id: string,
  day: number,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  homePlayerStats: PlayerGameStats[],
  awayPlayerStats: PlayerGameStats[],
): Game {
  const winnerId = homeScore > awayScore ? homeTeamId : awayTeamId

  return {
    id,
    season: 1,
    day,
    homeTeamId,
    awayTeamId,
    rngSeed: `test:${id}`,
    rngNonce: 0,
    result: {
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      winnerId,
      meta: {
        homePossessions: 100,
        awayPossessions: 100,
        homeOffRtg: 108,
        awayOffRtg: 108,
      },
      homeQuarterScores: [homeScore, 0, 0, 0],
      awayQuarterScores: [awayScore, 0, 0, 0],
      homePlayerStats,
      awayPlayerStats,
    },
  }
}

describe("derivePlayerSeasonStats", () => {
  const memphis = SAMPLE_ROSTERS.find((team) => team.abbrev === "MEM")!
  const reno = SAMPLE_ROSTERS.find((team) => team.abbrev === "RNO")!
  const playerA = memphis.players[0]!
  const playerB = reno.players[0]!

  it("returns an empty array when no games have been played", () => {
    expect(derivePlayerSeasonStats(SAMPLE_ROSTERS, [], 1)).toEqual([])
  })

  it("aggregates a single game's box score", () => {
    const games = [
      makeGame(
        "g1",
        1,
        memphis.id,
        reno.id,
        110,
        102,
        [
          makePlayerLine({
            playerId: playerA.id,
            teamId: memphis.id,
            starter: true,
            minutes: 32,
            pts: 24,
            reb: 8,
            ast: 5,
            fgm: 9,
            fga: 18,
            tpm: 2,
            tpa: 5,
            ftm: 4,
            fta: 5,
          }),
        ],
        [
          makePlayerLine({
            playerId: playerB.id,
            teamId: reno.id,
            starter: true,
            minutes: 28,
            pts: 18,
            reb: 4,
            ast: 3,
            fgm: 7,
            fga: 14,
            tpm: 1,
            tpa: 4,
            ftm: 3,
            fta: 4,
          }),
        ],
      ),
    ]

    const stats = derivePlayerSeasonStats(SAMPLE_ROSTERS, games, 1)
    const playerAStats = stats.find((row) => row.playerId === playerA.id)!
    const playerBStats = stats.find((row) => row.playerId === playerB.id)!

    expect(playerAStats).toMatchObject({
      id: `pss_1_${playerA.id}`,
      teamId: memphis.id,
      season: 1,
      gp: 1,
      gs: 1,
      min: 32,
      pts: 24,
      reb: 8,
      ast: 5,
      fgm: 9,
      fga: 18,
      tpm: 2,
      tpa: 5,
      ftm: 4,
      fta: 5,
    })

    expect(playerBStats).toMatchObject({
      gp: 1,
      gs: 1,
      min: 28,
      pts: 18,
    })
  })

  it("accumulates stats across multiple games and only counts starts for starters", () => {
    const games = [
      makeGame("g1", 1, memphis.id, reno.id, 100, 90, [
        makePlayerLine({
          playerId: playerA.id,
          teamId: memphis.id,
          starter: true,
          minutes: 30,
          pts: 20,
        }),
      ], []),
      makeGame("g2", 2, reno.id, memphis.id, 95, 88, [], [
        makePlayerLine({
          playerId: playerA.id,
          teamId: memphis.id,
          starter: false,
          minutes: 22,
          pts: 12,
        }),
      ]),
    ]

    const stats = derivePlayerSeasonStats(SAMPLE_ROSTERS, games, 1)
    const playerAStats = stats.find((row) => row.playerId === playerA.id)!

    expect(playerAStats.gp).toBe(2)
    expect(playerAStats.gs).toBe(1)
    expect(playerAStats.min).toBe(52)
    expect(playerAStats.pts).toBe(32)
  })

  it("produces identical output when derived twice from the same games", () => {
    const season = createInitialSeason(
      SAMPLE_ROSTERS,
      "pss-determinism",
      createRng("season"),
    )
    const afterDay = simulateDay(season, 1)

    const first = derivePlayerSeasonStats(
      afterDay.teams,
      afterDay.games,
      afterDay.season,
    )
    const second = derivePlayerSeasonStats(
      afterDay.teams,
      afterDay.games,
      afterDay.season,
    )

    expect(second).toEqual(first)
  })

  it("matches simulateDay state after integration", () => {
    const season = createInitialSeason(
      SAMPLE_ROSTERS,
      "pss-integration",
      createRng("season"),
    )
    const afterDay = simulateDay(season, 1)

    const manual = derivePlayerSeasonStats(
      afterDay.teams,
      afterDay.games,
      afterDay.season,
    )

    expect(afterDay.playerSeasonStats).toEqual(manual)
    expect(afterDay.playerSeasonStats.length).toBeGreaterThan(0)
  })
})

describe("sortPlayerSeasonStats", () => {
  it("sorts by points descending, then player id", () => {
    const sorted = sortPlayerSeasonStats([
      {
        id: "pss_1_b",
        playerId: "b",
        teamId: "t1",
        season: 1,
        gp: 1,
        gs: 1,
        min: 20,
        pts: 10,
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
      },
      {
        id: "pss_1_a",
        playerId: "a",
        teamId: "t1",
        season: 1,
        gp: 1,
        gs: 1,
        min: 20,
        pts: 20,
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
      },
    ])

    expect(sorted.map((row) => row.playerId)).toEqual(["a", "b"])
  })
})
