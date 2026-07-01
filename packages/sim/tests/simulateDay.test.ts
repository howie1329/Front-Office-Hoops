import { describe, expect, it } from "vitest"

import { createRng } from "../src/rng"
import { createInitialSeason } from "../src/createInitialSeason"
import { simulateDay } from "../src/simulateDay"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

describe("simulateDay", () => {
  it("finalizes games scheduled on the current day", () => {
    const season = createInitialSeason(SAMPLE_ROSTERS, "day-test", createRng("season"))
    const dayOneGames = season.schedule.filter((game) => game.day === 1)

    const next = simulateDay(season, 1)

    expect(dayOneGames.length).toBeGreaterThan(0)
    expect(next.games.length).toBe(dayOneGames.length)
    expect(next.currentDay).toBe(2)
    expect(
      next.schedule.filter((game) => game.day === 1 && game.status === "final"),
    ).toHaveLength(dayOneGames.length)
    expect(next.standings.some((row) => row.wins + row.losses > 0)).toBe(true)
  })

  it("is deterministic for the same season state", () => {
    const season = createInitialSeason(SAMPLE_ROSTERS, "day-determinism", createRng("season"))
    const first = simulateDay(season, 1)
    const second = simulateDay(season, 1)

    expect(second).toEqual(first)
  })
})
