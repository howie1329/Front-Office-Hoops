import type {
  PlayerArchetype,
  PlayerEntity,
  PlayerPosition,
} from "@workspace/domain-v2"

import { getPlayerCurrentAbility } from "./playerGeneration"
import { createDeterministicRandom } from "./randomness"

export const ROSTER_ASSEMBLY_VERSION = 1

export type RosterAssemblyConfig = {
  version: 1
  rosterSize: number
  coreDepthPerPosition: number
  shortlistSize: number
  selectionVariance: number
}

export const STANDARD_ROSTER_ASSEMBLY_CONFIG: RosterAssemblyConfig = {
  version: ROSTER_ASSEMBLY_VERSION,
  rosterSize: 15,
  coreDepthPerPosition: 2,
  shortlistSize: 5,
  selectionVariance: 2,
}

export type RosterAssemblyPickCandidate = {
  playerId: string
  currentAbility: number
  selectionNoise: number
  adjustedScore: number
}

export type RosterAssemblyPick = {
  round: number
  overallPick: number
  direction: "forward" | "reverse"
  teamId: string
  requiredPosition: PlayerPosition | null
  shortlist: RosterAssemblyPickCandidate[]
  selectedPlayerId: string
}

export type TeamAssemblyDiagnostics = {
  teamId: string
  rosterSize: number
  coreCoverage: Record<PlayerPosition, number>
  positionCoverage: Record<PlayerPosition, number>
  primaryPositionCounts: Record<PlayerPosition, number>
  primaryArchetypeCounts: Partial<Record<PlayerArchetype, number>>
  totalCurrentAbility: number
  topFiveAverageAbility: number
  topTenAverageAbility: number
  bestPlayerAbility: number
  averageAge: number
  averagePotential: number
}

export type StrengthSummary = {
  minimum: number
  maximum: number
  average: number
  spread: number
}

export type RosterAssemblyDiagnostics = {
  teamOrder: string[]
  corePositionOrder: PlayerPosition[]
  picks: RosterAssemblyPick[]
  teams: Record<string, TeamAssemblyDiagnostics>
  leagueStrength: {
    totalCurrentAbility: StrengthSummary
    topFiveAverageAbility: StrengthSummary
    topTenAverageAbility: StrengthSummary
  }
}

export type RosterAssemblyInput = {
  seed: string
  teamIds: string[]
  players: PlayerEntity[]
  config?: RosterAssemblyConfig
}

export type RosterAssemblyResult = {
  version: 1
  config: RosterAssemblyConfig
  players: PlayerEntity[]
  rosters: Record<string, string[]>
  diagnostics: RosterAssemblyDiagnostics
}

const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function summarize(values: number[]): StrengthSummary {
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 0

  return {
    minimum: round(minimum),
    maximum: round(maximum),
    average: round(average(values)),
    spread: round(maximum - minimum),
  }
}

function isEligible(player: PlayerEntity, position: PlayerPosition): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

