import { formatPlayerIdentity } from "@workspace/domain-v2"
import type {
  GameCoachingProfile,
  GameMatchupFixture,
  GameResult,
  GameRotationInput,
  GameSimulationConfig,
  PlayerEntity,
  PlayerPosition,
} from "@workspace/domain-v2"
import {
  gameMatchupFixtureSchema,
  gameResultSchema,
} from "@workspace/league-schema"
import {
  createStandardGameSimulationConfig,
  GAME_SIMULATION_VERSION,
  generateInitialPlayerUniverse,
  getPlayerCurrentAbility,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
  simulateGameMatchup,
} from "@workspace/sim-v2"
import type { InitialPlayerUniverse } from "@workspace/sim-v2"

export const GAME_MATCHUP_LAB_REPORT_VERSION = 2
export const GAME_MATCHUP_LAB_TEAM_IDS = ["team-01", "team-02"] as const

export type GameMatchupLabOptions = {
  seed: string
  homeTeamId?: string
  awayTeamId?: string
  config?: GameSimulationConfig
}

export type GameMatchupLabReport = {
  schema: "foh-game-matchup-lab"
  version: number
  fixture: GameMatchupFixture
  result: GameResult
}

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function migrateGameMatchupLabReport(
  payload: unknown
): GameMatchupLabReport {
  if (!isJsonRecord(payload) || payload.schema !== "foh-game-matchup-lab") {
    throw new Error("Game matchup report has an invalid schema identifier.")
  }
  if (
    payload.version !== 1 &&
    payload.version !== GAME_MATCHUP_LAB_REPORT_VERSION
  ) {
    throw new Error(
      `Unsupported game matchup report version: ${String(payload.version)}.`
    )
  }
  if (!isJsonRecord(payload.result)) {
    throw new Error("Game matchup report is missing a result object.")
  }

  const migratedResult = {
    ...payload.result,
    version: GAME_SIMULATION_VERSION,
    ...(payload.result.lineupSegments === undefined
      ? { lineupSegments: [] }
      : {}),
  }

  return {
    schema: "foh-game-matchup-lab",
    version: GAME_MATCHUP_LAB_REPORT_VERSION,
    fixture: gameMatchupFixtureSchema.parse(payload.fixture),
    result: gameResultSchema.parse(migratedResult) as GameResult,
  }
}

const positions: Array<PlayerPosition> = ["PG", "SG", "SF", "PF", "C"]

function getTeamName(teamId: string): string {
  const number = Number(teamId.split(":").at(-1))
  return Number.isInteger(number)
    ? `Team ${String(number).padStart(2, "0")}`
    : teamId
}

function isPositionEligible(
  player: PlayerEntity,
  position: PlayerPosition
): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

function createRotation(players: Array<PlayerEntity>): GameRotationInput {
  const remaining = [...players]
  const starters: Array<string> = []
  for (const position of positions) {
    const index = remaining.findIndex((player) =>
      isPositionEligible(player, position)
    )
    const player = remaining.splice(index >= 0 ? index : 0, 1)[0]
    if (!starters.includes(player.id)) starters.push(player.id)
  }
  while (starters.length < 5 && remaining.length > 0) {
    starters.push(remaining.shift()!.id)
  }
  const depthOrder = [
    ...starters,
    ...remaining
      .sort(
        (left, right) =>
          getPlayerCurrentAbility(right) - getPlayerCurrentAbility(left)
      )
      .map((player) => player.id),
  ]
  return {
    starters,
    depthOrder,
    targetMinutes: Object.fromEntries(
      depthOrder.map((playerId) => [
        playerId,
        starters.includes(playerId) ? 32 : 8,
      ])
    ),
  }
}

function createCoachingProfile(): GameCoachingProfile {
  return {
    pace: 50,
    offensiveStyle: 50,
    defensivePressure: 50,
    shotSelection: 50,
    rotationDepth: 50,
  }
}

export function createGameMatchupLabFixture(
  universe: InitialPlayerUniverse,
  options: GameMatchupLabOptions = { seed: "game-matchup-lab" }
): GameMatchupFixture {
  const teamIds = universe.assemblyDiagnostics.teamOrder
  const homeTeamId = options.homeTeamId ?? teamIds[0]
  const awayTeamId = options.awayTeamId ?? teamIds[1]
  if (homeTeamId === "" || awayTeamId === "" || homeTeamId === awayTeamId) {
    throw new Error("A matchup fixture needs two different assembled teams.")
  }

  const selectedTeamIds = [homeTeamId, awayTeamId]
  const players: Record<string, PlayerEntity> = {}
  const rotations: Record<string, GameRotationInput> = {}
  const availability: GameMatchupFixture["availability"] = {}
  const coaching: Record<string, GameCoachingProfile> = {}
  const teams: GameMatchupFixture["teams"] = {}

  for (const teamId of selectedTeamIds) {
    const teamPlayers = universe.rosters[teamId].map(
      (playerId) => universe.players[playerId]
    )
    if (teamPlayers.length < 5) {
      throw new Error(`Team ${teamId} does not have a legal roster fixture.`)
    }
    for (const player of teamPlayers) {
      players[player.id] = player
      availability[player.id] = {
        available: true,
        gamesRemaining: 0,
        restriction: "none",
      }
    }
    rotations[teamId] = createRotation(teamPlayers)
    coaching[teamId] = createCoachingProfile()
    teams[teamId] = { id: teamId, name: getTeamName(teamId) }
  }

  return {
    version: 1,
    source: {
      kind: "initial-player-universe",
      id: universe.metadata.leagueId,
      version: universe.metadata.version,
    },
    seed: options.seed,
    homeTeamId,
    awayTeamId,
    teams,
    players,
    rotations,
    availability,
    coaching,
    config: options.config ?? createStandardGameSimulationConfig(),
  }
}

export function createDefaultGameMatchupLabFixture(
  seed = "game-matchup-lab"
): GameMatchupFixture {
  const teamIds = Array.from(
    { length: 30 },
    (_, index) => `game-matchup-lab:team:${String(index + 1).padStart(2, "0")}`
  )
  const universe = generateInitialPlayerUniverse({
    seed: `${seed}:universe`,
    leagueId: "game-matchup-lab",
    teamIds,
    config: STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
  })
  return createGameMatchupLabFixture(universe, { seed })
}

export function getGameMatchupLabPlayerName(
  fixture: GameMatchupFixture,
  playerId: string
): string {
  return formatPlayerIdentity(fixture.players[playerId].identity) ?? playerId
}

export function runGameMatchupLab(fixture: GameMatchupFixture): GameResult {
  return simulateGameMatchup(fixture)
}

export function serializeGameMatchupLabReport(
  fixture: GameMatchupFixture,
  result: GameResult
): string {
  const report: GameMatchupLabReport = {
    schema: "foh-game-matchup-lab",
    version: GAME_MATCHUP_LAB_REPORT_VERSION,
    fixture,
    result,
  }
  return JSON.stringify(report, null, 2)
}
