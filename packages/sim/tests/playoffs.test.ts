import { describe, expect, it } from "vitest"

import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  createLeague,
  createRng,
  prepareDraft,
  simDraftUntilComplete,
  simulateSeason,
  startNextSeason,
} from "../src"
import { beginOffseason } from "../src/beginOffseason"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { createInitialPlayoffSeries } from "../src/playoffs/createBracket"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { seedPlayoffTeams } from "../src/playoffs/seedTeams"
import { simulatePlayoffs } from "../src/simulatePlayoffs"
import { isRegularSeasonComplete } from "../src/isRegularSeasonComplete"
import { deriveUserPlayoffResult } from "../src/deriveUserPlayoffResult"
import { pastStaffPhaseState } from "./helpers/offseason"

describe("playoffs", () => {
  it("seeds top 8 teams per conference for a 30-team league", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Playoff Seed Test",
      baseSeed: "playoff-seed",
      rng: createRng("playoff-seed"),
    })

    const seeded = seedPlayoffTeams(league.seasonState)
    const east = seeded.filter((team) => team.conferenceId === "east")
    const west = seeded.filter((team) => team.conferenceId === "west")

    expect(east).toHaveLength(8)
    expect(west).toHaveLength(8)
    expect(east[0]!.seed).toBe(1)
    expect(west[7]!.seed).toBe(8)
  })

  it("creates 16 first-round series for a 30-team league", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Playoff Bracket Test",
      baseSeed: "playoff-bracket",
      rng: createRng("playoff-bracket"),
    })

    const seeded = seedPlayoffTeams(league.seasonState)
    const series = createInitialPlayoffSeries(
      league.seasonState.season,
      30,
      seeded,
    )

    expect(series).toHaveLength(8)
    expect(series.every((entry) => entry.round === 1)).toBe(true)
    expect(series.filter((entry) => entry.conferenceId === "east")).toHaveLength(4)
    expect(series.filter((entry) => entry.conferenceId === "west")).toHaveLength(4)
  })

  it("runs a 6-team regular season into playoffs and starts the next season", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Mini Playoff Loop",
      baseSeed: "mini-playoff",
      rng: createRng("mini-playoff-schedule"),
      useMiniLeague: true,
    })

    let state = simulateSeason(league.seasonState)
    expect(isRegularSeasonComplete(state)).toBe(true)

    state = beginPlayoffs(state)
    expect(state.phase).toBe("playoffs")
    expect(state.playoffBracket?.series).toHaveLength(2)

    state = simulatePlayoffs(state)
    expect(state.phase).toBe("complete")
    expect(state.playoffBracket?.championTeamId).toBeTruthy()

    const userTeamId = state.teams[0]!.id
    state = beginOffseason(state)
    expect(state.phase).toBe("offseason")
    const prepared = prepareDraft(
      advanceToDraftPhase(pastStaffPhaseState(state, league)),
    )
    const completed = simDraftUntilComplete(prepared, [])
    const trimmed = applyAiRosterTrimming(
      completed.seasonState.teams,
      completed.freeAgentPool,
      null,
    )

    const next = startNextSeason({
      seasonState: {
        ...advanceToFreeAgencyPhase(completed.seasonState),
        teams: trimmed.teams,
      },
      userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("mini-playoff-next"),
    })
    expect(next.seasonState.season).toBe(2)
    expect(next.seasonState.phase).toBe("preseason")
    expect(next.historyEntry.championTeamId).toBe(state.playoffBracket?.championTeamId)
    expect(next.historyEntry.userPlayoffResult).toBeTruthy()
  })

  it("derives missed playoffs for non-playoff teams", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Missed Playoffs",
      baseSeed: "missed-playoffs",
      rng: createRng("missed-playoffs"),
      useMiniLeague: true,
    })

    const state = simulateSeason(league.seasonState)
    const lastPlaceTeam = state.standings[state.standings.length - 1]!.teamId

    expect(deriveUserPlayoffResult(state, lastPlaceTeam)).toBe("missed_playoffs")
  })
})
