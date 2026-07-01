import { describe, expect, it } from "vitest"

import { createRng } from "../src/rng"
import { allocatePlayerStats } from "../src/allocatePlayerStats"
import { selectRotation } from "../src/selectRotation"
import { generatePlayers } from "../src/generatePlayers"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

describe("allocatePlayerStats", () => {
  const team = SAMPLE_TEAMS[0]!
  const players = generatePlayers(team, createRng("allocate"))
  const rotation = selectRotation(players)

  it("allocates points that sum to the team score", () => {
    const stats = allocatePlayerStats(rotation, 107, team.id, createRng("pts"))

    expect(stats.reduce((sum, line) => sum + line.pts, 0)).toBe(107)
  })

  it("assigns minutes to every rotation player", () => {
    const stats = allocatePlayerStats(rotation, 99, team.id, createRng("min"))

    expect(stats).toHaveLength(rotation.length)
    for (const line of stats) {
      expect(line.minutes).toBeGreaterThan(0)
    }
  })

  it("marks the top five minute earners as starters", () => {
    const stats = allocatePlayerStats(rotation, 101, team.id, createRng("starter"))

    expect(stats.filter((line) => line.starter)).toHaveLength(5)
  })
})
