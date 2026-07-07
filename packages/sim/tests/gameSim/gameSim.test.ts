import { describe, expect, it } from "vitest"

import { createRng } from "../../src/rng"
import { SAMPLE_ROSTERS } from "../../src/sampleRosters"
import { simulateTeamMatchup } from "../../src/simulateTeamMatchup"

const memphis = SAMPLE_ROSTERS.find((team) => team.abbrev === "MEM")!
const reno = SAMPLE_ROSTERS.find((team) => team.abbrev === "RNO")!

describe("gameSim segments", () => {
  it("sums quarter scores to the final score", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("segments-quarters"),
    )

    expect(result.homeQuarterScores.reduce((sum, pts) => sum + pts, 0)).toBe(
      result.homeScore,
    )
    expect(result.awayQuarterScores.reduce((sum, pts) => sum + pts, 0)).toBe(
      result.awayScore,
    )
  })

  it("records segment metadata for each regulation period", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("segments-meta"),
    )

    const regulationSegments =
      result.meta.segments?.filter((segment) => segment.kind !== "ot") ?? []

    expect(regulationSegments).toHaveLength(4)
    expect(regulationSegments.map((segment) => segment.kind)).toEqual([
      "q1",
      "q2",
      "q3",
      "q4",
    ])
  })
})

describe("gameSim overtime", () => {
  it("never ends tied", () => {
    for (let i = 0; i < 100; i++) {
      const result = simulateTeamMatchup(
        { home: memphis, away: reno },
        createRng(`ot-check-${i}`),
      )

      expect(result.homeScore).not.toBe(result.awayScore)
    }
  })
})

describe("gameSim synergy", () => {
  it("exposes lineup synergy grades", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("synergy-grade"),
    )

    expect(result.meta.homeSynergy?.grade).toMatch(/^[ABCDF]$/)
    expect(result.meta.awaySynergy?.grade).toMatch(/^[ABCDF]$/)
    expect(result.meta.homeSynergy?.score).toBeGreaterThanOrEqual(0)
    expect(result.meta.homeSynergy?.score).toBeLessThanOrEqual(100)
  })
})

describe("gameSim momentum", () => {
  it("applies momentum modifiers from input state", () => {
    const withMomentum = simulateTeamMatchup(
      {
        home: memphis,
        away: reno,
        homeMomentum: { rollingNetRtg: 12, sampleSize: 5 },
        homeStreak: 4,
      },
      createRng("momentum-hot"),
    )

    expect(withMomentum.meta.homeMomentumApplied).toBeGreaterThan(0)
  })
})

describe("gameSim calibration", () => {
  it("keeps league distributions in realistic ranges", () => {
    const scores: number[] = []
    const fgPct: number[] = []
    const tpPct: number[] = []
    const ast: number[] = []
    const tov: number[] = []
    const reb: number[] = []
    const margins: number[] = []
    let overtimeGames = 0
    let homeWins = 0

    for (let i = 0; i < 500; i++) {
      const home = SAMPLE_ROSTERS[i % SAMPLE_ROSTERS.length]!
      const away = SAMPLE_ROSTERS[(i + 2) % SAMPLE_ROSTERS.length]!
      const result = simulateTeamMatchup(
        { home, away },
        createRng(`calibration-${i}`),
      )

      const homeStats = result.meta.homeTeamStats!
      const awayStats = result.meta.awayTeamStats!

      scores.push(result.homeScore, result.awayScore)
      fgPct.push(homeStats.fgm / homeStats.fga, awayStats.fgm / awayStats.fga)
      tpPct.push(homeStats.tpm / homeStats.tpa, awayStats.tpm / awayStats.tpa)
      ast.push(homeStats.ast, awayStats.ast)
      tov.push(homeStats.tov, awayStats.tov)
      reb.push(homeStats.orb + homeStats.drb, awayStats.orb + awayStats.drb)
      margins.push(Math.abs(result.homeScore - result.awayScore))

      if ((result.meta.overtimes ?? 0) > 0) {
        overtimeGames += 1
      }

      if (result.winnerId === home.id) {
        homeWins += 1
      }
    }

    const avg = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length
    const pctInRange = (values: number[], lo: number, hi: number) =>
      values.filter((value) => value >= lo && value <= hi).length / values.length

    expect(avg(scores)).toBeGreaterThanOrEqual(100)
    expect(avg(scores)).toBeLessThanOrEqual(120)
    expect(pctInRange(scores, 85, 135)).toBeGreaterThanOrEqual(0.85)
    expect(avg(fgPct)).toBeGreaterThanOrEqual(0.39)
    expect(avg(fgPct)).toBeLessThanOrEqual(0.5)
    expect(avg(tpPct)).toBeGreaterThanOrEqual(0.31)
    expect(avg(tpPct)).toBeLessThanOrEqual(0.4)
    expect(avg(ast)).toBeGreaterThanOrEqual(18)
    expect(avg(ast)).toBeLessThanOrEqual(32)
    expect(avg(tov)).toBeGreaterThanOrEqual(10)
    expect(avg(tov)).toBeLessThanOrEqual(18)
    expect(avg(reb)).toBeGreaterThanOrEqual(36)
    expect(avg(reb)).toBeLessThanOrEqual(54)
    expect(pctInRange(margins, 20, 999)).toBeGreaterThanOrEqual(0.08)
    expect(overtimeGames / 500).toBeGreaterThanOrEqual(0.005)
    expect(homeWins / 500).toBeGreaterThanOrEqual(0.48)
    expect(homeWins / 500).toBeLessThanOrEqual(0.68)
  })
})
