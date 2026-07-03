import { describe, expect, it } from "vitest"

import { ROSTER_MAX } from "@workspace/shared/constants"

import {
  createLeague,
  createRng,
  isDraftRequired,
  prepareDraft,
  releasePlayer,
  simDraftUntilComplete,
  simulateSeason,
  startNextSeason,
} from "../src"
import { beginOffseason } from "../src/beginOffseason"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { finalizeDraftPool } from "../src/draft/completeDraft"
import { generateDraftClass } from "../src/draft/generateDraftClass"
import { generateDraftOrderFromSeed } from "../src/draft/generateDraftOrder"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"

function completeSeasonToOffseason(state: ReturnType<typeof createLeague>["seasonState"]) {
  let next = simulateSeason(state)
  next = beginPlayoffs(next)
  next = simulatePlayoffs(next)
  next = beginOffseason(next, createRng(`${next.baseSeed}:offseason:${next.season}`))
  return next
}

function runToDraftOffseason(
  league = createLeague({
    name: "Draft Test",
    baseSeed: "draft-test",
    rng: createRng("draft-test"),
    useMiniLeague: true,
  }),
) {
  const state = completeSeasonToOffseason(league.seasonState)
  return { league, state }
}

describe("draft", () => {
  it("requires a draft after every completed season", () => {
    expect(isDraftRequired(1)).toBe(true)
    expect(isDraftRequired(2)).toBe(true)
  })

  it("prepares a draft in the first offseason", () => {
    const { state } = runToDraftOffseason()
    const prepared = prepareDraft(state)

    expect(prepared.draftState?.year).toBe(2)
    expect(prepared.draftState?.order).toHaveLength(12)
  })

  it("generates a deterministic rookie class", () => {
    const first = generateDraftClass(6, 3, "class-seed", createRng("class-seed-a"))
    const second = generateDraftClass(6, 3, "class-seed", createRng("class-seed-a"))

    expect(second).toEqual(first)
    expect(first).toHaveLength(12)
    for (const prospect of first) {
      expect(prospect.age).toBeGreaterThanOrEqual(19)
      expect(prospect.age).toBeLessThanOrEqual(22)
      expect(prospect.ratings.potential).toBeGreaterThan(prospect.ratings.overall)
    }
  })

  it("creates a two-round snake draft order", () => {
    const league = createLeague({
      name: "Draft Order",
      baseSeed: "draft-order",
      rng: createRng("draft-order"),
      useMiniLeague: true,
    })

    const state = simulateSeason(league.seasonState)
    const order = generateDraftOrderFromSeed(state, state.baseSeed)

    expect(order).toHaveLength(12)
    expect(order[0]!.round).toBe(1)
    expect(order[5]!.round).toBe(1)
    expect(order[6]!.round).toBe(2)
    expect(order[6]!.teamId).toBe(order[5]!.teamId)
    expect(order[11]!.teamId).toBe(order[0]!.teamId)
  })

  it("adds two players per team without immediate cuts", () => {
    const { state: offseason } = runToDraftOffseason()
    const prepared = prepareDraft(offseason)
    const completed = simDraftUntilComplete(prepared, [])

    for (const team of completed.seasonState.teams) {
      expect(team.players.length).toBe(ROSTER_MAX + 2)
    }
    expect(completed.seasonState.draftState?.completed).toBe(true)
  })

  it("blocks season start when the user roster is over the limit", () => {
    const { state: offseason } = runToDraftOffseason()
    const userTeamId = offseason.teams[0]!.id
    const prepared = prepareDraft(offseason)
    const completed = simDraftUntilComplete(prepared, [])

    expect(() =>
      startNextSeason({
        seasonState: completed.seasonState,
        userTeamId,
        freeAgentPool: completed.freeAgentPool,
        rng: createRng("draft-block"),
      }),
    ).toThrow("Roster over limit")
  })

  it("starts the next season after user releases and AI rosters are trimmed", () => {
    const { state: offseason } = runToDraftOffseason()
    const userTeamId = offseason.teams[0]!.id
    const prepared = prepareDraft(offseason)
    const completed = simDraftUntilComplete(prepared, [])

    let teams = completed.seasonState.teams
    let pool = completed.freeAgentPool

    while ((teams.find((team) => team.id === userTeamId)?.players.length ?? 0) > ROSTER_MAX) {
      const team = teams.find((entry) => entry.id === userTeamId)!
      const releaseId = team.players[team.players.length - 1]!.id
      const released = releasePlayer(teams, pool, {
        teamId: userTeamId,
        playerId: releaseId,
      })
      teams = released.teams
      pool = released.freeAgentPool
    }

    const trimmed = applyAiRosterTrimming(teams, pool, userTeamId)
    const next = startNextSeason({
      seasonState: { ...completed.seasonState, teams: trimmed.teams },
      userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("draft-start"),
    })

    expect(next.seasonState.season).toBe(2)
    expect(trimmed.teams.every((team) => team.players.length === ROSTER_MAX)).toBe(true)
  })

  it("adds undrafted prospects to the free agent pool", () => {
    const prospects = generateDraftClass(6, 3, "fa-pool", createRng("fa-pool"))
    const result = finalizeDraftPool(
      {
        year: 3,
        prospects,
        order: [],
        currentPickIndex: 0,
        completed: false,
        selections: [],
      },
      [],
    )

    expect(result.freeAgentPool).toHaveLength(12)
    expect(result.freeAgentPool.every((player) => player.status === "free_agent")).toBe(
      true,
    )
  })
})
