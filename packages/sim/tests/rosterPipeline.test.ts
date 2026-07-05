import { describe, expect, it } from "vitest"

import { PLAYERS_PER_TEAM, PRIMARY_POSITIONS } from "@workspace/shared/constants"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

import { createRng, generateLeagueRosters, generateTeamWithRoster } from "../src"
import {
  ARCHETYPE_COUNTS,
  generateTeamRoster,
} from "../src/playerGeneration/rosterPipeline"
import { generateTeams } from "../src/generateTeams"

function assertRosterShape(players: { position: string; ratings: { overall: number } }[]) {
  expect(players).toHaveLength(PLAYERS_PER_TEAM)
  for (const position of PRIMARY_POSITIONS) {
    expect(players.some((player) => player.position === position)).toBe(true)
  }
  for (const player of players) {
    expect(player.ratings.overall).toBeGreaterThanOrEqual(40)
    expect(player.ratings.overall).toBeLessThanOrEqual(90)
  }
}

describe("rosterPipeline", () => {
  it("generates tier_offset rosters with position coverage", () => {
    const team = SAMPLE_TEAMS[0]!
    const roster = generateTeamRoster(team, { mode: "tier_offset" }, createRng("tier-offset"))

    assertRosterShape(roster.players)
    expect(roster.overall).toBeGreaterThan(0)
  })

  it("generates archetype_slots rosters with position coverage", () => {
    const team = SAMPLE_TEAMS[0]!
    const roster = generateTeamRoster(
      team,
      { mode: "archetype_slots", archetype: "playoff_team" },
      createRng("archetype-slots")
    )

    assertRosterShape(roster.players)
  })

  it("is seeded reproducible for both modes", () => {
    const team = SAMPLE_TEAMS[1]!

    const tierA = generateTeamRoster(team, { mode: "tier_offset" }, createRng("seed-a"))
    const tierB = generateTeamRoster(team, { mode: "tier_offset" }, createRng("seed-a"))
    const archetypeA = generateTeamRoster(
      team,
      { mode: "archetype_slots", archetype: "middle_team" },
      createRng("seed-b")
    )
    const archetypeB = generateTeamRoster(
      team,
      { mode: "archetype_slots", archetype: "middle_team" },
      createRng("seed-b")
    )

    expect(tierA.players.map((player) => player.ratings.overall)).toEqual(
      tierB.players.map((player) => player.ratings.overall)
    )
    expect(archetypeA.players.map((player) => player.ratings.overall)).toEqual(
      archetypeB.players.map((player) => player.ratings.overall)
    )
  })

  it("matches legacy generateTeamWithRoster output", () => {
    const team = SAMPLE_TEAMS[2]!
    const rng = createRng("legacy-compare")

    const legacy = generateTeamWithRoster(team, rng)
    const piped = generateTeamRoster(team, { mode: "tier_offset" }, createRng("legacy-compare"))

    expect(piped.players.map((player) => player.ratings.overall)).toEqual(
      legacy.players.map((player) => player.ratings.overall)
    )
  })

  it("distributes product archetypes across a 30-team league", () => {
    const teams = generateTeams(createRng("product-league"))
    const rosters = generateLeagueRosters(createRng("product-league"))

    expect(rosters).toHaveLength(teams.length)
    const expectedCount = Object.values(ARCHETYPE_COUNTS).reduce(
      (sum, count) => sum + count,
      0
    )
    expect(rosters).toHaveLength(expectedCount)

    for (const roster of rosters) {
      assertRosterShape(roster.players)
    }
  })
})
