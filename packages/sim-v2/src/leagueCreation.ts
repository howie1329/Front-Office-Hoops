import type {
  JsonRecord,
  LeagueDocument,
  PlayerEntity,
  TeamEntity,
} from "@workspace/domain-v2"

import { getPlayerCurrentAbility } from "./playerGeneration"
import {
  generateInitialPlayerUniverse,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "./playerUniverse"
import {
  createLeagueCalendar,
  createStandardLeagueStructure,
} from "./leagueSchedule"

const TEAM_NAMES = [
  "Baltimore Foundry",
  "Portland Forge",
  "Austin Comets",
  "Detroit Rivets",
  "Memphis Haze",
  "Reno Ghosts",
  "Albuquerque Orbit",
  "Anchorage Aurora",
  "Boston Beacon",
  "Charlotte Crowns",
  "Chicago Current",
  "Cincinnati Union",
  "Cleveland Furnace",
  "Columbus Flight",
  "Denver Summit",
  "Houston Halos",
  "Indianapolis Circuit",
  "Jacksonville Tides",
  "Kansas City Monarchs",
  "Las Vegas Neon",
  "Louisville Rivermen",
  "Milwaukee Northstar",
  "Nashville Tempo",
  "New Orleans Crescent",
  "Oklahoma City Thunderhead",
  "Philadelphia Bellwethers",
  "Phoenix Sol",
  "Sacramento Gold",
  "San Antonio Missions",
  "Seattle Rainmakers",
] as const

export const LEAGUE_CREATION_VERSION = 1
export const LEAGUE_TEAM_COUNT = TEAM_NAMES.length

export type LeagueCreationInput = {
  id: string
  name: string
  seed: string
  mode?: "normal" | "deterministic-lab"
  createdWithEntropy?: boolean
  now?: string
  advancedOverrides?: JsonRecord
}

export type LeagueTeamPreview = {
  teamId: string
  name: string
  conference: string
  division: string
  rosterSize: number
  topTenAverageAbility: number
  averageAge: number
  averagePotential: number
  marketSize: TeamEntity["marketSize"]
}

export type LeagueCreationResult = {
  version: 1
  document: LeagueDocument
  teamPreviews: LeagueTeamPreview[]
}

function teamId(index: number): string {
  return `team:${String(index + 1).padStart(2, "0")}`
}

function marketSize(index: number): NonNullable<TeamEntity["marketSize"]> {
  return index % 5 === 0 ? "large" : index % 2 === 0 ? "medium" : "small"
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function createTeams(): TeamEntity[] {
  return TEAM_NAMES.map((name, index) => ({
    id: teamId(index),
    name,
    marketSize: marketSize(index),
  }))
}

function createOwner(team: TeamEntity): JsonRecord {
  return {
    id: `owner:${team.id}`,
    teamId: team.id,
    personality: "balanced",
    marketSize: team.marketSize,
    goals: [],
  }
}

function createStaff(team: TeamEntity): JsonRecord[] {
  return ["head-coach", "offensive-coach", "defensive-coach", "head-scout"].map(
    (role) => ({
      id: `staff:${team.id}:${role}`,
      teamId: team.id,
      role,
      name: `${team.name} ${role.replaceAll("-", " ")}`,
    })
  )
}

function createContract(player: PlayerEntity): JsonRecord {
  const ability = getPlayerCurrentAbility(player)

  return {
    id: `contract:${player.id}`,
    playerId: player.id,
    teamId:
      player.leagueStatus.kind === "rostered"
        ? player.leagueStatus.teamId
        : null,
    salary: Math.max(1_000_000, Math.round(ability * 100_000)),
    yearsRemaining: 2,
    source: "initial-league",
  }
}

function createDraftAssets(team: TeamEntity): JsonRecord[] {
  return [1, 2].map((round) => ({
    id: `draft-asset:${team.id}:${round}`,
    teamId: team.id,
    round,
    season: 1,
    status: "owned",
  }))
}

function createTeamPreview(
  team: TeamEntity,
  roster: PlayerEntity[],
  structure: ReturnType<typeof createStandardLeagueStructure>
): LeagueTeamPreview {
  const abilities = roster
    .map(getPlayerCurrentAbility)
    .sort((left, right) => right - left)

  return {
    teamId: team.id,
    name: team.name,
    conference:
      structure.conferences.find(
        (conference) => conference.id === team.conferenceId
      )?.name ?? "Unknown conference",
    division:
      structure.divisions.find((division) => division.id === team.divisionId)
        ?.name ?? "Unknown division",
    rosterSize: roster.length,
    topTenAverageAbility: round(average(abilities.slice(0, 10))),
    averageAge: round(average(roster.map((player) => player.age))),
    averagePotential: round(
      average(roster.map((player) => player.profile.development.potential))
    ),
    marketSize: team.marketSize,
  }
}

export function createLeague(input: LeagueCreationInput): LeagueCreationResult {
  if (!input.id.trim()) throw new Error("League ID must not be empty.")
  if (!input.name.trim()) throw new Error("League name must not be empty.")
  if (!input.seed.trim()) throw new Error("League seed must not be empty.")

  const now = input.now ?? new Date().toISOString()
  const teams = createTeams()
  const teamIds = teams.map((team) => team.id)
  const structure = createStandardLeagueStructure(teamIds)
  const divisionsByTeamId = new Map(
    structure.divisions.flatMap((division) =>
      division.teamIds.map((teamId) => [teamId, division] as const)
    )
  )
  const teamsWithStructure = teams.map((team) => {
    const division = divisionsByTeamId.get(team.id)!
    return {
      ...team,
      conferenceId: division.conferenceId,
      divisionId: division.id,
    }
  })
  const calendar = createLeagueCalendar(
    teamIds,
    structure,
    input.seed,
    new Date(now).getUTCFullYear()
  )
  const universe = generateInitialPlayerUniverse({
    seed: input.seed,
    leagueId: input.id,
    teamIds,
    config: STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
  })

  if (universe.validationIssues.length > 0) {
    throw new Error(
      `Initial player universe is invalid: ${universe.validationIssues[0]?.message}`
    )
  }

  const teamsWithRosters = teamsWithStructure.map((team) => ({
    ...team,
    rosterPlayerIds: universe.rosters[team.id] ?? [],
  }))
  const rosteredPlayers = Object.values(universe.players).filter(
    (player) => player.leagueStatus.kind === "rostered"
  )
  const staff = teamsWithRosters.flatMap(createStaff)
  const contracts = rosteredPlayers.map(createContract)
  const draftAssets = teamsWithRosters.flatMap(createDraftAssets)
  const payroll = teamsWithRosters.map((team) => ({
    teamId: team.id,
    payroll: contracts
      .filter((contract) => contract.teamId === team.id)
      .reduce((sum, contract) => sum + Number(contract.salary ?? 0), 0),
  }))
  const document: LeagueDocument = {
    schema: {
      name: "foh-league",
      version: 1,
      rulesVersion: LEAGUE_CREATION_VERSION,
    },
    metadata: {
      id: input.id,
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      standardPresetId: "standard",
      resolvedConfig: { presetId: "standard", version: 1 },
      advancedOverrides: input.advancedOverrides ?? {},
    },
    randomness: {
      mode: input.mode ?? "normal",
      createdWithEntropy: input.createdWithEntropy ?? true,
      seed: input.seed,
    },
    state: {
      season: 1,
      phase: "regular-season",
      leagueDay: 0,
      userTeamId: null,
      structure,
      calendar,
      phaseTasks: [],
    },
    entities: {
      teams: Object.fromEntries(
        teamsWithRosters.map((team) => [team.id, team])
      ),
      players: universe.players,
      owners: Object.fromEntries(
        teamsWithRosters.map((team) => [`owner:${team.id}`, createOwner(team)])
      ),
      staff: Object.fromEntries(
        staff.map((member) => [member.id as string, member])
      ),
      contracts: Object.fromEntries(
        contracts.map((contract) => [contract.id as string, contract])
      ),
      draftAssets: Object.fromEntries(
        draftAssets.map((asset) => [asset.id as string, asset])
      ),
      offers: {},
    },
    projections: {
      standings: teamsWithRosters.map((team) => ({
        teamId: team.id,
        wins: 0,
        losses: 0,
      })),
      payroll,
    },
    history: {
      events: [],
      seasonArchives: [],
      records: [],
    },
  }

  return {
    version: LEAGUE_CREATION_VERSION,
    document,
    teamPreviews: teamsWithRosters.map((team) =>
      createTeamPreview(
        team,
        (team.rosterPlayerIds ?? []).map(
          (playerId) => universe.players[playerId]!
        ),
        structure
      )
    ),
  }
}
