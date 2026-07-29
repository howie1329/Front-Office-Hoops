import { describe, expect, it } from "vitest"

import {
  createTeamAssemblyLabRun,
  createTeamAssemblyLabTeamIds,
  getTeamAssemblyLabPlayerName,
  getTeamAssemblyLabTeamName,
  serializeTeamAssemblyLabReport,
  summarizeUniversePopulation,
} from "./teamAssemblyLab"

const options = {
  seed: "team-assembly-test",
  coreDepthPerPosition: 2,
  shortlistSize: 5,
  selectionVariance: 2,
}

describe("team assembly lab helpers", () => {
  it("creates a reproducible standard lab universe", () => {
    const first = createTeamAssemblyLabRun(options)
    const second = createTeamAssemblyLabRun(options)

    expect(first).toEqual(second)
    expect(first.validationIssues).toEqual([])
    expect(Object.keys(first.rosters)).toHaveLength(30)
    expect(first.freeAgentIds).toHaveLength(100)
    expect(first.draftProspectIds).toHaveLength(90)
  })

  it("uses stable display-only team labels and generated player names", () => {
    const universe = createTeamAssemblyLabRun(options)
    const firstTeamId = createTeamAssemblyLabTeamIds()[0]
    const firstPlayerId = universe.rosters[firstTeamId][0]
    const firstPick = universe.assemblyDiagnostics.picks[0]
    const passedOverPlayerId = firstPick.shortlist.find(
      (candidate) => candidate.playerId !== firstPick.selectedPlayerId
    )?.playerId

    expect(getTeamAssemblyLabTeamName(firstTeamId)).toBe("Team 01")
    expect(getTeamAssemblyLabPlayerName(universe, firstPlayerId)).toBeTruthy()
    expect(passedOverPlayerId).toBeTruthy()
    expect(
      getTeamAssemblyLabPlayerName(universe, passedOverPlayerId!)
    ).toBeTruthy()
  })

  it("summarizes secondary populations and exports version one reports", () => {
    const universe = createTeamAssemblyLabRun(options)
    const freeAgents = summarizeUniversePopulation(
      universe,
      universe.freeAgentIds
    )
    const report = JSON.parse(
      serializeTeamAssemblyLabReport(options, universe)
    ) as {
      schema: string
      version: number
      options: typeof options
      universe: typeof universe
    }

    expect(freeAgents.count).toBe(100)
    expect(freeAgents.averageAbility).toBeGreaterThan(0)
    expect(report).toMatchObject({
      schema: "foh-team-assembly-lab",
      version: 1,
      options,
    })
    expect(report.universe).toEqual(universe)
  })
})
