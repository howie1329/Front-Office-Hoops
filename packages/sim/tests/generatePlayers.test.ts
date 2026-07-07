import { describe, expect, it } from "vitest"

import { PLAYERS_PER_TEAM, RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

import { createRng } from "../src/rng"
import { generatePlayers, generateTeamWithRoster } from "../src/generatePlayers"
import { generateTeams } from "../src/generateTeams"

function rosterOverallSpread(players: { ratings: { overall: number } }[]): number {
  const ovrs = players.map((player) => player.ratings.overall)
  return Math.max(...ovrs) - Math.min(...ovrs)
}

describe("generatePlayers", () => {
  const team = SAMPLE_TEAMS[0]!

  it("is deterministic for the same team and seed", () => {
    const first = generatePlayers(team, createRng("roster-a"))
    const second = generatePlayers(team, createRng("roster-a"))

    expect(second).toEqual(first)
  })

  it("creates 12 unique players per team", () => {
    const players = generatePlayers(team, createRng("roster-b"))
    const ids = new Set(players.map((player) => player.id))

    expect(players).toHaveLength(PLAYERS_PER_TEAM)
    expect(ids.size).toBe(PLAYERS_PER_TEAM)
  })

  it("assigns peak age and tags", () => {
    const players = generatePlayers(team, createRng("roster-peak"))

    for (const player of players) {
      expect(player.peakAge).toBeGreaterThanOrEqual(26)
      expect(player.peakAge).toBeLessThanOrEqual(33)
      expect(player.tags).toBeDefined()
    }
  })

  it("keeps ratings within bounds", () => {
    const players = generatePlayers(team, createRng("roster-c"))

    for (const player of players) {
      expect(player.ratings.overall).toBeGreaterThanOrEqual(RATING_MIN)
      expect(player.ratings.overall).toBeLessThanOrEqual(RATING_MAX)
      expect(player.ratings.threePoint).toBeGreaterThanOrEqual(RATING_MIN)
      expect(player.ratings.defense).toBeLessThanOrEqual(RATING_MAX)
    }
  })

  it("updates team overall from roster quality", () => {
    const roster = generateTeamWithRoster(team, createRng("roster-d"))

    expect(roster.overall).toBeGreaterThanOrEqual(RATING_MIN)
    expect(roster.overall).toBeLessThanOrEqual(RATING_MAX)
    expect(roster.players).toHaveLength(PLAYERS_PER_TEAM)
  })

  it("creates realistic roster variance instead of bunching around team overall", () => {
    const memphis = SAMPLE_TEAMS.find((entry) => entry.abbrev === "MEM")!
    const roster = generateTeamWithRoster(memphis, createRng("roster:" + memphis.id))
    const ovrs = roster.players.map((player) => player.ratings.overall)

    expect(rosterOverallSpread(roster.players)).toBeGreaterThanOrEqual(18)
    expect(ovrs.filter((overall) => overall >= 85).length).toBeLessThanOrEqual(2)
    expect(ovrs.filter((overall) => overall < memphis.overall - 8).length).toBeGreaterThanOrEqual(3)
  })

  it("sorts usage by roster quality with highest-minute players first", () => {
    const players = generatePlayers(team, createRng("roster-usage"))

    for (let index = 1; index < players.length; index++) {
      expect(players[index - 1]!.ratings.overall).toBeGreaterThanOrEqual(
        players[index]!.ratings.overall,
      )
      expect(players[index - 1]!.ratings.usage).toBeGreaterThanOrEqual(
        players[index]!.ratings.usage,
      )
    }
  })

  it("keeps derived team overall near the seed for generated league teams", () => {
    const teams = generateTeams(createRng("variance-league"))

    for (const seedTeam of teams) {
      const roster = generateTeamWithRoster(seedTeam, createRng(`roster:${seedTeam.id}`))
      const spread = rosterOverallSpread(roster.players)
      const minSpread = seedTeam.overall >= 55 ? 15 : 6

      expect(spread).toBeGreaterThanOrEqual(minSpread)
      expect(Math.abs(roster.overall - seedTeam.overall)).toBeLessThanOrEqual(8)
    }
  })
})
