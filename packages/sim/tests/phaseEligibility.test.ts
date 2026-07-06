import { describe, expect, it } from "vitest"

import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  beginOffseason,
  beginPlayoffs,
  createLeague,
  createRng,
  getPhaseEligibility,
  prepareDraft,
  simDraftUntilComplete,
  simulateSeason,
  startNextSeason,
} from "../src"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"

function createOffseasonLeague() {
  const league = createLeague({
    name: "Phase Eligibility Test",
    baseSeed: "phase-eligibility",
    rng: createRng("phase-eligibility"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })
  let state = simulateSeason(league.seasonState)
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(state, createRng("phase-eligibility-open"))
  return {
    ...league,
    seasonState: state,
  }
}

describe("phaseEligibility", () => {
  it("allows beginPlayoffs when regular season is complete and calendar permits", () => {
    const league = createLeague({
      name: "Playoffs Gate",
      baseSeed: "playoffs-gate",
      rng: createRng("playoffs-gate"),
      useMiniLeague: true,
    })
    const completed = simulateSeason(league.seasonState)
    const maxRegularDay = Math.max(
      ...completed.schedule
        .filter((game) => !game.seriesId)
        .map((game) => game.day),
      1
    )
    const readyForPlayoffs = {
      ...completed,
      currentDay: Math.max(completed.currentDay, maxRegularDay + 1),
    }

    const result = getPhaseEligibility(
      { ...league, seasonState: readyForPlayoffs },
      "beginPlayoffs"
    )

    expect(result).toEqual({ allowed: true })
    expect(() => beginPlayoffs(readyForPlayoffs)).not.toThrow()
  })

  it("blocks beginPlayoffs before regular season completes", () => {
    const league = createLeague({
      name: "Playoffs Blocked",
      baseSeed: "playoffs-blocked",
      rng: createRng("playoffs-blocked"),
      useMiniLeague: true,
    })

    const result = getPhaseEligibility(league, "beginPlayoffs")

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain("not complete")
    }
  })

  it("blocks startNextSeason when user roster is under limit", () => {
    const league = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(league.seasonState)
    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const freeAgency = advanceToFreeAgencyPhase(completedDraft.seasonState)
    const trimmed = applyAiRosterTrimming(
      freeAgency.teams,
      completedDraft.freeAgentPool,
      league.userTeamId
    )

    const userTeam = trimmed.teams.find((team) => team.id === league.userTeamId)
    expect(userTeam).toBeDefined()

    const underLimitLeague = {
      ...league,
      seasonState: {
        ...freeAgency,
        teams: trimmed.teams.map((team) =>
          team.id === league.userTeamId
            ? { ...team, players: team.players.slice(0, 11) }
            : team
        ),
      },
      freeAgentPool: trimmed.freeAgentPool,
    }

    const result = getPhaseEligibility(underLimitLeague, "startNextSeason")

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain("Roster under limit")
    }
    expect(userTeam!.players.length).toBeGreaterThanOrEqual(11)

    expect(() =>
      startNextSeason({
        seasonState: underLimitLeague.seasonState,
        userTeamId: league.userTeamId,
        freeAgentPool: underLimitLeague.freeAgentPool,
        rng: createRng("blocked-under-limit"),
      })
    ).toThrow("Roster under limit")
  })

  it("blocks startNextSeason when user roster is over limit", () => {
    const league = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(league.seasonState)
    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const freeAgency = advanceToFreeAgencyPhase(completedDraft.seasonState)

    const userTeam = freeAgency.teams.find((team) => team.id === league.userTeamId)
    const extraPlayer = userTeam?.players[0]
    const overLimitLeague = {
      ...league,
      seasonState: {
        ...freeAgency,
        teams: freeAgency.teams.map((team) =>
          team.id === league.userTeamId && extraPlayer
            ? {
                ...team,
                players: [
                  ...team.players,
                  { ...extraPlayer, id: `${extraPlayer.id}_clone` },
                ],
              }
            : team
        ),
      },
    }

    const result = getPhaseEligibility(overLimitLeague, "startNextSeason")

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toContain("Roster over limit")
    }
  })

  it("allows startNextSeason in free agency with a full user roster", () => {
    const league = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(league.seasonState)
    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const freeAgency = advanceToFreeAgencyPhase(completedDraft.seasonState)
    const trimmed = applyAiRosterTrimming(
      freeAgency.teams,
      completedDraft.freeAgentPool,
      league.userTeamId
    )
    const readyLeague = {
      ...league,
      seasonState: {
        ...freeAgency,
        teams: trimmed.teams.map((team) =>
          team.id === league.userTeamId
            ? { ...team, players: team.players.slice(0, 12) }
            : team
        ),
      },
      freeAgentPool: trimmed.freeAgentPool,
    }

    const result = getPhaseEligibility(readyLeague, "startNextSeason")

    expect(result).toEqual({ allowed: true })
  })
})
