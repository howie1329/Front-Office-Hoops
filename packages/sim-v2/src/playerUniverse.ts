import {
  createPlayerPopulationPreset,
  PLAYER_POPULATION_PRESET_VERSION,
} from "@workspace/domain-v2"
import type {
  PlayerEntity,
  PlayerGenerationConfig,
  PlayerPopulationPresetId,
  PlayerPosition,
} from "@workspace/domain-v2"

import { generatePlayerPopulation } from "./playerPopulation"
import type { PlayerPopulationMetadata } from "./playerPopulation"
import {
  assembleInitialRosters,
  ROSTER_ASSEMBLY_VERSION,
  STANDARD_ROSTER_ASSEMBLY_CONFIG,
} from "./rosterAssembly"
import type {
  RosterAssemblyConfig,
  RosterAssemblyDiagnostics,
} from "./rosterAssembly"

export const INITIAL_PLAYER_UNIVERSE_VERSION = 1

export type InitialPlayerUniverseConfig = {
  version: 1
  rosterSize: number
  initialFreeAgentCount: number
  draftProspectCount: number
  plannedDraftSelections: number
  rosterAssembly: RosterAssemblyConfig
}

export const STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG: InitialPlayerUniverseConfig =
  {
    version: INITIAL_PLAYER_UNIVERSE_VERSION,
    rosterSize: 15,
    initialFreeAgentCount: 100,
    draftProspectCount: 90,
    plannedDraftSelections: 75,
    rosterAssembly: STANDARD_ROSTER_ASSEMBLY_CONFIG,
  }

export type InitialPlayerUniverseInput = {
  seed: string
  leagueId: string
  teamIds: string[]
  config?: InitialPlayerUniverseConfig
  populationConfigs?: Partial<
    Record<PlayerPopulationPresetId, PlayerGenerationConfig>
  >
}

export type PlayerUniverseValidationIssue = {
  code: string
  message: string
  teamId?: string
  playerId?: string
}

export type InitialPlayerUniverseMetadata = {
  version: 1
  seed: string
  leagueId: string
  draftClassId: string
  plannedDraftSelections: number
  populationPresetVersion: number
  rosterAssemblyVersion: number
  population: {
    initialRoster: PlayerPopulationMetadata
    initialFreeAgents: PlayerPopulationMetadata
    draftClass: PlayerPopulationMetadata
  }
}

export type InitialPlayerUniverse = {
  metadata: InitialPlayerUniverseMetadata
  config: InitialPlayerUniverseConfig
  populationConfigs: Record<PlayerPopulationPresetId, PlayerGenerationConfig>
  players: Record<string, PlayerEntity>
  rosters: Record<string, string[]>
  freeAgentIds: string[]
  draftProspectIds: string[]
  assemblyDiagnostics: RosterAssemblyDiagnostics
  validationIssues: PlayerUniverseValidationIssue[]
}

function validateGenerationInput(
  input: InitialPlayerUniverseInput,
  config: InitialPlayerUniverseConfig
) {
  if (input.seed.trim().length === 0) {
    throw new Error("Initial player universe seed must not be empty.")
  }

  if (input.leagueId.trim().length === 0) {
    throw new Error("Initial player universe league ID must not be empty.")
  }

  if (
    !Number.isInteger(config.initialFreeAgentCount) ||
    config.initialFreeAgentCount < 1
  ) {
    throw new Error("Initial free-agent count must be a positive integer.")
  }

  if (
    !Number.isInteger(config.draftProspectCount) ||
    config.draftProspectCount < 1
  ) {
    throw new Error("Draft-prospect count must be a positive integer.")
  }

  if (
    !Number.isInteger(config.plannedDraftSelections) ||
    config.plannedDraftSelections < 1 ||
    config.plannedDraftSelections > config.draftProspectCount
  ) {
    throw new Error(
      "Planned draft selections must be positive and cannot exceed the prospect count."
    )
  }

  if (config.rosterSize !== config.rosterAssembly.rosterSize) {
    throw new Error("Universe and roster-assembly roster sizes must match.")
  }
}

