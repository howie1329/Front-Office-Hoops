import { describe, expect, it } from "vitest"

import {
  applyLeagueCommand,
  createLeague,
  createRng,
  getPhaseEligibility,
  prepareDraft,
  simDraftUntilComplete,
  simulateSeason,
} from "../src"
import { advanceToDraftPhase, advanceToFreeAgencyPhase } from "../src/offseason/phases"
import { beginOffseason } from "../src/beginOffseason"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"
import { pastStaffPhase } from "./helpers/offseason"

function createOffseasonLeague() {
  const league = createLeague({ skipPreseason: true,
    name: "League Commands",
    baseSeed: "league-commands",
    rng: createRng("league-commands"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })

  let state = simulateSeason(league.seasonState)
  const maxRegularDay = Math.max(
    ...state.schedule.filter((game) => !game.seriesId).map((game) => game.day),
    1
  )
  state = {
    ...state,
    currentDay: Math.max(state.currentDay, maxRegularDay + 1),
  }
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(state)

  return pastStaffPhase({
    ...league,
    seasonState: state,
  })
}

describe("leagueCommands", () => {
  it("simulates a regular season day", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Sim Day",
      baseSeed: "sim-day",
      rng: createRng("sim-day"),
      useMiniLeague: true,
    })

    const updated = applyLeagueCommand(league, { type: "simDay" })

    expect(updated.seasonState.currentDay).toBeGreaterThanOrEqual(
      league.seasonState.currentDay
    )
    expect(updated.rngNonce).toBe(league.rngNonce + 1)
    expect(updated.seasonState.games[0]?.rngNonce).toBe(league.rngNonce)
  })

  it("replays the same saved league command deterministically", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Replay",
      baseSeed: "replay",
      rng: createRng("replay"),
      useMiniLeague: true,
    })

    const first = applyLeagueCommand(league, { type: "simDay" })
    const second = applyLeagueCommand(league, { type: "simDay" })

    expect(second).toEqual(first)
  })

  it("uses rngNonce to avoid schedule-slot-only game randomness", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Nonce",
      baseSeed: "nonce-games",
      rng: createRng("nonce-games"),
      useMiniLeague: true,
    })
    const first = applyLeagueCommand(league, { type: "simDay" })

    let changed = false
    for (let nonce = 1; nonce <= 20; nonce += 1) {
      const next = applyLeagueCommand(
        { ...league, rngNonce: nonce },
        { type: "simDay" }
      )
      expect(next.seasonState.games[0]?.rngSeed).not.toBe(
        first.seasonState.games[0]?.rngSeed
      )
      if (
        next.seasonState.games[0]?.result.homeScore !==
          first.seasonState.games[0]?.result.homeScore ||
        next.seasonState.games[0]?.result.awayScore !==
          first.seasonState.games[0]?.result.awayScore
      ) {
        changed = true
        break
      }
    }

    expect(changed).toBe(true)
  })

  it("blocks disallowed lifecycle commands with eligibility reason", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Blocked",
      baseSeed: "blocked",
      rng: createRng("blocked"),
      useMiniLeague: true,
    })

    expect(() => applyLeagueCommand(league, { type: "beginOffseason" })).toThrow(
      "Season must be complete"
    )
    expect(league.rngNonce).toBe(0)
    expect(getPhaseEligibility(league, "beginOffseason").allowed).toBe(false)
  })

  it("runs beginOffseason composition", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Offseason",
      baseSeed: "offseason-command",
      rng: createRng("offseason-command"),
      useMiniLeague: true,
    })

    let state = simulateSeason(league.seasonState)
    state = beginPlayoffs(state)
    state = simulatePlayoffs(state)
    const completed = {
      ...league,
      seasonState: state,
    }

    const eligibility = getPhaseEligibility(completed, "beginOffseason")
    expect(eligibility.allowed).toBe(true)

    const updated = applyLeagueCommand(completed, { type: "beginOffseason" })

    expect(updated.seasonState.phase).toBe("offseason")
    expect(updated.seasonState.offseasonPhase).toBe("staff")
    expect(updated.seasonAwards.length).toBeGreaterThan(0)
  })

  it("advances through offseason micro-flow", () => {
    let league = createOffseasonLeague()

    league = applyLeagueCommand(league, { type: "completeReSignings" })
    expect(league.seasonState.offseasonPhase).toBe("draft")

    league = applyLeagueCommand(league, { type: "prepareDraft" })
    league = applyLeagueCommand(league, { type: "simAiPick" })
    while (!league.seasonState.draftState?.completed) {
      league = applyLeagueCommand(league, { type: "simAiPick" })
    }

    league = applyLeagueCommand(league, { type: "advanceToFreeAgency" })
    expect(league.seasonState.offseasonPhase).toBe("free_agency")

    const trimmed = applyAiRosterTrimming(
      league.seasonState.teams,
      league.freeAgentPool,
      league.userTeamId
    )
    league = {
      ...league,
      seasonState: {
        ...league.seasonState,
        teams: trimmed.teams.map((team) =>
          team.id === league.userTeamId
            ? { ...team, players: team.players.slice(0, 15) }
            : team
        ),
      },
      freeAgentPool: trimmed.freeAgentPool,
    }

    const next = applyLeagueCommand(league, { type: "startNextSeason" })
    expect(next.seasonState.season).toBe(league.seasonState.season + 1)
    expect(next.seasonHistory).toHaveLength(1)
  })

  it("matches manual draft completion path for advance to free agency", () => {
    const league = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(league.seasonState)
    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const manual = advanceToFreeAgencyPhase(completedDraft.seasonState)
    const viaCommand = applyLeagueCommand(
      {
        ...league,
        seasonState: completedDraft.seasonState,
        freeAgentPool: completedDraft.freeAgentPool,
      },
      { type: "advanceToFreeAgency" }
    )

    expect(viaCommand.seasonState.offseasonPhase).toBe(manual.offseasonPhase)
  })
})
