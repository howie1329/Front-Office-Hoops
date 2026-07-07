import { describe, expect, it } from "vitest"

import { createRng } from "../src/rng"
import { createInitialSeason } from "../src/createInitialSeason"
import { simulateDay } from "../src/simulateDay"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

describe("simulateDay", () => {
  it("finalizes games scheduled on the current day", () => {
    const season = createInitialSeason(SAMPLE_ROSTERS, "day-test", createRng("season"), 1, { skipPreseason: true })
    const day = season.currentDay
    const dayGames = season.schedule.filter(
      (game) => game.day === day && game.status === "scheduled",
    )

    const next = simulateDay(season, day)

    expect(dayGames.length).toBeGreaterThan(0)
    expect(next.games.length).toBe(dayGames.length)
    expect(next.currentDay).toBe(day + 1)
    expect(
      next.schedule.filter((game) => game.day === day && game.status === "final"),
    ).toHaveLength(dayGames.length)
    expect(next.standings.some((row) => row.wins + row.losses > 0)).toBe(true)
  })

  it("is deterministic for the same season state", () => {
    const season = createInitialSeason(SAMPLE_ROSTERS, "day-determinism", createRng("season"), 1, { skipPreseason: true })
    const first = simulateDay(season, season.currentDay)
    const second = simulateDay(season, season.currentDay)

    expect(second).toEqual(first)
  })
})
