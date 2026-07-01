import { describe, expect, it } from "vitest"

import { SIX_TEAM_GAMES_PER_TEAM } from "@workspace/shared/constants"

import { createRng } from "../src/rng"
import { createSchedule } from "../src/createSchedule"
import { SAMPLE_ROSTERS } from "../src/sampleRosters"

function countTeamGames(
  schedule: ReturnType<typeof createSchedule>,
  teamId: string,
): number {
  return schedule.filter(
    (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
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

  it("creates 30 games with 10 per team", () => {
    const schedule = createSchedule(config, createRng("schedule-b"))

    expect(schedule).toHaveLength(30)

    for (const team of SAMPLE_ROSTERS) {
      expect(countTeamGames(schedule, team.id)).toBe(10)
    }
  })

  it("gives each pair one home and one away game", () => {
    const schedule = createSchedule(config, createRng("schedule-c"))

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

  it("never schedules a team against itself", () => {
    const schedule = createSchedule(config, createRng("schedule-d"))

    for (const game of schedule) {
      expect(game.homeTeamId).not.toBe(game.awayTeamId)
    }
  })
})
