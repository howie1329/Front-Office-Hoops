import { describe, expect, it } from "vitest"

import type { Team, TeamWithRoster } from "@workspace/shared/types"

import { createRng } from "../src/rng"
import { generateTeamWithRoster } from "../src/generatePlayers"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"
import { simulateTeamMatchup } from "../src/simulateTeamMatchup"

const memphis = SAMPLE_ROSTERS.find((team) => team.abbrev === "MEM")!
const reno = SAMPLE_ROSTERS.find((team) => team.abbrev === "RNO")!
const baltimore = SAMPLE_ROSTERS.find((team) => team.abbrev === "BAL")!
const portland = SAMPLE_ROSTERS.find((team) => team.abbrev === "POR")!

function makeRoster(overall: number, id = "t_test"): TeamWithRoster {
  const team: Team = {
    id,
    name: "Test Team",
    abbrev: "TST",
    overall,
  }

  return generateTeamWithRoster(team, createRng(`${id}-${overall}`))
}

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("abc")
    const b = createRng("abc")

    const valuesA = Array.from({ length: 5 }, () => a.next())
    const valuesB = Array.from({ length: 5 }, () => b.next())

    expect(valuesA).toEqual(valuesB)
  })
})

describe("simulateTeamMatchup", () => {
  it("is deterministic for the same input and seed", () => {
    const input = { home: memphis, away: reno }
    const first = simulateTeamMatchup(input, createRng("abc"))
    const second = simulateTeamMatchup(input, createRng("abc"))

    expect(second).toEqual(first)
  })

  it("usually changes scores for different seeds", () => {
    const input = { home: baltimore, away: portland }
    const results = ["alpha", "beta", "gamma", "delta"].map((seed) =>
      simulateTeamMatchup(input, createRng(seed))
    )

    const uniqueScores = new Set(
      results.map((result) => `${result.homeScore}-${result.awayScore}`)
    )

    expect(uniqueScores.size).toBeGreaterThan(1)
  })

  it("gives the stronger team a meaningful edge over many sims", () => {
    const strong = makeRoster(80, "t_strong")
    const weak = makeRoster(52, "t_weak")
    let strongWins = 0

    for (let i = 0; i < 100; i++) {
      const result = simulateTeamMatchup(
        { home: strong, away: weak },
        createRng(`strong-vs-weak-${i}`)
      )

      if (result.winnerId === strong.id) {
        strongWins += 1
      }
    }

    expect(strongWins).toBeGreaterThan(65)
  })

  it("keeps most scores in a realistic range", () => {
    const scores: number[] = []

    for (let i = 0; i < 200; i++) {
      const home = SAMPLE_ROSTERS[i % SAMPLE_ROSTERS.length]!
      const away = SAMPLE_ROSTERS[(i + 2) % SAMPLE_ROSTERS.length]!
      const result = simulateTeamMatchup(
        { home, away },
        createRng(`score-range-${i}`)
      )

      scores.push(result.homeScore, result.awayScore)
    }

    const inRange = scores.filter((score) => score >= 90 && score <= 130)
    expect(inRange.length / scores.length).toBeGreaterThanOrEqual(0.9)
  })

  it("gives the home team a slight scoring edge on average", () => {
    const homeAsHome: number[] = []
    const homeAsAway: number[] = []

    for (let i = 0; i < 50; i++) {
      const homeResult = simulateTeamMatchup(
        { home: baltimore, away: portland },
        createRng(`home-court-home-${i}`)
      )
      const awayResult = simulateTeamMatchup(
        { home: portland, away: baltimore },
        createRng(`home-court-away-${i}`)
      )

      homeAsHome.push(homeResult.homeScore)
      homeAsAway.push(awayResult.awayScore)
    }

    const avgHome =
      homeAsHome.reduce((sum, score) => sum + score, 0) / homeAsHome.length
    const avgAway =
      homeAsAway.reduce((sum, score) => sum + score, 0) / homeAsAway.length

    expect(avgHome).toBeGreaterThan(avgAway)
  })

  it("never returns a tie", () => {
    for (let i = 0; i < 100; i++) {
      const home = SAMPLE_ROSTERS[i % SAMPLE_ROSTERS.length]!
      const away = SAMPLE_ROSTERS[(i + 1) % SAMPLE_ROSTERS.length]!
      const result = simulateTeamMatchup(
        { home, away },
        createRng(`no-ties-${i}`)
      )

      expect(result.homeScore).not.toBe(result.awayScore)
    }
  })

  it("reconciles player points to team scores", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("reconcile")
    )

    expect(
      result.homePlayerStats.reduce((sum, line) => sum + line.pts, 0)
    ).toBe(result.homeScore)
    expect(
      result.awayPlayerStats.reduce((sum, line) => sum + line.pts, 0)
    ).toBe(result.awayScore)
  })

  it("reconciles quarter scores to team scores", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("quarters")
    )

    expect(result.homeQuarterScores.reduce((sum, pts) => sum + pts, 0)).toBe(
      result.homeScore
    )
    expect(result.awayQuarterScores.reduce((sum, pts) => sum + pts, 0)).toBe(
      result.awayScore
    )
  })

  it("exposes reconciled team stat components in metadata", () => {
    const result = simulateTeamMatchup(
      { home: memphis, away: reno },
      createRng("components")
    )

    expect(result.meta.homeTeamStats).toMatchObject({
      possessions: result.meta.homePossessions,
    })
    expect(result.meta.awayTeamStats).toMatchObject({
      possessions: result.meta.awayPossessions,
    })
    expect(result.meta.homeRotationQuality?.bench).toBeGreaterThan(0)
    expect(result.meta.awayRotationQuality?.bench).toBeGreaterThan(0)
  })
})
