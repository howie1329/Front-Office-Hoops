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
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"

function createOffseasonLeague() {
  const league = createLeague({ skipPreseason: true,
    name: "Offseason Phase Test",
    baseSeed: "offseason-phase",
    rng: createRng("offseason-phase"),
    useMiniLeague: true,
  })
  let state = simulateSeason(league.seasonState)
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(state, createRng("offseason-phase-open"))
  return { league, state }
}

describe("offseason phases", () => {
  it("enters re-signing when offseason begins", () => {
    const { state } = createOffseasonLeague()

    expect(state.phase).toBe("offseason")
    expect(state.offseasonPhase).toBe("re_signing")
  })

  it("advances from re-signing to draft and then to free agency after draft completion", () => {
    const { state } = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(state)

    expect(draftPhase.offseasonPhase).toBe("draft")
    expect(() => advanceToFreeAgencyPhase(draftPhase)).toThrow(
      "Draft must be completed"
    )

    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const freeAgencyPhase = advanceToFreeAgencyPhase(completedDraft.seasonState)

    expect(freeAgencyPhase.offseasonPhase).toBe("free_agency")
  })

  it("blocks starting the next season before free agency phase", () => {
    const { league, state } = createOffseasonLeague()
    const draftPhase = advanceToDraftPhase(state)
    const completedDraft = simDraftUntilComplete(prepareDraft(draftPhase), [])
    const trimmed = applyAiRosterTrimming(
      completedDraft.seasonState.teams,
      completedDraft.freeAgentPool,
      null
    )

    expect(() =>
      startNextSeason({
        seasonState: { ...completedDraft.seasonState, teams: trimmed.teams },
        userTeamId: league.userTeamId,
        freeAgentPool: trimmed.freeAgentPool,
        rng: createRng("blocked-before-fa"),
      })
    ).toThrow("free agency")

    const next = startNextSeason({
      seasonState: {
        ...advanceToFreeAgencyPhase(completedDraft.seasonState),
        teams: trimmed.teams,
      },
      userTeamId: league.userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("allowed-after-fa"),
    })

    expect(next.seasonState.season).toBe(2)
  })
})