function validateInput(
  input: RosterAssemblyInput,
  config: RosterAssemblyConfig
) {
  if (input.seed.trim().length === 0) {
    throw new Error("Roster assembly seed must not be empty.")
  }

  if (input.teamIds.length === 0) {
    throw new Error("Roster assembly requires at least one team.")
  }

  if (
    input.teamIds.some((teamId) => teamId.trim().length === 0) ||
    new Set(input.teamIds).size !== input.teamIds.length
  ) {
    throw new Error("Roster assembly team IDs must be nonempty and unique.")
  }

  const playerIds = input.players.map((player) => player.id)
  if (
    playerIds.some((playerId) => playerId.trim().length === 0) ||
    new Set(playerIds).size !== playerIds.length
  ) {
    throw new Error("Roster assembly player IDs must be nonempty and unique.")
  }

  if (
    input.players.some(
      (player) => player.leagueStatus.kind !== "unassigned"
    )
  ) {
    throw new Error("Roster assembly players must begin unassigned.")
  }

  if (
    !Number.isInteger(config.rosterSize) ||
    config.rosterSize < positions.length
  ) {
    throw new Error("Roster size must be an integer of at least five.")
  }

  if (
    !Number.isInteger(config.coreDepthPerPosition) ||
    config.coreDepthPerPosition < 1 ||
    config.coreDepthPerPosition > 2
  ) {
    throw new Error("Core depth per position must be either one or two.")
  }

  if (config.coreDepthPerPosition * positions.length > config.rosterSize) {
    throw new Error("Core position requirements exceed the roster size.")
  }

  if (
    !Number.isInteger(config.shortlistSize) ||
    config.shortlistSize < 1 ||
    config.shortlistSize > 10
  ) {
    throw new Error("Shortlist size must be an integer from one to ten.")
  }

  if (
    !Number.isFinite(config.selectionVariance) ||
    config.selectionVariance < 0 ||
    config.selectionVariance > 10
  ) {
    throw new Error("Selection variance must be between zero and ten.")
  }

  const requiredPlayerCount = input.teamIds.length * config.rosterSize
  if (input.players.length !== requiredPlayerCount) {
    throw new Error(
      `Roster assembly requires exactly ${requiredPlayerCount} players.`
    )
  }

  for (const position of positions) {
    const supply = input.players.filter((player) =>
      isEligible(player, position)
    ).length
    const demand = input.teamIds.length * config.coreDepthPerPosition

    if (supply < demand) {
      throw new Error(
        `Roster assembly needs ${demand} ${position}-eligible players but only ${supply} are available.`
      )
    }
  }
}

function shuffledTeamOrder(seed: string, teamIds: string[]): string[] {
  const random = createDeterministicRandom(`${seed}:team-order`)
  const shuffled = [...teamIds]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(0, index)
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]!
    shuffled[swapIndex] = current!
  }

  return shuffled
}

function createTeamDiagnostics(
  teamId: string,
  roster: PlayerEntity[],
  corePicks: RosterAssemblyPick[]
): TeamAssemblyDiagnostics {
  const abilities = roster
    .map(getPlayerCurrentAbility)
    .sort((left, right) => right - left)
  const coreCoverage = Object.fromEntries(
    positions.map((position) => [
      position,
      corePicks.filter((pick) => pick.requiredPosition === position).length,
    ])
  ) as Record<PlayerPosition, number>
  const positionCoverage = Object.fromEntries(
    positions.map((position) => [
      position,
      roster.filter((player) => isEligible(player, position)).length,
    ])
  ) as Record<PlayerPosition, number>
  const primaryPositionCounts = Object.fromEntries(
    positions.map((position) => [
      position,
      roster.filter(
        (player) => player.profile.role.primaryPosition === position
      ).length,
    ])
  ) as Record<PlayerPosition, number>
  const primaryArchetypeCounts = roster.reduce<
    Partial<Record<PlayerArchetype, number>>
  >((counts, player) => {
    const archetype = player.profile.role.primaryArchetype
    counts[archetype] = (counts[archetype] ?? 0) + 1
    return counts
  }, {})

  return {
    teamId,
    rosterSize: roster.length,
    coreCoverage,
    positionCoverage,
    primaryPositionCounts,
    primaryArchetypeCounts,
    totalCurrentAbility: abilities.reduce((sum, value) => sum + value, 0),
    topFiveAverageAbility: round(average(abilities.slice(0, 5))),
    topTenAverageAbility: round(average(abilities.slice(0, 10))),
    bestPlayerAbility: abilities[0] ?? 0,
    averageAge: round(average(roster.map((player) => player.age))),
    averagePotential: round(
      average(roster.map((player) => player.profile.development.potential))
    ),
  }
}

