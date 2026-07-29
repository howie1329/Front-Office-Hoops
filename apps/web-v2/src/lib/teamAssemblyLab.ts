import { formatPlayerIdentity } from "@workspace/domain-v2"
import {
  generateInitialPlayerUniverse,
  getPlayerCurrentAbility,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "@workspace/sim-v2"
import type {
  InitialPlayerUniverse,
  RosterAssemblyConfig,
} from "@workspace/sim-v2"

export const TEAM_ASSEMBLY_LAB_REPORT_VERSION = 1
export const TEAM_ASSEMBLY_LAB_TEAM_COUNT = 30

export type TeamAssemblyLabOptions = {
  seed: string
  coreDepthPerPosition: number
  shortlistSize: number
  selectionVariance: number
}

export function createTeamAssemblyLabTeamIds(): Array<string> {
  return Array.from(
    { length: TEAM_ASSEMBLY_LAB_TEAM_COUNT },
    (_, index) => `team-assembly-lab:team:${String(index + 1).padStart(2, "0")}`
  )
}

export function getTeamAssemblyLabTeamName(teamId: string): string {
  const index = Number(teamId.split(":").at(-1))
  return Number.isInteger(index) && index > 0
    ? `Team ${String(index).padStart(2, "0")}`
    : teamId
}

export function createTeamAssemblyLabRun(
  options: TeamAssemblyLabOptions
): InitialPlayerUniverse {
  const rosterAssembly: RosterAssemblyConfig = {
    ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly),
    coreDepthPerPosition: options.coreDepthPerPosition,
    shortlistSize: options.shortlistSize,
    selectionVariance: options.selectionVariance,
  }

  return generateInitialPlayerUniverse({
    seed: options.seed,
    leagueId: "team-assembly-lab",
    teamIds: createTeamAssemblyLabTeamIds(),
    config: {
      ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG),
      rosterAssembly,
    },
  })
}

export function getTeamAssemblyLabPlayerName(
  universe: InitialPlayerUniverse,
  playerId: string
): string {
  const player = universe.players[playerId]

  return formatPlayerIdentity(player.identity) ?? playerId
}

export function summarizeUniversePopulation(
  universe: InitialPlayerUniverse,
  playerIds: Array<string>
) {
  const players = playerIds.map((playerId) => universe.players[playerId])
  const average = (values: Array<number>) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0

  return {
    count: players.length,
    averageAbility: average(players.map(getPlayerCurrentAbility)),
    averageAge: average(players.map((player) => player.age)),
    averagePotential: average(
      players.map((player) => player.profile.development.potential)
    ),
  }
}

export function serializeTeamAssemblyLabReport(
  options: TeamAssemblyLabOptions,
  universe: InitialPlayerUniverse
): string {
  return JSON.stringify(
    {
      schema: "foh-team-assembly-lab",
      version: TEAM_ASSEMBLY_LAB_REPORT_VERSION,
      options,
      universe,
    },
    null,
    2
  )
}