function applyStatus(
  players: PlayerEntity[],
  status:
    { kind: "free-agent" } | { kind: "draft-prospect"; draftClassId: string }
): PlayerEntity[] {
  return players.map((player) => ({
    ...player,
    leagueStatus: status,
  }))
}

export function validateInitialPlayerUniverse(
  universe: Omit<InitialPlayerUniverse, "validationIssues">
): PlayerUniverseValidationIssue[] {
  const issues: PlayerUniverseValidationIssue[] = []
  const players = Object.values(universe.players)
  const playerIds = players.map((player) => player.id)

  if (new Set(playerIds).size !== playerIds.length) {
    issues.push({
      code: "duplicate-player-id",
      message: "Player IDs must be unique across the initial universe.",
    })
  }

  for (const [playerKey, player] of Object.entries(universe.players)) {
    if (playerKey !== player.id) {
      issues.push({
        code: "player-record-key-mismatch",
        message: "The player record key must match the player ID.",
        playerId: player.id,
      })
    }
  }

  const rosteredIds = Object.values(universe.rosters).flat()
  if (
    rosteredIds.length !== new Set(rosteredIds).size ||
    rosteredIds.some((playerId) => !universe.players[playerId])
  ) {
    issues.push({
      code: "invalid-roster-membership",
      message: "Roster assignments must reference unique known players.",
    })
  }

  const membershipIds = [
    ...rosteredIds,
    ...universe.freeAgentIds,
    ...universe.draftProspectIds,
  ]
  if (
    membershipIds.length !== new Set(membershipIds).size ||
    membershipIds.length !== players.length
  ) {
    issues.push({
      code: "invalid-population-membership",
      message:
        "Every player must belong to exactly one roster, free-agent pool, or draft class.",
    })
  }

  for (const [teamId, roster] of Object.entries(universe.rosters)) {
    if (roster.length !== universe.config.rosterSize) {
      issues.push({
        code: "invalid-roster-size",
        message: `Roster must contain ${universe.config.rosterSize} players.`,
        teamId,
      })
    }

    for (const playerId of roster) {
      const player = universe.players[playerId]
      if (
        !player ||
        player.leagueStatus.kind !== "rostered" ||
        player.leagueStatus.teamId !== teamId
      ) {
        issues.push({
          code: "roster-status-mismatch",
          message: "Roster membership and player league status must agree.",
          teamId,
          playerId,
        })
      }
    }

    const teamDiagnostics = universe.assemblyDiagnostics.teams[teamId]
    const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]
    for (const position of positions) {
      if (
        (teamDiagnostics?.coreCoverage[position] ?? 0) <
        universe.config.rosterAssembly.coreDepthPerPosition
      ) {
        issues.push({
          code: "insufficient-core-coverage",
          message: `Roster does not meet its ${position} core-depth requirement.`,
          teamId,
        })
      }
    }
  }

  if (universe.freeAgentIds.length !== universe.config.initialFreeAgentCount) {
    issues.push({
      code: "invalid-free-agent-count",
      message: "Initial free-agent count does not match the universe config.",
    })
  }

  if (universe.draftProspectIds.length !== universe.config.draftProspectCount) {
    issues.push({
      code: "invalid-draft-prospect-count",
      message: "Draft-prospect count does not match the universe config.",
    })
  }

  for (const playerId of universe.freeAgentIds) {
    if (universe.players[playerId]?.leagueStatus.kind !== "free-agent") {
      issues.push({
        code: "free-agent-status-mismatch",
        message: "Free-agent collection contains a player with another status.",
        playerId,
      })
    }
  }

  for (const playerId of universe.draftProspectIds) {
    const status = universe.players[playerId]?.leagueStatus
    if (
      status?.kind !== "draft-prospect" ||
      status.draftClassId !== universe.metadata.draftClassId
    ) {
      issues.push({
        code: "draft-prospect-status-mismatch",
        message: "Draft class contains a player with another status.",
        playerId,
      })
    }
  }

  return issues
}

