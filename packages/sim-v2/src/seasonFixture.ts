import type {
  GameCoachingProfile,
  GameMatchupFixture,
  GameRotationInput,
  GameSimulationConfig,
  PlayerAvailability,
  PlayerEntity,
  SeasonFixture,
  SeasonProductionConfig,
  SeasonScheduleEntry,
} from "@workspace/domain-v2"
import {
  generateInitialPlayerUniverse,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "./playerUniverse"
import type { InitialPlayerUniverse } from "./playerUniverse"

import { getPlayerCurrentAbility } from "./playerGeneration"
import { createDeterministicRandom } from "./randomness"
import {
  createStandardSeasonProductionConfig,
  resolveSeasonProductionConfig,
} from "./seasonConfig"

const positions = ["PG", "SG", "SF", "PF", "C"] as const

function getTeamName(teamId: string): string {
  const number = Number(teamId.split(":").at(-1))
  return Number.isInteger(number)
    ? `Team ${String(number).padStart(2, "0")}`
    : teamId
}

function isPositionEligible(player: PlayerEntity, position: string): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

export function createDefaultRotation(
  players: Array<PlayerEntity>
): GameRotationInput {
  const remaining = [...players]
  const starters: string[] = []
  for (const position of positions) {
    const index = remaining.findIndex((player) =>
      isPositionEligible(player, position)
    )
    const player = remaining.splice(index >= 0 ? index : 0, 1)[0]
    if (player && !starters.includes(player.id)) starters.push(player.id)
  }
  while (starters.length < 5 && remaining.length > 0) {
    const player = remaining.shift()
    if (player && !starters.includes(player.id)) starters.push(player.id)
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

function createDefaultCoachingProfile(): GameCoachingProfile {
  return {
    pace: 50,
    offensiveStyle: 50,
    defensivePressure: 50,
    shotSelection: 50,
    rotationDepth: 50,
  }
}

function createAvailability(
  players: Record<string, PlayerEntity>
): Record<string, PlayerAvailability> {
  return Object.fromEntries(
    Object.keys(players).map((playerId) => [
      playerId,
      { available: true, gamesRemaining: 0, restriction: "none" },
    ])
  )
}

function balanceHomeAway(
  schedule: SeasonScheduleEntry[],
  teamIds: string[]
): SeasonScheduleEntry[] {
  const adjacency = new Map<string, number[]>()
  for (const teamId of teamIds) adjacency.set(teamId, [])
  schedule.forEach((game, index) => {
    adjacency.get(game.homeTeamId)?.push(index)
    adjacency.get(game.awayTeamId)?.push(index)
  })

  const used = new Set<number>()
  const oriented = new Array<{ homeTeamId: string; awayTeamId: string } | null>(
    schedule.length
  ).fill(null)

  for (const startTeamId of teamIds) {
    if ((adjacency.get(startTeamId) ?? []).every((index) => used.has(index))) {
      continue
    }

    const stack: Array<{ teamId: string; incomingEdge: number | null }> = [
      { teamId: startTeamId, incomingEdge: null },
    ]
    const circuit: Array<{ teamId: string; incomingEdge: number | null }> = []

    while (stack.length > 0) {
      const current = stack.at(-1)!
      const edgeIndex = (adjacency.get(current.teamId) ?? []).find(
        (index) => !used.has(index)
      )
      if (edgeIndex === undefined) {
        circuit.push(stack.pop()!)
        continue
      }

      used.add(edgeIndex)
      const edge = schedule[edgeIndex]!
      const nextTeamId =
        edge.homeTeamId === current.teamId ? edge.awayTeamId : edge.homeTeamId
      stack.push({ teamId: nextTeamId, incomingEdge: edgeIndex })
    }

    const orderedCircuit = circuit.reverse()
    for (let index = 1; index < orderedCircuit.length; index += 1) {
      const edgeIndex = orderedCircuit[index]!.incomingEdge
      if (edgeIndex === null) continue
      oriented[edgeIndex] = {
        homeTeamId: orderedCircuit[index - 1]!.teamId,
        awayTeamId: orderedCircuit[index]!.teamId,
      }
    }
  }

  return schedule.map((game, index) => ({
    ...game,
    ...(oriented[index] ?? {
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    }),
  }))
}

export function createBalancedSeasonSchedule(
  teamIds: string[],
  gamesPerTeam: number,
  seed: string
): SeasonScheduleEntry[] {
  if (teamIds.length < 2 || teamIds.length % 2 !== 0) {
    throw new Error("A balanced season schedule requires an even team count.")
  }
  if (
    !Number.isInteger(gamesPerTeam) ||
    gamesPerTeam < 1 ||
    gamesPerTeam > 82
  ) {
    throw new Error("Games per team must be an integer between one and 82.")
  }

  const random = createDeterministicRandom(seed)
  const fixedTeam = teamIds[0]!
  const rotatingTeams = teamIds.slice(1)
  const initialOffset = random.int(0, rotatingTeams.length - 1)
  const schedule: SeasonScheduleEntry[] = []

  for (let round = 0; round < gamesPerTeam; round += 1) {
    const offset = (initialOffset + round) % rotatingTeams.length
    const ordered = [
      fixedTeam,
      ...rotatingTeams.map(
        (_, index) => rotatingTeams[(index + offset) % rotatingTeams.length]!
      ),
    ]
    for (let pair = 0; pair < ordered.length / 2; pair += 1) {
      const first = ordered[pair]!
      const second = ordered[ordered.length - 1 - pair]!
      schedule.push({
        id: `season-game:${String(round + 1).padStart(2, "0")}:${String(
          pair + 1
        ).padStart(2, "0")}`,
        round: round + 1,
        leagueDay: round + 1,
        homeTeamId: first,
        awayTeamId: second,
      })
    }
  }
  return balanceHomeAway(schedule, teamIds)
}

export type SeasonFixtureOptions = {
  seed: string
  season?: number
  config?: SeasonProductionConfig
  gameConfig: GameSimulationConfig
}

export function createSeasonFixtureFromUniverse(
  universe: InitialPlayerUniverse,
  options: SeasonFixtureOptions
): SeasonFixture {
  const config = resolveSeasonProductionConfig(options.config)
  const teamIds = universe.assemblyDiagnostics.teamOrder
  if (teamIds.length !== config.schedule.teamCount) {
    throw new Error(
      `Season fixture requires ${config.schedule.teamCount} teams; received ${teamIds.length}.`
    )
  }
  const teams = Object.fromEntries(
    teamIds.map((teamId) => [teamId, { id: teamId, name: getTeamName(teamId) }])
  )
  const gameConfig = structuredClone(options.gameConfig)
  if (config.injuries.mode === "off") {
    gameConfig.injuries.frequency = "off"
    gameConfig.injuries.inGameInjuries = false
  }
  return {
    version: 1,
    source: {
      kind: "initial-player-universe",
      id: universe.metadata.leagueId,
      version: universe.metadata.version,
    },
    seed: options.seed,
    season: options.season ?? 1,
    teams,
    players: structuredClone(universe.players),
    rosters: structuredClone(universe.rosters),
    populations: {
      rostered: Object.values(universe.rosters).flat(),
      freeAgents: [...universe.freeAgentIds],
      draftProspects: [...universe.draftProspectIds],
    },
    schedule: createBalancedSeasonSchedule(
      teamIds,
      config.gamesPerTeam,
      config.schedule.scheduleSeed || `${options.seed}:schedule`
    ),
    rotations: Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        createDefaultRotation(
          universe.rosters[teamId]!.map(
            (playerId) => universe.players[playerId]!
          )
        ),
      ])
    ),
    coaching: Object.fromEntries(
      teamIds.map((teamId) => [teamId, createDefaultCoachingProfile()])
    ),
    availability: createAvailability(universe.players),
    gameConfig,
    config,
  }
}

