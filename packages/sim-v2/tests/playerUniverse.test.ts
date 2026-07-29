import {
  createPlayerContractFixture,
  createPlayerPopulationPreset,
  createStandardPlayerGenerationConfig,
} from "@workspace/domain-v2"
import { describe, expect, it } from "vitest"

import {
  assembleInitialRosters,
  generateInitialPlayerUniverse,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "../src"

const teamIds = Array.from(
  { length: 30 },
  (_, index) => `team-${String(index + 1).padStart(2, "0")}`
)

describe("initial player universe", () => {
  it("reproduces a complete valid standard universe", () => {
    const input = {
      seed: "universe-seed",
      leagueId: "league-1",
      teamIds,
    }
    const first = generateInitialPlayerUniverse(input)
    const second = generateInitialPlayerUniverse(input)
    const players = Object.values(first.players)

    expect(first).toEqual(second)
    expect(first.validationIssues).toEqual([])
    expect(players).toHaveLength(640)
    expect(
      players.filter((player) => player.leagueStatus.kind === "rostered")
    ).toHaveLength(450)
    expect(first.freeAgentIds).toHaveLength(100)
    expect(first.draftProspectIds).toHaveLength(90)
    expect(first.metadata.plannedDraftSelections).toBe(75)

    for (const roster of Object.values(first.rosters)) {
      expect(roster).toHaveLength(15)
      expect(new Set(roster).size).toBe(15)
    }

    for (const diagnostics of Object.values(first.assemblyDiagnostics.teams)) {
      expect(diagnostics.coreCoverage).toEqual({
        PG: 2,
        SG: 2,
        SF: 2,
        PF: 2,
        C: 2,
      })
    }
  })

  it("isolates populations and assembly settings from generated players", () => {
    const standard = generateInitialPlayerUniverse({
      seed: "isolation-seed",
      leagueId: "league-1",
      teamIds,
    })
    const freeAgentConfig = createPlayerPopulationPreset(
      "initial-free-agents"
    ).config
    freeAgentConfig.talentDistribution.center = 30
    const changedFreeAgents = generateInitialPlayerUniverse({
      seed: "isolation-seed",
      leagueId: "league-1",
      teamIds,
      populationConfigs: {
        "initial-free-agents": freeAgentConfig,
      },
    })
    const changedAssembly = generateInitialPlayerUniverse({
      seed: "isolation-seed",
      leagueId: "league-1",
      teamIds,
      config: {
        ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG),
        rosterAssembly: {
          ...structuredClone(
            STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly
          ),
          selectionVariance: 0,
        },
      },
    })
    const rosterPlayerIds = Object.values(standard.rosters).flat()
    const standardRosterPlayers = rosterPlayerIds.map(
      (playerId) => standard.players[playerId]
    )

    expect(
      rosterPlayerIds.map((playerId) => changedFreeAgents.players[playerId])
    ).toEqual(standardRosterPlayers)
    expect(changedFreeAgents.freeAgentIds).toEqual(standard.freeAgentIds)
    expect(
      changedFreeAgents.freeAgentIds.map(
        (playerId) => changedFreeAgents.players[playerId]?.profile
      )
    ).not.toEqual(
      standard.freeAgentIds.map(
        (playerId) => standard.players[playerId]?.profile
      )
    )

    const generatedFields = (universe: typeof standard) =>
      Object.values(universe.players)
        .map(({ leagueStatus: _leagueStatus, ...player }) => player)
        .sort((left, right) => left.id.localeCompare(right.id))

    expect(generatedFields(changedAssembly)).toEqual(generatedFields(standard))
  })

  it("rejects malformed universe inputs", () => {
    for (const invalidTeamIds of [
      [],
      ["team-1", "   "],
      [...teamIds, teamIds[0]!],
    ]) {
      expect(() =>
        generateInitialPlayerUniverse({
          seed: "seed",
          leagueId: "league-1",
          teamIds: invalidTeamIds,
        })
      ).toThrow("team IDs")
    }

    expect(() =>
      generateInitialPlayerUniverse({
        seed: "seed",
        leagueId: "league-1",
        teamIds,
        config: {
          ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG),
          plannedDraftSelections: 91,
        },
      })
    ).toThrow("cannot exceed")
  })

  it("fails explicitly when position supply cannot fill the core", () => {
    const players = Array.from({ length: 10 }, (_, index) =>
      createPlayerContractFixture({
        id: `wing-${index}`,
        leagueStatus: { kind: "unassigned" },
      })
    )

    expect(() =>
      assembleInitialRosters({
        seed: "insufficient-position-seed",
        teamIds: ["team-1", "team-2"],
        players,
        config: {
          version: 1,
          rosterSize: 5,
          coreDepthPerPosition: 1,
          shortlistSize: 2,
          selectionVariance: 0,
        },
      })
    ).toThrow("PG-eligible")
  })

  it("uses generation rather than archetype quotas for roster eligibility", () => {
    const rosterConfig = createStandardPlayerGenerationConfig()
    rosterConfig.classification.minArchetypeFit = 100
    rosterConfig.classification.minSecondaryArchetypeFit = 100

    const universe = generateInitialPlayerUniverse({
      seed: "archetype-independent-seed",
      leagueId: "league-1",
      teamIds,
      populationConfigs: { "initial-roster": rosterConfig },
    })

    expect(universe.validationIssues).toEqual([])
    expect(
      Object.values(universe.rosters).every((roster) => roster.length === 15)
    ).toBe(true)
  })

  it("assembles valid standard rosters across representative seeds", () => {
    for (let index = 1; index <= 10; index += 1) {
      const universe = generateInitialPlayerUniverse({
        seed: `representative-universe-${index}`,
        leagueId: "league-1",
        teamIds,
      })

      expect(universe.validationIssues).toEqual([])
    }
  })
})
