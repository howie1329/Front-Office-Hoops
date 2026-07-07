import { describe, expect, it } from "vitest"

import {
  MINI_PRESEASON_GAMES_PER_TEAM,
  SIX_TEAM_GAMES_PER_TEAM,
} from "@workspace/shared/constants"

import { createRng } from "../src/rng"
import {
  createPreseasonSchedule,
  createRegularSchedule,
  createSchedule,
} from "../src/createSchedule"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

function countTeamGames(
  schedule: ReturnType<typeof createSchedule>,
  teamId: string,
  gameType?: "exhibition" | "regular",
): number {
  return schedule.filter(
    (game) =>
      (game.homeTeamId === teamId || game.awayTeamId === teamId) &&
      (gameType ? game.gameType === gameType : true),
  ).length
}

describe("createSchedule", () => {
  const config = {
    season: 1,
    teams: SAMPLE_ROSTERS,
    gamesPerTeam: SIX_TEAM_GAMES_PER_TEAM,
    seasonLengthDays: 30,
  }

  it("is deterministic for the same config and seed", () => {
    const first = createSchedule(config, createRng("schedule-a"))
    const second = createSchedule(config, createRng("schedule-a"))

    expect(second).toEqual(first)
  })

  it("creates exhibition and regular games for mini leagues", () => {
    const schedule = createSchedule(config, createRng("schedule-b"))

    expect(schedule.filter((game) => game.gameType === "exhibition")).toHaveLength(
      6,
    )
    expect(schedule.filter((game) => game.gameType === "regular")).toHaveLength(30)

    for (const team of SAMPLE_ROSTERS) {
      expect(countTeamGames(schedule, team.id, "exhibition")).toBe(
        MINI_PRESEASON_GAMES_PER_TEAM,
      )
      expect(countTeamGames(schedule, team.id, "regular")).toBe(
        SIX_TEAM_GAMES_PER_TEAM,
      )
    }
  })

  it("gives each pair one home and one away regular-season game", () => {
    const schedule = createRegularSchedule(config, createRng("schedule-c"))

    for (let i = 0; i < SAMPLE_ROSTERS.length; i++) {
      for (let j = i + 1; j < SAMPLE_ROSTERS.length; j++) {
        const teamA = SAMPLE_ROSTERS[i]!
        const teamB = SAMPLE_ROSTERS[j]!

        const gamesBetween = schedule.filter(
          (game) =>
            (game.homeTeamId === teamA.id && game.awayTeamId === teamB.id) ||
            (game.homeTeamId === teamB.id && game.awayTeamId === teamA.id),
        )

        expect(gamesBetween).toHaveLength(2)
        expect(
          gamesBetween.some((game) => game.homeTeamId === teamA.id),
        ).toBe(true)
        expect(
          gamesBetween.some((game) => game.homeTeamId === teamB.id),
        ).toBe(true)
      }
    }
  })

  it("never schedules a team twice on the same day", () => {
    const schedule = createSchedule(config, createRng("schedule-d"))

    for (const team of SAMPLE_ROSTERS) {
      for (const gameType of ["exhibition", "regular"] as const) {
        const dayCounts = new Map<number, number>()
        for (const game of schedule.filter((entry) => entry.gameType === gameType)) {
          if (game.homeTeamId !== team.id && game.awayTeamId !== team.id) {
            continue
          }
          dayCounts.set(game.day, (dayCounts.get(game.day) ?? 0) + 1)
        }

        for (const count of dayCounts.values()) {
          expect(count).toBe(1)
        }
      }
    }
  })

  it("builds a complete preseason slate", () => {
    const preseason = createPreseasonSchedule(config, createRng("schedule-e"))

    expect(preseason).toHaveLength(6)
    expect(preseason.every((game) => game.gameType === "exhibition")).toBe(true)
  })
})