export function createDefaultSeasonFixture(
  seed = "production-value-lab",
  options: {
    runPreset?: SeasonProductionConfig["runPreset"]
    gameConfig: GameSimulationConfig
  }
): SeasonFixture {
  const teamIds = Array.from(
    { length: 30 },
    (_, index) =>
      `production-value-lab:team:${String(index + 1).padStart(2, "0")}`
  )
  const universe = generateInitialPlayerUniverse({
    seed: `${seed}:universe`,
    leagueId: "production-value-lab",
    teamIds,
    config: {
      ...structuredClone(STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG),
      rosterAssembly: {
        ...structuredClone(
          STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly
        ),
        // The generated initial pool is intentionally compact. One core
        // player per position leaves enough coverage for all 30 teams while
        // preserving a 15-player roster for the season runner.
        coreDepthPerPosition: 1,
      },
    },
  })
  return createSeasonFixtureFromUniverse(universe, {
    seed,
    gameConfig: options.gameConfig,
    config: createStandardSeasonProductionConfig(options.runPreset ?? "full"),
  })
}

export function createSeasonGameFixture(
  fixture: SeasonFixture,
  entry: SeasonScheduleEntry,
  availability: Record<string, PlayerAvailability>,
  seed: string
): GameMatchupFixture {
  const teamIds = [entry.homeTeamId, entry.awayTeamId]
  const players: Record<string, PlayerEntity> = {}
  const matchupAvailability: Record<string, PlayerAvailability> = {}
  for (const teamId of teamIds) {
    for (const playerId of fixture.rosters[teamId] ?? []) {
      players[playerId] = fixture.players[playerId]!
      matchupAvailability[playerId] = structuredClone(
        availability[playerId] ?? {
          available: true,
          gamesRemaining: 0,
          restriction: "none",
        }
      )
    }
  }
  return {
    version: 1,
    source: fixture.source,
    seed,
    homeTeamId: entry.homeTeamId,
    awayTeamId: entry.awayTeamId,
    teams: Object.fromEntries(teamIds.map((id) => [id, fixture.teams[id]!])),
    players,
    rotations: {
      [entry.homeTeamId]: fixture.rotations[entry.homeTeamId]!,
      [entry.awayTeamId]: fixture.rotations[entry.awayTeamId]!,
    },
    availability: matchupAvailability,
    coaching: {
      [entry.homeTeamId]: fixture.coaching[entry.homeTeamId]!,
      [entry.awayTeamId]: fixture.coaching[entry.awayTeamId]!,
    },
    config: structuredClone(fixture.gameConfig),
  }
}
