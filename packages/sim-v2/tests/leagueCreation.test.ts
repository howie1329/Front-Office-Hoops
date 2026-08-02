import { describe, expect, it } from "vitest"

import { validateLeagueDocument } from "@workspace/league-schema"

import { createLeague, LEAGUE_TEAM_COUNT } from "../src"

describe("league creation", () => {
  const input = {
    id: "league-created",
    name: "The First Office League",
    seed: "league-creation-test",
    mode: "deterministic-lab" as const,
    createdWithEntropy: false,
    now: "2026-08-02T00:00:00.000Z",
  }

  it("promotes the initial universe into a valid league document", () => {
    const result = createLeague(input)

    expect(result.document.state.phase).toBe("regular-season")
    expect(result.document.state.calendar.currentDate).toBe("2026-10-21")
    expect(result.document.state.structure?.conferences).toHaveLength(2)
    expect(result.document.state.structure?.divisions).toHaveLength(6)
    expect(Object.keys(result.document.entities.teams)).toHaveLength(
      LEAGUE_TEAM_COUNT
    )
    expect(Object.keys(result.document.entities.players)).toHaveLength(640)
    expect(result.teamPreviews).toHaveLength(LEAGUE_TEAM_COUNT)
    expect(
      Object.values(result.document.entities.teams).every(
        (team) => team.rosterPlayerIds?.length === 15
      )
    ).toBe(true)
    expect(
      result.document.state.calendar.schedule.filter(
        (game) => game.kind === "preseason"
      )
    ).toHaveLength(90)
    expect(
      result.document.state.calendar.schedule.filter(
        (game) => game.kind === "regular-season"
      )
    ).toHaveLength(1230)
    for (const teamId of Object.keys(result.document.entities.teams)) {
      const preseasonGames = result.document.state.calendar.schedule.filter(
        (game) =>
          game.kind === "preseason" &&
          (game.homeTeamId === teamId || game.awayTeamId === teamId)
      )
      const regularGames = result.document.state.calendar.schedule.filter(
        (game) =>
          game.kind === "regular-season" &&
          (game.homeTeamId === teamId || game.awayTeamId === teamId)
      )
      expect(preseasonGames).toHaveLength(6)
      expect(regularGames).toHaveLength(82)
      expect(new Set(preseasonGames.map((game) => game.date)).size).toBe(
        preseasonGames.length
      )
      expect(new Set(regularGames.map((game) => game.date)).size).toBe(
        regularGames.length
      )
      expect(
        regularGames.filter((game) => game.homeTeamId === teamId)
      ).toHaveLength(41)
      expect(
        regularGames.filter((game) => game.awayTeamId === teamId)
      ).toHaveLength(41)
    }
    expect(
      Object.values(result.document.entities.teams).every(
        (team) => team.conferenceId && team.divisionId
      )
    ).toBe(true)
    expect(validateLeagueDocument(result.document)).toMatchObject({
      valid: true,
    })
  })

  it("is reproducible when the creation seed is fixed", () => {
    expect(createLeague(input)).toEqual(createLeague(input))
  })
})