export function generateInitialPlayerUniverse(
  input: InitialPlayerUniverseInput
): InitialPlayerUniverse {
  const config = structuredClone(
    input.config ?? STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG
  )
  validateGenerationInput(input, config)

  const rosterPreset = createPlayerPopulationPreset("initial-roster")
  const freeAgentPreset = createPlayerPopulationPreset("initial-free-agents")
  const draftPreset = createPlayerPopulationPreset("draft-class")
  const populationConfigs = {
    "initial-roster":
      input.populationConfigs?.["initial-roster"] ?? rosterPreset.config,
    "initial-free-agents":
      input.populationConfigs?.["initial-free-agents"] ??
      freeAgentPreset.config,
    "draft-class":
      input.populationConfigs?.["draft-class"] ?? draftPreset.config,
  }
  const draftClassId = `${input.leagueId}:draft-class:1`
  const rosterPopulation = generatePlayerPopulation({
    seed: `${input.seed}:population:initial-roster`,
    context: {
      kind: "initial-league",
      id: `${input.leagueId}:initial-roster`,
    },
    count: input.teamIds.length * config.rosterSize,
    identityMode: "generated",
    config: populationConfigs["initial-roster"],
  })
  const freeAgentPopulation = generatePlayerPopulation({
    seed: `${input.seed}:population:initial-free-agents`,
    context: {
      kind: "free-agent-pool",
      id: `${input.leagueId}:initial-free-agents`,
    },
    count: config.initialFreeAgentCount,
    identityMode: "generated",
    config: populationConfigs["initial-free-agents"],
  })
  const draftPopulation = generatePlayerPopulation({
    seed: `${input.seed}:population:draft-class:1`,
    context: { kind: "draft-class", id: draftClassId },
    count: config.draftProspectCount,
    identityMode: "generated",
    config: populationConfigs["draft-class"],
  })
  const assembly = assembleInitialRosters({
    seed: input.seed,
    teamIds: input.teamIds,
    players: rosterPopulation.results.map((result) => result.player),
    config: config.rosterAssembly,
  })
  const freeAgents = applyStatus(
    freeAgentPopulation.results.map((result) => result.player),
    { kind: "free-agent" }
  )
  const draftProspects = applyStatus(
    draftPopulation.results.map((result) => result.player),
    { kind: "draft-prospect", draftClassId }
  )
  const allPlayers = [...assembly.players, ...freeAgents, ...draftProspects]
  const players = Object.fromEntries(
    allPlayers.map((player) => [player.id, player])
  )
  const universeWithoutIssues: Omit<InitialPlayerUniverse, "validationIssues"> =
    {
      metadata: {
        version: INITIAL_PLAYER_UNIVERSE_VERSION,
        seed: input.seed,
        leagueId: input.leagueId,
        draftClassId,
        plannedDraftSelections: config.plannedDraftSelections,
        populationPresetVersion: PLAYER_POPULATION_PRESET_VERSION,
        rosterAssemblyVersion: ROSTER_ASSEMBLY_VERSION,
        population: {
          initialRoster: rosterPopulation.metadata,
          initialFreeAgents: freeAgentPopulation.metadata,
          draftClass: draftPopulation.metadata,
        },
      },
      config,
      populationConfigs: structuredClone(populationConfigs),
      players,
      rosters: assembly.rosters,
      freeAgentIds: freeAgents.map((player) => player.id),
      draftProspectIds: draftProspects.map((player) => player.id),
      assemblyDiagnostics: assembly.diagnostics,
    }

  return {
    ...universeWithoutIssues,
    validationIssues: validateInitialPlayerUniverse(universeWithoutIssues),
  }
}
