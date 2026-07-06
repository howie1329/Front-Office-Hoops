import { describe, expect, it } from "vitest"

import type { Game } from "@workspace/shared/types"

import { deriveStandings } from "../src/deriveStandings"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

function makeGame(
  id: string,
  day: number,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
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
      homePlayerStats: [],
      awayPlayerStats: [],
    },
  }
}

describe("deriveStandings", () => {
  const memphis = SAMPLE_ROSTERS.find((team) => team.abbrev === "MEM")!
  const reno = SAMPLE_ROSTERS.find((team) => team.abbrev === "RNO")!
  const baltimore = SAMPLE_ROSTERS.find((team) => team.abbrev === "BAL")!

  it("computes wins, losses, and points", () => {
    const games = [
      makeGame("g1", 1, memphis.id, reno.id, 110, 102),
      makeGame("g2", 2, baltimore.id, memphis.id, 98, 105),
    ]

    const standings = deriveStandings(SAMPLE_ROSTERS, games, 1)
    const memphisStanding = standings.find((row) => row.teamId === memphis.id)!
    const renoStanding = standings.find((row) => row.teamId === reno.id)!
    const baltimoreStanding = standings.find((row) => row.teamId === baltimore.id)!

    expect(memphisStanding.wins).toBe(2)
    expect(memphisStanding.losses).toBe(0)
    expect(memphisStanding.pointsFor).toBe(215)
    expect(memphisStanding.pointsAgainst).toBe(200)
    expect(memphisStanding.streak).toBe(2)

    expect(renoStanding.wins).toBe(0)
    expect(renoStanding.losses).toBe(1)
    expect(renoStanding.streak).toBe(-1)

    expect(baltimoreStanding.wins).toBe(0)
    expect(baltimoreStanding.losses).toBe(1)
    expect(baltimoreStanding.streak).toBe(-1)
  })
})
