import { describe, expect, it } from "vitest"

import {
  DIVISIONS_PER_CONFERENCE,
  LEAGUE_TEAM_COUNT,
  NBA_GAMES_PER_TEAM,
  NBA_SEASON_LENGTH_DAYS,
  NBA_TOTAL_GAMES,
  TEAMS_PER_DIVISION,
} from "@workspace/shared/constants"

import { createRng } from "../src/rng"
import { generateLeagueRosters } from "../src/generateTeams"

describe("generateTeams", () => {
  it("creates 30 teams across 2 conferences and 6 divisions", () => {
    const teams = generateLeagueRosters(createRng("teams-a"))

    expect(teams).toHaveLength(LEAGUE_TEAM_COUNT)
    expect(new Set(teams.map((team) => team.id)).size).toBe(LEAGUE_TEAM_COUNT)
    expect(new Set(teams.map((team) => team.abbrev)).size).toBe(LEAGUE_TEAM_COUNT)

    const conferences = new Set(teams.map((team) => team.conferenceId))
    expect(conferences).toEqual(new Set(["east", "west"]))

    for (const conferenceId of conferences) {
      const conferenceTeams = teams.filter(
        (team) => team.conferenceId === conferenceId,
      )
      expect(conferenceTeams).toHaveLength(15)

      const divisions = new Set(conferenceTeams.map((team) => team.divisionId))
      expect(divisions.size).toBe(DIVISIONS_PER_CONFERENCE)

      for (const divisionId of divisions) {
        expect(
          conferenceTeams.filter((team) => team.divisionId === divisionId),
        ).toHaveLength(TEAMS_PER_DIVISION)
      }
    }
  })

  it("is deterministic for the same seed", () => {
    const first = generateLeagueRosters(createRng("teams-determinism"))
    const second = generateLeagueRosters(createRng("teams-determinism"))

    expect(second.map((team) => team.id)).toEqual(first.map((team) => team.id))
  })
})

describe("createSchedule NBA", () => {
  const teams = generateLeagueRosters(createRng("schedule-nba-teams"))
  const config = {
    season: 1,
    teams,
    gamesPerTeam: NBA_GAMES_PER_TEAM,
    seasonLengthDays: NBA_SEASON_LENGTH_DAYS,
  }

  function countTeamGames(
    schedule: ReturnType<typeof import("../src/createSchedule").createSchedule>,
    teamId: string,
  ): number {
    return schedule.filter(
      (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
    ).length
  }

  it("creates 1230 games with 82 per team", async () => {
    const { createSchedule } = await import("../src/createSchedule")
    const schedule = createSchedule(config, createRng("schedule-nba"))

    expect(schedule).toHaveLength(NBA_TOTAL_GAMES)

    for (const team of teams) {
      expect(countTeamGames(schedule, team.id)).toBe(NBA_GAMES_PER_TEAM)
    }
  })

  it("is deterministic for the same seed", async () => {
    const { createSchedule } = await import("../src/createSchedule")
    const first = createSchedule(config, createRng("schedule-nba-determinism"))
    const second = createSchedule(config, createRng("schedule-nba-determinism"))

    expect(second).toEqual(first)
  })
})