export function assembleInitialRosters(
  input: RosterAssemblyInput
): RosterAssemblyResult {
  const config = structuredClone(
    input.config ?? STANDARD_ROSTER_ASSEMBLY_CONFIG
  )
  validateInput(input, config)

  const assemblySeed = `${input.seed}:team-assembly:v${ROSTER_ASSEMBLY_VERSION}`
  const teamOrder = shuffledTeamOrder(assemblySeed, input.teamIds)
  const positionSupply = Object.fromEntries(
    positions.map((position) => [
      position,
      input.players.filter((player) => isEligible(player, position)).length,
    ])
  ) as Record<PlayerPosition, number>
  const corePositionOrder = [...positions].sort(
    (left, right) =>
      positionSupply[left] - positionSupply[right] ||
      positions.indexOf(left) - positions.indexOf(right)
  )
  const requiredPositions = Array.from(
    { length: config.coreDepthPerPosition },
    () => corePositionOrder
  ).flat()
  const rosters = Object.fromEntries(
    input.teamIds.map((teamId) => [teamId, [] as string[]])
  )
  const playersById = new Map(
    input.players.map((player) => [player.id, player])
  )
  const availableIds = new Set(playersById.keys())
  const picks: RosterAssemblyPick[] = []
  let overallPick = 0

  for (let roundIndex = 0; roundIndex < config.rosterSize; roundIndex += 1) {
    const direction = roundIndex % 2 === 0 ? "forward" : "reverse"
    const roundTeams =
      direction === "forward" ? teamOrder : [...teamOrder].reverse()
    const requiredPosition = requiredPositions[roundIndex] ?? null

    for (const teamId of roundTeams) {
      overallPick += 1
      const candidates = [...availableIds]
        .map((playerId) => playersById.get(playerId)!)
        .filter(
          (player) =>
            requiredPosition === null || isEligible(player, requiredPosition)
        )
        .sort(
          (left, right) =>
            getPlayerCurrentAbility(right) - getPlayerCurrentAbility(left) ||
            left.id.localeCompare(right.id)
        )
        .slice(0, config.shortlistSize)

      if (candidates.length === 0) {
        throw new Error(
          `Roster assembly could not fill ${requiredPosition ?? "a bench spot"} for ${teamId}.`
        )
      }

      const shortlist = candidates
        .map((player) => {
          const currentAbility = getPlayerCurrentAbility(player)
          const selectionNoise = round(
            createDeterministicRandom(
              `${assemblySeed}:pick:${overallPick}:player:${player.id}`
            ).normal(0, config.selectionVariance),
            3
          )

          return {
            playerId: player.id,
            currentAbility,
            selectionNoise,
            adjustedScore: round(currentAbility + selectionNoise, 3),
          }
        })
        .sort(
          (left, right) =>
            right.adjustedScore - left.adjustedScore ||
            left.playerId.localeCompare(right.playerId)
        )
      const selectedPlayerId = shortlist[0]!.playerId

      rosters[teamId]!.push(selectedPlayerId)
      availableIds.delete(selectedPlayerId)
      picks.push({
        round: roundIndex + 1,
        overallPick,
        direction,
        teamId,
        requiredPosition,
        shortlist,
        selectedPlayerId,
      })
    }
  }

  const teamByPlayerId = new Map<string, string>()
  for (const [teamId, playerIds] of Object.entries(rosters)) {
    for (const playerId of playerIds) {
      teamByPlayerId.set(playerId, teamId)
    }
  }

  const players = input.players.map((player) => ({
    ...player,
    leagueStatus: {
      kind: "rostered" as const,
      teamId: teamByPlayerId.get(player.id)!,
    },
  }))
  const assembledPlayersById = new Map(
    players.map((player) => [player.id, player])
  )
  const teams = Object.fromEntries(
    input.teamIds.map((teamId) => {
      const roster = rosters[teamId]!.map((playerId) =>
        assembledPlayersById.get(playerId)!
      )
      return [
        teamId,
        createTeamDiagnostics(
          teamId,
          roster,
          picks.filter(
            (pick) => pick.teamId === teamId && pick.requiredPosition !== null
          )
        ),
      ]
    })
  )
  const teamDiagnostics = Object.values(teams)

  return {
    version: ROSTER_ASSEMBLY_VERSION,
    config,
    players,
    rosters,
    diagnostics: {
      teamOrder,
      corePositionOrder,
      picks,
      teams,
      leagueStrength: {
        totalCurrentAbility: summarize(
          teamDiagnostics.map((team) => team.totalCurrentAbility)
        ),
        topFiveAverageAbility: summarize(
          teamDiagnostics.map((team) => team.topFiveAverageAbility)
        ),
        topTenAverageAbility: summarize(
          teamDiagnostics.map((team) => team.topTenAverageAbility)
        ),
      },
    },
  }
}
