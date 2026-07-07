import { describe, expect, it } from "vitest"

import { ROSTER_MAX } from "@workspace/shared/constants"

import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  createLeague,
  createRng,
  getDraftClassSize,
  isDraftRequired,
  prepareDraft,
  releasePlayer,
  simDraftUntilComplete,
  simulateSeason,
  startNextSeason,
} from "../src"
import { beginOffseason } from "../src/beginOffseason"
import { aiSelectProspect } from "../src/draft/aiSelectProspect"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { finalizeDraftPool } from "../src/draft/completeDraft"
import { generateDraftClass } from "../src/draft/generateDraftClass"
import { generateDraftOrderFromSeed } from "../src/draft/generateDraftOrder"
import { applyAiRosterTrimming } from "../src/roster/rosterManagement"
import { simulatePlayoffs } from "../src/simulatePlayoffs"

function completeSeasonToOffseason(
  state: ReturnType<typeof createLeague>["seasonState"]
) {
  let next = simulateSeason(state)
  next = beginPlayoffs(next)
  next = simulatePlayoffs(next)
  next = beginOffseason(
    next,
    createRng(`${next.baseSeed}:offseason:${next.season}`)
  )
  return next
}

function runToDraftOffseason(
  league = createLeague({ skipPreseason: true,
    name: "Draft Test",
    baseSeed: "draft-test",
    rng: createRng("draft-test"),
    useMiniLeague: true,
  })
) {
  const state = advanceToDraftPhase(
    completeSeasonToOffseason(league.seasonState)
  )
  return { league, state }
}

function prospectValueProxy(prospect: {
  age: number
  ratings: { overall: number; potential: number }
}) {
  const ageBonus =
    prospect.age === 19
      ? 4
      : prospect.age === 20
        ? 2.5
        : prospect.age === 21
          ? 1
          : 0
  return prospect.ratings.overall + prospect.ratings.potential * 1.15 + ageBonus
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
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
    const first = generateDraftClass(
      6,
      3,
      "class-seed",
      createRng("class-seed-a")
    )
    const second = generateDraftClass(
      6,
      3,
      "class-seed",
      createRng("class-seed-a")
    )

    expect(second).toEqual(first)
    expect(getDraftClassSize(6)).toBe(18)
    expect(first).toHaveLength(18)
    for (const prospect of first) {
      expect(prospect.age).toBeGreaterThanOrEqual(19)
      expect(prospect.age).toBeLessThanOrEqual(22)
      expect(prospect.ratings.potential).toBeGreaterThan(
        prospect.ratings.overall
      )
    }
  })

  it("creates sorted draft boards with lottery talent and deep undrafted range", () => {
    const prospects = generateDraftClass(
      30,
      2,
      "tiered-class",
      createRng("tiered-class")
    )
    const lotteryAverage = average(
      prospects.slice(0, 14).map(prospectValueProxy)
    )
    const middleAverage = average(
      prospects.slice(14, 60).map(prospectValueProxy)
    )
    const deepAverage = average(prospects.slice(60).map(prospectValueProxy))

    expect(prospects).toHaveLength(90)
    expect(lotteryAverage).toBeGreaterThan(middleAverage)
    expect(middleAverage).toBeGreaterThan(deepAverage)
    expect(prospects.some((prospect) => prospect.ratings.overall >= 62)).toBe(
      true
    )
    expect(prospects.some((prospect) => prospect.ratings.overall <= 50)).toBe(
      true
    )
    expect(
      prospects.some(
        (prospect) => prospect.ratings.potential - prospect.ratings.overall <= 6
      )
    ).toBe(true)
  })

  it("uses a balanced randomized position bag for draft classes", () => {
    const prospects = generateDraftClass(
      30,
      2,
      "balanced-positions",
      createRng("balanced-positions")
    )
    const counts = new Map<string, number>()

    for (const prospect of prospects) {
      counts.set(prospect.position, (counts.get(prospect.position) ?? 0) + 1)
    }

    const positionCounts = [...counts.values()]
    expect(positionCounts).toHaveLength(5)
    expect(
      Math.max(...positionCounts) - Math.min(...positionCounts)
    ).toBeLessThanOrEqual(1)
    expect(
      prospects.slice(0, 5).map((prospect) => prospect.position)
    ).not.toEqual(["PG", "SG", "SF", "PF", "C"])
  })

  it("keeps AI picks anchored to board order with only small need adjustments", () => {
    const prospects = generateDraftClass(
      30,
      2,
      "ai-board",
      createRng("ai-board")
    )
    const team = createLeague({ skipPreseason: true,
      name: "AI Draft Board",
      baseSeed: "ai-board-team",
      rng: createRng("ai-board-team"),
      useMiniLeague: true,
    }).seasonState.teams[0]!

    const selected = aiSelectProspect(team, prospects)
    const selectedIndex = prospects.findIndex(
      (prospect) => prospect.id === selected.id
    )

    expect(selectedIndex).toBeGreaterThanOrEqual(0)
    expect(selectedIndex).toBeLessThanOrEqual(2)
  })

  it("creates a two-round snake draft order", () => {
    const league = createLeague({ skipPreseason: true,
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
    expect(completed.freeAgentPool).toHaveLength(6)
  })

  it("blocks season start when the user roster is over the limit", () => {
    const { state: offseason } = runToDraftOffseason()
    const userTeamId = offseason.teams[0]!.id
    const prepared = prepareDraft(offseason)
    const completed = simDraftUntilComplete(prepared, [])

    expect(() =>
      startNextSeason({
        seasonState: advanceToFreeAgencyPhase(completed.seasonState),
        userTeamId,
        freeAgentPool: completed.freeAgentPool,
        rng: createRng("draft-block"),
      })
    ).toThrow("Roster over limit")
  })

  it("starts the next season after user releases and AI rosters are trimmed", () => {
    const { state: offseason } = runToDraftOffseason()
    const userTeamId = offseason.teams[0]!.id
    const prepared = prepareDraft(offseason)
    const completed = simDraftUntilComplete(prepared, [])

    let teams = completed.seasonState.teams
    let pool = completed.freeAgentPool

    while (
      (teams.find((team) => team.id === userTeamId)?.players.length ?? 0) >
      ROSTER_MAX
    ) {
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
      seasonState: {
        ...advanceToFreeAgencyPhase(completed.seasonState),
        teams: trimmed.teams,
      },
      userTeamId,
      freeAgentPool: trimmed.freeAgentPool,
      rng: createRng("draft-start"),
    })

    expect(next.seasonState.season).toBe(2)
    expect(
      trimmed.teams.every((team) => team.players.length === ROSTER_MAX)
    ).toBe(true)
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
      []
    )

    expect(result.freeAgentPool).toHaveLength(getDraftClassSize(6))
    expect(
      result.freeAgentPool.every((player) => player.status === "free_agent")
    ).toBe(true)
  })
})
