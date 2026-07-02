import { describe, expect, it } from "vitest"

import { PLAYERS_PER_TEAM, RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

import { createRng } from "../src/rng"
import { generatePlayers, generateTeamWithRoster } from "../src/generatePlayers"

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
      expect(player.ratings.shooting).toBeGreaterThanOrEqual(RATING_MIN)
      expect(player.ratings.defense).toBeLessThanOrEqual(RATING_MAX)
    }
  })

  it("updates team overall from roster quality", () => {
    const roster = generateTeamWithRoster(team, createRng("roster-d"))

    expect(roster.overall).toBeGreaterThanOrEqual(RATING_MIN)
    expect(roster.overall).toBeLessThanOrEqual(RATING_MAX)
    expect(roster.players).toHaveLength(PLAYERS_PER_TEAM)
  })
})
