import type {
  GameDiagnostic,
  GameEvent,
  GameLineupSegment,
  GameCoachingProfile,
  GameMatchupFixture,
  GamePeriodResult,
  GamePlayerBoxScore,
  GameReconciliationCheck,
  GameReconciliationReport,
  GameResult,
  GameRotationInput,
  GameSimulationConfig,
  GameTeamBoxScore,
  PlayerAvailability,
  PlayerEntity,
} from "@workspace/domain-v2"
import { formatPlayerIdentity } from "@workspace/domain-v2"

import {
  GAME_SIMULATION_VERSION,
  resolveGameSimulationConfig,
} from "./gameConfig"
import { createDeterministicRandom } from "./randomness"
import type { RandomSource } from "./randomness"
import { getPlayerCurrentAbility } from "./playerGeneration"

const REGULATION_PERIODS = 4
const REGULATION_MINUTES = 48
const TEAM_MINUTES = REGULATION_MINUTES * 5

type MutablePlayerStats = Omit<GamePlayerBoxScore, "availability">

type RotationPlan = {
  teamId: string
  playerIds: string[]
  activePlayerIds: string[]
  targetMinutes: Record<string, number>
  starterIds: Set<string>
}

type RoleAssignment = {
  label: string
  creationShare: number
  scoringShare: number
  creationWeight: number
  scoringWeight: number
}

type FoulType = "shooting" | "non-shooting"

type ReboundOutcome = {
  teamId: string
  playerId: string
  kind: "offensive" | "defensive"
}

type ShotOutcome = {
  shooterId: string
  type: "rim" | "midrange" | "three"
  made: boolean
  blockedById: string | null
  rebound: ReboundOutcome | null
  assistPlayerId: string | null
  secondChance: boolean
}

type FreeThrowOutcome = {
  shooterId: string
  attempts: number
  made: number
}

type FoulOutcome = {
  playerId: string
  teamId: string
  type: FoulType
}

type PossessionOutcome = {
  id: string
  period: number
  possession: number
  offenseTeamId: string
  defenseTeamId: string
  offenseLineupIds: string[]
  defenseLineupIds: string[]
  opportunityPlayerId: string
  terminal:
    | "turnover"
    | "shooting-foul"
    | "non-shooting-foul"
    | "field-goal"
    | "defensive-rebound"
  shots: ShotOutcome[]
  freeThrows: FreeThrowOutcome[]
  fouls: FoulOutcome[]
  stealPlayerId: string | null
  points: number
  continuationCount: number
}

type PossessionLedger = {
  entries: PossessionOutcome[]
}

export type GameTeamSimulationTelemetry = {
  possessions: number
  shootingFouls: number
  nonShootingFouls: number
  secondChanceAttempts: number
  secondChancePoints: number
  offensiveReboundContinuations: number
}

export type GameSimulationTelemetry = {
  totalPossessions: number
  byTeam: Record<string, GameTeamSimulationTelemetry>
}

export type GameSimulationExecution = {
  result: GameResult
  telemetry: GameSimulationTelemetry
  reconcile: () => GameReconciliationReport
}

type TeamRuntime = {
  currentLineup: string[]
  lastClockMinute: number
  lastPeriod: number
  periodMinutes: number
  lastCheckpoint: number
  minutes: Record<string, number>
  fatigue: Record<string, number>
  fouls: Record<string, number>
  lineupSegmentIds: string[]
}

type SimulationState = {
  fixture: GameMatchupFixture
  config: GameSimulationConfig
  random: RandomSource
  teams: Record<string, MutableTeamStats>
  players: Record<string, MutablePlayerStats>
  roles: Record<string, RoleAssignment>
  rotations: Record<string, RotationPlan>
  runtimes: Record<string, TeamRuntime>
  availability: Record<string, PlayerAvailability>
  periods: GamePeriodResult[]
  lineupSegments: GameLineupSegment[]
  events: GameEvent[]
  diagnostics: GameDiagnostic[]
  ledger: PossessionLedger
}

type MutableTeamStats = {
  teamId: string
  points: number
  possessions: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
}

function diagnostic(
  code: string,
  message: string,
  scope: GameDiagnostic["scope"],
  severity: GameDiagnostic["severity"] = "error",
  path?: Array<string | number>
): GameDiagnostic {
  return { code, message, scope, severity, path }
}

function emptyTeamStats(teamId: string): MutableTeamStats {
  return {
    teamId,
    points: 0,
    possessions: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    shotProfile: {
      rimAttempts: 0,
      midrangeAttempts: 0,
      threePointAttempts: 0,
    },
  }
}

function emptyPlayerStats(
  player: PlayerEntity,
  teamId: string,
  starter: boolean,
  role: RoleAssignment
): MutablePlayerStats {
  return {
    playerId: player.id,
    teamId,
    starter,
    minutes: 0,
    opportunities: 0,
    usageRate: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    shotProfile: {
      rimAttempts: 0,
      midrangeAttempts: 0,
      threePointAttempts: 0,
    },
    role: {
      label: role.label,
      creationShare: role.creationShare,
      scoringShare: role.scoringShare,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getEffectiveCoachProfile(
  profile: GameCoachingProfile,
  config: GameSimulationConfig
): GameCoachingProfile {
  const influence = clamp(config.coaching.influence / 100, 0, 1)
  const resolve = (value: number) => 50 + (value - 50) * influence
  return {
    pace: resolve(profile.pace),
    offensiveStyle: resolve(profile.offensiveStyle),
    defensivePressure: resolve(profile.defensivePressure),
    shotSelection: resolve(profile.shotSelection),
    rotationDepth: resolve(profile.rotationDepth),
  }
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function getAvailability(
  fixture: GameMatchupFixture,
  playerId: string
): PlayerAvailability {
  return {
    available: fixture.availability[playerId]?.available ?? true,
    gamesRemaining: fixture.availability[playerId]?.gamesRemaining ?? 0,
    restriction: fixture.availability[playerId]?.restriction ?? "none",
    minutesLimit: fixture.availability[playerId]?.minutesLimit,
  }
}

function getPlayersForTeam(
  fixture: GameMatchupFixture,
  rotation: GameRotationInput
): string[] {
  return [...new Set([...rotation.starters, ...rotation.depthOrder])].filter(
    (playerId) => fixture.players[playerId]?.leagueStatus.kind !== undefined
  )
}

const LINEUP_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const

function isPositionEligible(
  player: PlayerEntity,
  position: (typeof LINEUP_POSITIONS)[number]
): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

function canCoverLineupPositions(
  fixture: GameMatchupFixture,
  playerIds: string[],
  positionIndex = 0,
  used = new Set<string>()
): boolean {
  if (positionIndex >= LINEUP_POSITIONS.length) return true
  const position = LINEUP_POSITIONS[positionIndex]
  return playerIds.some((playerId) => {
    if (used.has(playerId)) return false
    const player = fixture.players[playerId]
    if (!player || !isPositionEligible(player, position)) return false
    used.add(playerId)
    const covered = canCoverLineupPositions(
      fixture,
      playerIds,
      positionIndex + 1,
      used
    )
    used.delete(playerId)
    return covered
  })
}

function validateRotation(
  fixture: GameMatchupFixture,
  teamId: string,
  diagnostics: GameDiagnostic[]
): void {
  const rotation = fixture.rotations[teamId]
  if (!rotation) {
    diagnostics.push(
      diagnostic(
        "missing-rotation",
        `Team ${teamId} is missing a rotation configuration.`,
        "rotation",
        "error",
        ["rotations", teamId]
      )
    )
    return
  }

  if (rotation.starters.length !== 5) {
    diagnostics.push(
      diagnostic(
        "invalid-starter-count",
        `Team ${teamId} must have exactly five starters.`,
        "rotation",
        "error",
        ["rotations", teamId, "starters"]
      )
    )
  }

  if (new Set(rotation.starters).size !== rotation.starters.length) {
    diagnostics.push(
      diagnostic(
        "duplicate-starter",
        `Team ${teamId} has duplicate starters.`,
        "rotation",
        "error",
        ["rotations", teamId, "starters"]
      )
    )
  }

  if (new Set(rotation.depthOrder).size !== rotation.depthOrder.length) {
    diagnostics.push(
      diagnostic(
        "duplicate-depth-player",
        `Team ${teamId} has duplicate players in its depth order.`,
        "rotation",
        "error",
        ["rotations", teamId, "depthOrder"]
      )
    )
  }

  const playerIds = getPlayersForTeam(fixture, rotation)
  if (playerIds.length < 5) {
    diagnostics.push(
      diagnostic(
        "insufficient-rotation-players",
        `Team ${teamId} needs at least five known rotation players.`,
        "rotation",
        "error",
        ["rotations", teamId]
      )
    )
  }
  const availablePlayerIds = playerIds.filter(
    (playerId) => getAvailability(fixture, playerId).available
  )
  if (availablePlayerIds.length < 5) {
    diagnostics.push(
      diagnostic(
        "insufficient-available-players",
        `Team ${teamId} needs at least five available rotation players.`,
        "rotation",
        "error",
        ["availability", teamId]
      )
    )
  }

  for (const playerId of [...rotation.starters, ...rotation.depthOrder]) {
    if (!fixture.players[playerId]) {
      diagnostics.push(
        diagnostic(
          "unknown-rotation-player",
          `Rotation references unknown player ${playerId}.`,
          "rotation",
          "error",
          ["rotations", teamId, playerId]
        )
      )
    }
  }

  for (const playerId of rotation.starters) {
    if (!rotation.depthOrder.includes(playerId)) {
      diagnostics.push(
        diagnostic(
          "starter-missing-from-depth-order",
          `Starter ${playerId} must appear in the depth order.`,
          "rotation",
          "error",
          ["rotations", teamId, "depthOrder"]
        )
      )
    }

    if (!getAvailability(fixture, playerId).available) {
      diagnostics.push(
        diagnostic(
          "unavailable-starter",
          `${formatPlayerIdentity(fixture.players[playerId]?.identity ?? {}) ?? playerId} is unavailable and cannot start.`,
          "rotation",
          "error",
          ["availability", playerId]
        )
      )
    }
  }

  const targetTotal = sum(
    playerIds.map((playerId) => rotation.targetMinutes[playerId] ?? 0)
  )
  if (targetTotal <= 0) {
    diagnostics.push(
      diagnostic(
        "missing-target-minutes",
        `Team ${teamId} must provide positive target minutes.`,
        "rotation",
        "error",
        ["rotations", teamId, "targetMinutes"]
      )
    )
  }

  if (
    rotation.starters.length === 5 &&
    rotation.starters.every((playerId) => fixture.players[playerId]) &&
    !canCoverLineupPositions(fixture, rotation.starters) &&
    canCoverLineupPositions(fixture, availablePlayerIds)
  ) {
    diagnostics.push(
      diagnostic(
        "invalid-starter-position-fit",
        `Team ${teamId} starters cannot cover one eligible player at each lineup position.`,
        "rotation",
        "error",
        ["rotations", teamId, "starters"]
      )
    )
  }

  for (const [playerId, targetMinutes] of Object.entries(
    rotation.targetMinutes
  )) {
    if (!rotation.depthOrder.includes(playerId)) {
      diagnostics.push(
        diagnostic(
          "target-minutes-player-missing",
          `Target minutes reference player ${playerId} outside the depth order.`,
          "rotation",
          "error",
          ["rotations", teamId, "targetMinutes", playerId]
        )
      )
    }
    if (!Number.isFinite(targetMinutes) || targetMinutes < 0) {
      diagnostics.push(
        diagnostic(
          "invalid-target-minutes",
          `Target minutes for ${playerId} must be a non-negative finite number.`,
          "rotation",
          "error",
          ["rotations", teamId, "targetMinutes", playerId]
        )
      )
    }
  }
}

export function validateGameMatchupFixture(
  fixture: GameMatchupFixture
): GameDiagnostic[] {
  const diagnostics: GameDiagnostic[] = []

  if (!fixture.seed.trim()) {
    diagnostics.push(
      diagnostic("missing-seed", "A deterministic seed is required.", "fixture")
    )
  }

  if (fixture.homeTeamId === fixture.awayTeamId) {
    diagnostics.push(
      diagnostic(
        "duplicate-team",
        "Home and away teams must be different.",
        "fixture",
        "error",
        ["awayTeamId"]
      )
    )
  }

  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    if (!fixture.teams[teamId]) {
      diagnostics.push(
        diagnostic(
          "unknown-team",
          `Matchup references unknown team ${teamId}.`,
          "fixture",
          "error",
          ["teams", teamId]
        )
      )
    }
    validateRotation(fixture, teamId, diagnostics)
    if (!fixture.coaching[teamId]) {
      diagnostics.push(
        diagnostic(
          "missing-coaching-profile",
          `Team ${teamId} is missing a coaching profile.`,
          "fixture",
          "error",
          ["coaching", teamId]
        )
      )
    }
  }

  return diagnostics
}

function weightedChoice(
  random: RandomSource,
  entries: Array<{ id: string; weight: number }>
): string {
  const total = sum(entries.map((entry) => Math.max(0.01, entry.weight)))
  let target = random.next() * total

  for (const entry of entries) {
    target -= Math.max(0.01, entry.weight)
    if (target <= 0) return entry.id
  }

  return entries.at(-1)?.id ?? ""
}

function createRole(player: PlayerEntity): RoleAssignment {
  const skills = player.profile.skills
  const ability = getPlayerCurrentAbility(player)
  const creator =
    skills.handling * 0.38 +
    skills.passing * 0.26 +
    skills.basketballIQ * 0.2 +
    skills.shooting * 0.16
  const scorer =
    skills.shooting * 0.3 +
    skills.finishing * 0.32 +
    skills.handling * 0.18 +
    skills.basketballIQ * 0.2
  const connector = skills.passing * 0.45 + skills.basketballIQ * 0.3
  const shooter = skills.shooting * 0.68 + skills.basketballIQ * 0.16
  const label =
    (creator >= scorer * 1.08 && creator >= 62) ||
    (ability >= 84 && creator >= 72)
      ? "Primary creator"
      : (scorer >= creator * 1.08 && scorer >= 62) ||
          (ability >= 84 && scorer >= 72)
        ? "Scoring creator"
        : connector >= 64
          ? "Connector"
          : shooter >= 66
            ? "Movement shooter"
            : "Role player"

  return {
    label,
    creationShare: creator,
    scoringShare: scorer,
    creationWeight: creator,
    scoringWeight: scorer,
  }
}

function buildRotationPlan(
  fixture: GameMatchupFixture,
  teamId: string,
  config: GameSimulationConfig
): RotationPlan {
  const rotation = fixture.rotations[teamId]!
  const playerIds = getPlayersForTeam(fixture, rotation)
  const availableIds = playerIds.filter(
    (playerId) => getAvailability(fixture, playerId).available
  )
  const coach = getEffectiveCoachProfile(fixture.coaching[teamId]!, config)
  const desiredRotationSize = clamp(
    Math.round(9 + (coach.rotationDepth - 50) / 25),
    6,
    10
  )
  const starterIds = rotation.starters.filter((playerId) =>
    availableIds.includes(playerId)
  )
  const activePlayerIds = [
    ...starterIds,
    ...rotation.depthOrder.filter(
      (playerId) =>
        availableIds.includes(playerId) && !starterIds.includes(playerId)
    ),
  ].slice(0, Math.max(5, desiredRotationSize))
  const rawMinutes = Object.fromEntries(
    playerIds.map((playerId) => {
      const defaultMinutes = rotation.starters.includes(playerId) ? 32 : 12
      const configured = rotation.targetMinutes[playerId] ?? defaultMinutes
      const adherence = config.rotation.adherence / 100
      const blended = defaultMinutes + (configured - defaultMinutes) * adherence
      const availability = getAvailability(fixture, playerId)
      const limited =
        availability.restriction === "minutes-limited"
          ? Math.min(blended, availability.minutesLimit ?? 24)
          : blended
      return [
        playerId,
        availability.available && activePlayerIds.includes(playerId)
          ? Math.max(0, limited)
          : 0,
      ]
    })
  ) as Record<string, number>

  const starterWeight = 0.75 + config.rotation.starterWorkload / 400
  for (const playerId of rotation.starters) {
    if (rawMinutes[playerId]) rawMinutes[playerId] *= starterWeight
  }

  const targetTotal = sum(Object.values(rawMinutes)) || TEAM_MINUTES
  const targetMinutes = Object.fromEntries(
    playerIds.map((playerId) => [
      playerId,
      ((rawMinutes[playerId] ?? 0) / targetTotal) * TEAM_MINUTES,
    ])
  ) as Record<string, number>

  if (availableIds.length < 5) {
    return {
      teamId,
      playerIds,
      activePlayerIds,
      targetMinutes,
      starterIds: new Set(rotation.starters),
    }
  }

  return {
    teamId,
    playerIds,
    activePlayerIds,
    targetMinutes,
    starterIds: new Set(rotation.starters),
  }
}

function buildTeamBoxScore(
  team: MutableTeamStats,
  periods: GamePeriodResult[]
): GameTeamBoxScore {
  const possessions = sum(
    periods.map((period) => period.teamPossessions[team.teamId] ?? 0)
  )
  return {
    ...team,
    possessions,
    pace: possessions,
    offensiveEfficiency: possessions
      ? round((team.points / possessions) * 100, 2)
      : 0,
  }
}

function createTeamRuntime(playerIds: string[]): TeamRuntime {
  return {
    currentLineup: [],
    lastClockMinute: 0,
    lastPeriod: 0,
    periodMinutes: 12,
    lastCheckpoint: -1,
    minutes: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    fatigue: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    fouls: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    lineupSegmentIds: [],
  }
}

function getTeamRuntime(state: SimulationState, teamId: string): TeamRuntime {
  return state.runtimes[teamId]!
}

function getRotationCandidates(
  state: SimulationState,
  teamId: string
): string[] {
  const plan = state.rotations[teamId]!
  return plan.playerIds.filter((playerId) => {
    const availability = state.availability[playerId]
    const runtime = getTeamRuntime(state, teamId)
    return Boolean(
      availability?.available &&
      (runtime.fouls[playerId] ?? 0) < 6 &&
      (availability.minutesLimit === undefined ||
        (runtime.minutes[playerId] ?? 0) < availability.minutesLimit - 0.05) &&
      (plan.targetMinutes[playerId] ?? 0) > 0
    )
  })
}

function getLineupWeight(
  state: SimulationState,
  teamId: string,
  playerId: string,
  period: number,
  minute: number,
  reason: GameLineupSegment["reason"]
): number {
  const plan = state.rotations[teamId]!
  const runtime = getTeamRuntime(state, teamId)
  const player = state.fixture.players[playerId]!
  const role = state.roles[playerId]!
  const target = plan.targetMinutes[playerId] ?? 0
  const played = runtime.minutes[playerId] ?? 0
  const deficit = Math.max(0, target - played)
  const starterBoost = plan.starterIds.has(playerId)
    ? 2.5 + state.config.rotation.starterWorkload / 80
    : 0
  const activePoolBoost = plan.activePlayerIds.includes(playerId) ? 2 : -4
  const fatiguePenalty = (runtime.fatigue[playerId] ?? 0) * 12
  const foulPenalty = (runtime.fouls[playerId] ?? 0) * 5
  const benchPreference =
    (1 - state.config.rotation.benchUsage / 100) *
    (plan.starterIds.has(playerId) ? 1.5 : 0)
  const periodStartBoost =
    reason === "period-start" || reason === "overtime"
      ? plan.starterIds.has(playerId)
        ? 8
        : 0
      : 0
  const roleFit = (role.creationWeight + role.scoringWeight) / 100
  const experience = Math.max(0, player.age - 24) * 0.02
  return (
    deficit * 1.4 +
    starterBoost +
    activePoolBoost +
    roleFit +
    experience +
    periodStartBoost -
    fatiguePenalty -
    foulPenalty -
    benchPreference +
    (period + minute) * 0.0001
  )
}

function findBestLineup(
  state: SimulationState,
  teamId: string,
  period: number,
  minute: number,
  reason: GameLineupSegment["reason"]
): string[] {
  const candidates = getRotationCandidates(state, teamId)
  if (candidates.length < 5) return candidates.slice(0, 5)

  let bestIds: string[] | undefined
  let bestScore = Number.NEGATIVE_INFINITY
  const used = new Set<string>()
  const selected: string[] = []

  function search(positionIndex: number, score: number): void {
    if (positionIndex >= LINEUP_POSITIONS.length) {
      if (score > bestScore) {
        bestScore = score
        bestIds = [...selected]
      }
      return
    }

    const position = LINEUP_POSITIONS[positionIndex]
    const eligible = candidates
      .filter((playerId) => {
        const player = state.fixture.players[playerId]!
        return !used.has(playerId) && isPositionEligible(player, position)
      })
      .sort(
        (left, right) =>
          getLineupWeight(state, teamId, right, period, minute, reason) -
          getLineupWeight(state, teamId, left, period, minute, reason)
      )

    for (const playerId of eligible) {
      used.add(playerId)
      selected.push(playerId)
      search(
        positionIndex + 1,
        score + getLineupWeight(state, teamId, playerId, period, minute, reason)
      )
      selected.pop()
      used.delete(playerId)
    }
  }

  search(0, 0)
  if (bestIds) return bestIds
  return candidates.slice(0, 5)
}

function recordLineupSegment(
  state: SimulationState,
  teamId: string,
  period: number,
  minute: number,
  reason: GameLineupSegment["reason"],
  lineup: string[]
): void {
  const runtime = getTeamRuntime(state, teamId)
  const previousId = runtime.lineupSegmentIds.at(-1)
  const previous = previousId
    ? state.lineupSegments.find((segment) => segment.id === previousId)
    : undefined
  if (previous) {
    previous.endMinute =
      previous.period === period
        ? minute
        : Math.max(previous.endMinute, runtime.periodMinutes)
  }

  const id = `lineup:${teamId}:${state.lineupSegments.length + 1}`
  const segment: GameLineupSegment = {
    id,
    teamId,
    period,
    startMinute: minute,
    endMinute: minute,
    playerIds: [...lineup],
    reason,
  }
  state.lineupSegments.push(segment)
  runtime.lineupSegmentIds.push(id)
  runtime.currentLineup = [...lineup]
}

function updateTeamClock(
  state: SimulationState,
  teamId: string,
  period: number,
  minute: number,
  periodMinutes: number
): void {
  const runtime = getTeamRuntime(state, teamId)
  if (runtime.lastPeriod !== period) {
    runtime.lastPeriod = period
    runtime.periodMinutes = periodMinutes
    runtime.lastClockMinute = 0
    runtime.lastCheckpoint = -1
    runtime.currentLineup = []
  }

  const clock = clamp(minute, 0, periodMinutes)
  const nextClock = Math.max(runtime.lastClockMinute, clock)
  const delta = nextClock - runtime.lastClockMinute
  if (delta > 0) {
    for (const playerId of runtime.minutes
      ? Object.keys(runtime.minutes)
      : []) {
      const player = state.fixture.players[playerId]
      if (!player) continue
      const onCourt = runtime.currentLineup.includes(playerId)
      const stamina = player.profile.skills.stamina
      const fatigueRate = 0.009 + (100 - stamina) * 0.00008
      const recoveryRate = 0.014 + stamina * 0.00003
      runtime.fatigue[playerId] = clamp(
        (runtime.fatigue[playerId] ?? 0) +
          (onCourt ? delta * fatigueRate : -delta * recoveryRate),
        0,
        0.45
      )
      if (onCourt) {
        runtime.minutes[playerId] = (runtime.minutes[playerId] ?? 0) + delta
        state.players[playerId]!.minutes = round(runtime.minutes[playerId])
      }
    }
  }
  runtime.lastClockMinute = nextClock
}

function ensureLineup(
  state: SimulationState,
  teamId: string,
  period: number,
  minute: number,
  periodMinutes: number,
  reason: GameLineupSegment["reason"] = "checkpoint"
): void {
  const runtime = getTeamRuntime(state, teamId)

  const clock = clamp(minute, 0, periodMinutes)
  let guard = 0
  while (
    runtime.currentLineup.length === 5 &&
    clock > runtime.lastClockMinute
  ) {
    const nextLimitBoundary = Math.min(
      ...runtime.currentLineup
        .map((playerId) => {
          const limit = state.availability[playerId]?.minutesLimit
          if (limit === undefined) return Number.POSITIVE_INFINITY
          const remaining = limit - (runtime.minutes[playerId] ?? 0)
          return remaining > 0
            ? runtime.lastClockMinute + remaining
            : runtime.lastClockMinute
        })
        .filter((boundary) => Number.isFinite(boundary))
    )
    if (!(nextLimitBoundary < clock - 0.0001) || guard >= 5) break

    updateTeamClock(state, teamId, period, nextLimitBoundary, periodMinutes)
    const replacement = findBestLineup(
      state,
      teamId,
      period,
      nextLimitBoundary,
      "checkpoint"
    )
    if (
      replacement.length !== 5 ||
      replacement.join("|") === runtime.currentLineup.join("|")
    ) {
      break
    }
    recordLineupSegment(
      state,
      teamId,
      period,
      nextLimitBoundary,
      "checkpoint",
      replacement
    )
    guard += 1
  }

  updateTeamClock(state, teamId, period, minute, periodMinutes)
  const checkpointSize = periodMinutes <= 5 ? periodMinutes : 4
  const checkpoint = Math.min(
    Math.floor(minute / checkpointSize),
    Math.floor(periodMinutes / checkpointSize)
  )
  const lineupInvalid = runtime.currentLineup.some(
    (playerId) => !playerCanPlay(state, playerId, teamId)
  )
  const shouldChange =
    runtime.currentLineup.length !== 5 ||
    lineupInvalid ||
    checkpoint > runtime.lastCheckpoint ||
    reason === "injury" ||
    reason === "foul-trouble"
  if (!shouldChange) return

  const lineup = findBestLineup(state, teamId, period, minute, reason)
  if (
    lineup.length === 5 &&
    lineup.join("|") !== runtime.currentLineup.join("|")
  ) {
    recordLineupSegment(state, teamId, period, minute, reason, lineup)
  }
  runtime.lastCheckpoint = checkpoint
}

function finishTeamPeriod(
  state: SimulationState,
  teamId: string,
  period: number,
  periodMinutes: number
): void {
  const runtime = getTeamRuntime(state, teamId)
  updateTeamClock(state, teamId, period, periodMinutes, periodMinutes)
  const segmentId = runtime.lineupSegmentIds.at(-1)
  const segment = segmentId
    ? state.lineupSegments.find((candidate) => candidate.id === segmentId)
    : undefined
  if (segment) segment.endMinute = periodMinutes
}

function playerCanPlay(
  state: SimulationState,
  playerId: string,
  teamId?: string
): boolean {
  const player = state.players[playerId]
  const availability = state.availability[playerId]
  const fouledOut = teamId
    ? (getTeamRuntime(state, teamId).fouls[playerId] ?? 0) >= 6
    : false
  const overMinutesLimit =
    teamId && availability?.minutesLimit !== undefined
      ? (getTeamRuntime(state, teamId).minutes[playerId] ?? 0) >=
        availability.minutesLimit - 0.05
      : false
  return Boolean(
    player && availability?.available && !fouledOut && !overMinutesLimit
  )
}

function chooseOffensivePlayer(
  state: SimulationState,
  teamId: string,
  period: number,
  possession: number
): string {
  const plan = state.rotations[teamId]!
  const config = state.config
  const runtime = getTeamRuntime(state, teamId)
  const entries = runtime.currentLineup
    .filter((playerId) => playerCanPlay(state, playerId, teamId))
    .map((playerId) => {
      const player = state.fixture.players[playerId]!
      const role = state.roles[playerId]!
      const plannedMinutes =
        state.rotations[teamId]!.targetMinutes[playerId] ?? 1
      const starterBoost = plan.starterIds.has(playerId)
        ? 1 + config.rotation.starterWorkload / 500
        : 1 + config.rotation.benchUsage / 400
      const abilityFactor = getPlayerCurrentAbility(player) / 100
      const starBoost =
        0.75 + abilityFactor * (0.35 + (config.offense.starUsage / 100) * 0.45)
      const fatiguePenalty = runtime.fatigue[playerId] ?? 0
      return {
        id: playerId,
        weight:
          plannedMinutes *
          (role.creationWeight * 0.7 + role.scoringWeight * 0.3) *
          starterBoost *
          starBoost *
          (1 - fatiguePenalty * 0.45),
      }
    })

  return weightedChoice(
    state.random.fork(`offense:${teamId}:${period}:${possession}`),
    entries
  )
}

function choosePlayer(
  state: SimulationState,
  teamId: string,
  scope: string,
  preference: (player: PlayerEntity) => number
): string {
  const runtime = getTeamRuntime(state, teamId)
  const entries = runtime.currentLineup
    .filter((playerId) => playerCanPlay(state, playerId, teamId))
    .map((playerId) => ({
      id: playerId,
      weight: Math.max(1, preference(state.fixture.players[playerId]!)),
    }))
  return weightedChoice(state.random.fork(scope), entries)
}

function getPlayerFatigue(
  state: SimulationState,
  teamId: string,
  playerId: string
): number {
  return getTeamRuntime(state, teamId).fatigue[playerId] ?? 0
}

function getLineupSpacing(
  state: SimulationState,
  teamId: string,
  excludePlayerId: string
): number {
  const lineup = getTeamRuntime(state, teamId).currentLineup.filter(
    (playerId) => playerId !== excludePlayerId
  )
  if (lineup.length === 0) return 50
  return (
    sum(
      lineup.map((playerId) => {
        const player = state.fixture.players[playerId]!
        return (
          player.profile.skills.shooting * 0.7 +
          player.profile.skills.basketballIQ * 0.2 +
          player.profile.skills.passing * 0.1
        )
      })
    ) / lineup.length
  )
}

function getDefenderFit(
  offensePlayer: PlayerEntity,
  defender: PlayerEntity,
  switching: number
): number {
  const offensePosition = offensePlayer.profile.role.primaryPosition
  const defenderRole = defender.profile.role
  const positionFit =
    defenderRole.primaryPosition === offensePosition
      ? 10
      : defenderRole.secondaryPosition === offensePosition
        ? 5
        : -3
  const sizeFit =
    5 -
    Math.abs(
      defender.profile.physical.heightInches -
        offensePlayer.profile.physical.heightInches
    ) *
      0.35
  const athleticFit =
    defender.profile.physical.speed * 0.16 +
    defender.profile.physical.wingspanInches * 0.08 +
    defender.profile.physical.vertical * 0.06
  const switchAdjustment = (switching - 50) * 0.08
  return (
    defender.profile.skills.defense * 0.55 +
    defender.profile.skills.basketballIQ * 0.18 +
    athleticFit +
    positionFit +
    sizeFit +
    switchAdjustment
  )
}

function chooseDefender(
  state: SimulationState,
  offensePlayer: PlayerEntity,
  defenseTeamId: string,
  scope: string
): string {
  const runtime = getTeamRuntime(state, defenseTeamId)
  const switching = state.config.defense.switching
  const entries = runtime.currentLineup
    .filter((playerId) => playerCanPlay(state, playerId, defenseTeamId))
    .map((playerId) => {
      const defender = state.fixture.players[playerId]!
      const fatigue = getPlayerFatigue(state, defenseTeamId, playerId)
      return {
        id: playerId,
        weight: Math.max(
          0.1,
          getDefenderFit(offensePlayer, defender, switching) *
            (1 - fatigue * 0.35)
        ),
      }
    })
  return weightedChoice(state.random.fork(scope), entries)
}

function attemptType(
  state: SimulationState,
  player: PlayerEntity,
  teamId: string,
  period: number,
  possession: number
): "rim" | "midrange" | "three" {
  const offense = state.config.offense
  const coach = getEffectiveCoachProfile(
    state.fixture.coaching[teamId]!,
    state.config
  )
  const transitionBias = (offense.transitionRate - 50) / 50
  const disciplineBias = (offense.shotSelectionDiscipline - 50) / 50
  const offensiveStyleBias = (coach.offensiveStyle - 50) / 50
  const coachSelectionBias =
    ((coach.shotSelection - 50) / 50) *
    (state.config.coaching.shotSelectionInfluence / 100)
  const quality = {
    three: player.profile.skills.shooting,
    rim: (player.profile.skills.finishing + player.profile.skills.handling) / 2,
    midrange:
      (player.profile.skills.shooting + player.profile.skills.basketballIQ) / 2,
  }
  const averageQuality = (quality.three + quality.rim + quality.midrange) / 3
  const spacing = getLineupSpacing(state, teamId, player.id)
  const fatigue = getPlayerFatigue(state, teamId, player.id)
  const archetype = player.profile.role.primaryArchetype
  const threeArchetypeBonus = [
    "shooting_wing",
    "three_and_d_wing",
    "stretch_big",
    "scoring_guard",
  ].includes(archetype)
    ? 3
    : 0
  const rimArchetypeBonus = [
    "slashing_wing",
    "interior_scorer",
    "rim_protector",
    "rebounding_big",
  ].includes(archetype)
    ? 3
    : 0
  const weights = [
    {
      id: "three" as const,
      weight:
        27 +
        offense.threePointRate * 0.3 +
        player.profile.skills.shooting * 0.12 +
        (quality.three - averageQuality) * disciplineBias * 0.08 +
        transitionBias * 2.2 +
        coachSelectionBias * 2.2 +
        offensiveStyleBias * 4 +
        threeArchetypeBonus -
        fatigue * 3,
    },
    {
      id: "rim" as const,
      weight:
        35 +
        offense.rimRate * 0.25 +
        player.profile.skills.finishing * 0.16 +
        player.profile.skills.handling * 0.04 +
        (quality.rim - averageQuality) * disciplineBias * 0.08 +
        transitionBias * 4.8 +
        coachSelectionBias * 3.2 +
        (spacing - 50) * 0.06 +
        rimArchetypeBonus -
        fatigue * 2,
    },
    {
      id: "midrange" as const,
      weight:
        18 +
        offense.midrangeRate * 0.2 +
        player.profile.skills.shooting * 0.08 +
        player.profile.skills.basketballIQ * 0.04 +
        (quality.midrange - averageQuality) * disciplineBias * 0.08 -
        transitionBias * 4.4 -
        coachSelectionBias * 5.4 -
        offensiveStyleBias * 1.5 +
        fatigue * 1.5,
    },
  ]
  return weightedChoice(
    state.random.fork(`shot:${player.id}:${period}:${possession}`),
    weights
  ) as "rim" | "midrange" | "three"
}

function resolveFreeThrows(
  state: SimulationState,
  shooterEntity: PlayerEntity,
  attempts: number,
  scope: string
): number {
  const makeRate = clamp(
    0.45 +
      shooterEntity.profile.skills.shooting * 0.0045 +
      (state.config.environment.scoringEnvironment - 50) * 0.001,
    0.55,
    0.95
  )
  let makes = 0
  const random = state.random.fork(scope)
  for (let index = 0; index < attempts; index += 1) {
    if (random.next() < makeRate) makes += 1
  }
  return makes
}

function maybeCreateInjury(
  state: SimulationState,
  teamId: string,
  period: number,
  possession: number
): void {
  const frequency = state.config.injuries.frequency
  const probability =
    frequency === "off"
      ? 0
      : frequency === "rare"
        ? 0.00045
        : frequency === "normal"
          ? 0.001
          : 0.0018
  if (
    !state.config.injuries.inGameInjuries ||
    state.random.next() >= probability
  ) {
    return
  }

  const runtime = getTeamRuntime(state, teamId)
  const availableBench = getRotationCandidates(state, teamId).filter(
    (playerId) => !runtime.currentLineup.includes(playerId)
  )
  if (availableBench.length === 0) {
    return
  }

  const playerId = choosePlayer(
    state,
    teamId,
    `injury:${teamId}:${period}:${possession}`,
    (player) => 110 - player.profile.injuryResistance
  )
  if (!playerId) return

  const player = state.fixture.players[playerId]!
  const gamesRemaining = Math.max(
    1,
    state.random.int(
      1,
      Math.max(1, Math.round(state.config.injuries.maxGamesOut))
    )
  )
  const availability = state.availability[playerId]!
  availability.available = false
  availability.gamesRemaining = gamesRemaining
  state.events.push({
    id: `injury:${state.events.length + 1}`,
    type: "injury",
    teamId,
    playerId,
    period,
    description: `${formatPlayerIdentity(player.identity) ?? playerId} left with a ${state.config.injuries.severity === "mixed" ? "game injury" : "minor injury"}.`,
    gamesRemaining,
  })
  state.diagnostics.push({
    code: "game-injury",
    message: `${formatPlayerIdentity(player.identity) ?? playerId} is unavailable for ${gamesRemaining} future game(s).`,
    severity: "info",
    scope: "injury",
    path: ["events", state.events.length - 1],
  })
}

function getHelpDefenseQuality(
  state: SimulationState,
  defenseTeamId: string,
  primaryDefenderId: string
): number {
  const lineup = getTeamRuntime(state, defenseTeamId).currentLineup.filter(
    (playerId) => playerId !== primaryDefenderId
  )
  if (lineup.length === 0) return 50
  return Math.max(
    ...lineup.map((playerId) => {
      const player = state.fixture.players[playerId]!
      return (
        player.profile.skills.defense * 0.55 +
        player.profile.skills.basketballIQ * 0.2 +
        player.profile.physical.vertical * 0.1 +
        player.profile.physical.wingspanInches * 0.15
      )
    })
  )
}

function getMatchupPressure(
  state: SimulationState,
  offensePlayer: PlayerEntity,
  defensePlayer: PlayerEntity,
  defenseTeamId: string,
  shot: "rim" | "midrange" | "three",
  doubleTeamActive: boolean
): number {
  const defenseConfig = state.config.defense
  const defenseCoach = getEffectiveCoachProfile(
    state.fixture.coaching[defenseTeamId]!,
    state.config
  )
  const defenderFatigue = getPlayerFatigue(
    state,
    defenseTeamId,
    defensePlayer.id
  )
  const helpQuality = getHelpDefenseQuality(
    state,
    defenseTeamId,
    defensePlayer.id
  )
  const fit = getDefenderFit(
    offensePlayer,
    defensePlayer,
    defenseConfig.switching
  )
  const matchupContribution = clamp((fit - 50) * 0.0003, -0.01, 0.01)
  const helpContribution =
    shot === "rim" ? helpQuality * 0.00018 : helpQuality * 0.00006
  const schemeContribution =
    defenseConfig.helpDefense * (shot === "rim" ? 0.00012 : 0.00004) +
    defenseCoach.defensivePressure * 0.00008
  const doubleTeamContribution = doubleTeamActive ? 0.012 : 0
  return clamp(
    0.018 +
      defensePlayer.profile.skills.defense * 0.00038 +
      defensePlayer.profile.skills.basketballIQ * 0.00008 +
      helpContribution +
      schemeContribution +
      matchupContribution +
      doubleTeamContribution -
      defenderFatigue * 0.018,
    0.01,
    0.13
  )
}

function choosePlayerExcluding(
  state: SimulationState,
  teamId: string,
  scope: string,
  excluded: Set<string>,
  preference: (player: PlayerEntity) => number
): string {
  const runtime = getTeamRuntime(state, teamId)
  const entries = runtime.currentLineup
    .filter(
      (playerId) =>
        !excluded.has(playerId) && playerCanPlay(state, playerId, teamId)
    )
    .map((playerId) => ({
      id: playerId,
      weight: Math.max(1, preference(state.fixture.players[playerId]!)),
    }))
  return weightedChoice(state.random.fork(scope), entries)
}

function getLineupReboundingQuality(
  state: SimulationState,
  teamId: string
): number {
  const lineup = getTeamRuntime(state, teamId).currentLineup
  if (lineup.length === 0) return 50
  return (
    sum(
      lineup.map((playerId) => {
        const player = state.fixture.players[playerId]!
        return (
          player.profile.skills.rebounding * 0.58 +
          player.profile.physical.strength * 0.2 +
          player.profile.physical.vertical * 0.08 +
          player.profile.physical.heightInches * 0.14
        )
      })
    ) / lineup.length
  )
}

function resolveRebound(
  state: SimulationState,
  offenseTeamId: string,
  defenseTeamId: string,
  period: number,
  possession: number,
  shotIndex: number,
  allowOffensiveRebound: boolean
): ReboundOutcome {
  const offenseQuality = getLineupReboundingQuality(state, offenseTeamId)
  const defenseQuality = getLineupReboundingQuality(state, defenseTeamId)
  const offensiveReboundChance = allowOffensiveRebound
    ? clamp(
        0.197 +
          state.config.offense.offensiveRebounding * 0.0007 +
          (offenseQuality - 50) * 0.0012 -
          (defenseQuality - 50) * 0.00065,
        0.07,
        0.3
      )
    : 0
  const offensive =
    state.random
      .fork(
        `rebound-type:${offenseTeamId}:${period}:${possession}:${shotIndex}`
      )
      .next() < offensiveReboundChance
  const teamId = offensive ? offenseTeamId : defenseTeamId
  const rebounderId = choosePlayer(
    state,
    teamId,
    `rebounder:${teamId}:${period}:${possession}:${shotIndex}`,
    (player) =>
      player.profile.skills.rebounding * 0.7 +
      player.profile.physical.strength * 0.18 +
      player.profile.physical.heightInches * 0.12
  )
  return {
    teamId,
    playerId: rebounderId,
    kind: offensive ? "offensive" : "defensive",
  }
}

function resolveShot(
  state: SimulationState,
  offenseTeamId: string,
  defenseTeamId: string,
  offensePlayer: PlayerEntity,
  defensePlayer: PlayerEntity,
  period: number,
  possession: number,
  shotIndex: number,
  secondChance: boolean,
  allowOffensiveRebound: boolean
): ShotOutcome {
  const shot = attemptType(
    state,
    offensePlayer,
    offenseTeamId,
    period,
    possession * 10 + shotIndex
  )
  const shootingSkill = offensePlayer.profile.skills.shooting
  const finishingSkill = offensePlayer.profile.skills.finishing
  const defensePressure = getMatchupPressure(
    state,
    offensePlayer,
    defensePlayer,
    defenseTeamId,
    shot,
    false
  )
  const config = state.config
  const scoringEnvironment =
    (config.environment.scoringEnvironment - 50) * 0.0011
  const talentSeparation = 0.7 + config.environment.talentSeparation / 300
  const talentAbilityBonus =
    Math.max(0, getPlayerCurrentAbility(offensePlayer) - 50) *
    0.0009 *
    talentSeparation
  const variance = config.environment.gameVariance / 100
  const homeEfficiencyBonus =
    offenseTeamId === state.fixture.homeTeamId
      ? (config.environment.homeCourtAdvantage - 50) * 0.00035
      : 0
  const shotQuality =
    shot === "three"
      ? offensePlayer.profile.skills.shooting * 0.82 +
        offensePlayer.profile.skills.basketballIQ * 0.08 +
        getLineupSpacing(state, offenseTeamId, offensePlayer.id) * 0.1
      : shot === "rim"
        ? offensePlayer.profile.skills.finishing * 0.55 +
          offensePlayer.profile.skills.handling * 0.2 +
          offensePlayer.profile.physical.speed * 0.1 +
          offensePlayer.profile.physical.vertical * 0.08 +
          getLineupSpacing(state, offenseTeamId, offensePlayer.id) * 0.07
        : offensePlayer.profile.skills.shooting * 0.52 +
          offensePlayer.profile.skills.basketballIQ * 0.28 +
          offensePlayer.profile.skills.handling * 0.1 +
          getLineupSpacing(state, offenseTeamId, offensePlayer.id) * 0.1
  const disciplineQualityBonus =
    ((config.offense.shotSelectionDiscipline - 50) / 50) *
    (shotQuality - 50) *
    0.00045
  const fatiguePenalty =
    getPlayerFatigue(state, offenseTeamId, offensePlayer.id) *
    (0.012 + config.rotation.fatigueImpact * 0.00012)
  const randomNoise = state.random.normal(0, 0.025 * variance)
  const skill = shot === "rim" ? finishingSkill : shootingSkill
  const baseRate = shot === "three" ? 0.4 : shot === "rim" ? 0.6 : 0.51
  const makeRate = clamp(
    baseRate +
      (skill - 50) * 0.0018 * talentSeparation +
      talentAbilityBonus +
      scoringEnvironment +
      homeEfficiencyBonus +
      disciplineQualityBonus -
      fatiguePenalty -
      defensePressure +
      randomNoise,
    shot === "three" ? 0.22 : shot === "rim" ? 0.36 : 0.28,
    shot === "three" ? 0.55 : shot === "rim" ? 0.8 : 0.64
  )

  const made =
    state.random
      .fork(`shot-make:${offenseTeamId}:${period}:${possession}:${shotIndex}`)
      .next() < makeRate
  const outcome: ShotOutcome = {
    shooterId: offensePlayer.id,
    type: shot,
    made,
    blockedById: null,
    rebound: null,
    assistPlayerId: null,
    secondChance,
  }

  if (made) {
    const assistChance = clamp(
      0.38 +
        config.offense.ballMovement * 0.0045 -
        config.offense.isolationRate * 0.0022 +
        offensePlayer.profile.skills.passing * 0.0015 +
        offensePlayer.profile.skills.basketballIQ * 0.0008,
      0.18,
      0.78
    )
    const assistRandom = state.random.fork(
      `assist-check:${offenseTeamId}:${period}:${possession}:${shotIndex}`
    )
    if (assistRandom.next() < assistChance) {
      const passerId = choosePlayerExcluding(
        state,
        offenseTeamId,
        `assist-player:${offenseTeamId}:${period}:${possession}:${shotIndex}`,
        new Set([offensePlayer.id]),
        (player) =>
          player.profile.skills.passing * 0.62 +
          player.profile.skills.basketballIQ * 0.28 +
          player.profile.skills.handling * 0.1
      )
      if (passerId) outcome.assistPlayerId = passerId
    }
    return outcome
  }

  const helpQuality = getHelpDefenseQuality(
    state,
    defenseTeamId,
    defensePlayer.id
  )
  const blockChance = clamp(
    shot === "rim"
      ? 0.065 +
          config.defense.helpDefense * 0.00065 +
          helpQuality * 0.00035 +
          defensePlayer.profile.skills.defense * 0.00045 +
          defensePlayer.profile.physical.vertical * 0.00025
      : 0.012 + defensePlayer.profile.skills.defense * 0.00016,
    0.005,
    shot === "rim" ? 0.2 : 0.06
  )
  const blocked =
    state.random
      .fork(`block-check:${offenseTeamId}:${period}:${possession}:${shotIndex}`)
      .next() < blockChance
  if (blocked) {
    outcome.blockedById = choosePlayer(
      state,
      defenseTeamId,
      `block-player:${defenseTeamId}:${period}:${possession}:${shotIndex}`,
      (player) =>
        player.profile.skills.defense * 0.5 +
        player.profile.physical.vertical * 0.3 +
        player.profile.physical.wingspanInches * 0.2
    )
  }
  outcome.rebound = resolveRebound(
    state,
    offenseTeamId,
    defenseTeamId,
    period,
    possession,
    shotIndex,
    allowOffensiveRebound
  )
  return outcome
}

function getFoulRate(
  state: SimulationState,
  offenseTeamId: string,
  defenseTeamId: string,
  defensePlayerId: string,
  shot: "rim" | "midrange" | "three",
  coachDefenseModifier: number
): number {
  const defensePlayer = state.fixture.players[defensePlayerId]!
  return clamp(
    0.155 +
      state.config.defense.pressure * 0.00024 -
      state.config.defense.foulDiscipline * 0.00016 +
      coachDefenseModifier * 0.01 +
      getPlayerFatigue(state, defenseTeamId, defensePlayerId) * 0.03 +
      (shot === "rim" ? 0.018 : shot === "midrange" ? 0.006 : -0.004) +
      (50 - defensePlayer.profile.skills.defense) * 0.0001 +
      (offenseTeamId === state.fixture.homeTeamId ? 0.002 : 0),
    0.08,
    0.24
  )
}

function resolvePossession(
  state: SimulationState,
  offenseTeamId: string,
  defenseTeamId: string,
  period: number,
  possession: number
): PossessionOutcome {
  const offensePlayerId = chooseOffensivePlayer(
    state,
    offenseTeamId,
    period,
    possession
  )
  const offensePlayer = state.fixture.players[offensePlayerId]!
  const defensePlayerId = chooseDefender(
    state,
    offensePlayer,
    defenseTeamId,
    `defender:${defenseTeamId}:${period}:${possession}`
  )
  const defensePlayer = state.fixture.players[defensePlayerId]!
  const config = state.config
  const defenseCoach = getEffectiveCoachProfile(
    state.fixture.coaching[defenseTeamId]!,
    config
  )
  const coachDefenseModifier =
    ((defenseCoach.defensivePressure - 50) / 50) *
    (config.coaching.defensiveInfluence / 100)
  const creatorFactor = clamp(
    (getPlayerCurrentAbility(offensePlayer) - 55) / 45,
    0,
    1
  )
  const doubleTeamChance = clamp(
    (config.defense.doubleTeamRate / 100) * (0.04 + creatorFactor * 0.28),
    0,
    0.4
  )
  const doubleTeamActive =
    state.random
      .fork("double-team:" + offenseTeamId + ":" + period + ":" + possession)
      .next() < doubleTeamChance

  const turnoverRate = clamp(
    0.137 +
      config.defense.turnoverPressure * 0.00035 +
      config.defense.pressure * 0.0002 -
      offensePlayer.profile.skills.handling * 0.00055 -
      offensePlayer.profile.skills.basketballIQ * 0.0002,
    0.055,
    0.22
  )
  const adjustedTurnoverRate = clamp(
    turnoverRate +
      coachDefenseModifier * 0.022 +
      (doubleTeamActive ? 0.025 + creatorFactor * 0.025 : 0) +
      getPlayerFatigue(state, offenseTeamId, offensePlayerId) * 0.04,
    0.055,
    0.22
  )

  const shot = attemptType(
    state,
    offensePlayer,
    offenseTeamId,
    period,
    possession
  )
  const baseOutcome: PossessionOutcome = {
    id: `possession:${period}:${offenseTeamId}:${possession}`,
    period,
    possession,
    offenseTeamId,
    defenseTeamId,
    offenseLineupIds: [...getTeamRuntime(state, offenseTeamId).currentLineup],
    defenseLineupIds: [...getTeamRuntime(state, defenseTeamId).currentLineup],
    opportunityPlayerId: offensePlayerId,
    terminal: "field-goal",
    shots: [],
    freeThrows: [],
    fouls: [],
    stealPlayerId: null,
    points: 0,
    continuationCount: 0,
  }

  const turnoverRandom = state.random.fork(
    `turnover-check:${offenseTeamId}:${period}:${possession}`
  )
  if (turnoverRandom.next() < adjustedTurnoverRate) {
    baseOutcome.terminal = "turnover"
    if (
      state.random
        .fork(`steal-check:${defenseTeamId}:${period}:${possession}`)
        .next() < 0.72
    ) {
      baseOutcome.stealPlayerId = choosePlayer(
        state,
        defenseTeamId,
        `steal-player:${defenseTeamId}:${period}:${possession}`,
        (player) =>
          player.profile.skills.defense * 0.55 +
          player.profile.skills.basketballIQ * 0.25 +
          player.profile.skills.handling * 0.2
      )
    }
    return baseOutcome
  }

  const foulRate = getFoulRate(
    state,
    offenseTeamId,
    defenseTeamId,
    defensePlayerId,
    shot,
    coachDefenseModifier
  )
  const foulRandom = state.random.fork(
    `foul-check:${offenseTeamId}:${period}:${possession}`
  )
  if (foulRandom.next() < foulRate) {
    const shootingFoulChance = clamp(
      0.48 +
        (shot === "rim" ? 0.2 : shot === "midrange" ? 0.06 : -0.06) +
        offensePlayer.profile.skills.finishing * 0.0008 +
        (50 - config.defense.foulDiscipline) * 0.001,
      0.24,
      0.82
    )
    const shootingFoul =
      state.random
        .fork(`foul-type:${offenseTeamId}:${period}:${possession}`)
        .next() < shootingFoulChance
    const foulType: FoulType = shootingFoul ? "shooting" : "non-shooting"
    baseOutcome.terminal = shootingFoul ? "shooting-foul" : "non-shooting-foul"
    baseOutcome.fouls.push({
      playerId: defensePlayerId,
      teamId: defenseTeamId,
      type: foulType,
    })
    if (shootingFoul) {
      const freeThrowAttempts =
        state.random
          .fork(`free-throw-count:${offenseTeamId}:${period}:${possession}`)
          .next() < 0.12
          ? 3
          : 2
      baseOutcome.freeThrows.push({
        shooterId: offensePlayerId,
        attempts: freeThrowAttempts,
        made: resolveFreeThrows(
          state,
          offensePlayer,
          freeThrowAttempts,
          `free-throws:${offenseTeamId}:${period}:${possession}`
        ),
      })
    }
    baseOutcome.points = sum(
      baseOutcome.freeThrows.map((freeThrow) => freeThrow.made)
    )
    return baseOutcome
  }

  const firstShot = resolveShot(
    state,
    offenseTeamId,
    defenseTeamId,
    offensePlayer,
    defensePlayer,
    period,
    possession,
    0,
    false,
    true
  )
  baseOutcome.shots.push(firstShot)
  const maxContinuations = 1
  while (true) {
    const currentShot = baseOutcome.shots.at(-1)!
    if (currentShot.made) {
      baseOutcome.terminal = "field-goal"
      break
    }
    if (
      !currentShot.rebound ||
      currentShot.rebound.kind !== "offensive" ||
      baseOutcome.continuationCount >= maxContinuations
    ) {
      baseOutcome.terminal = "defensive-rebound"
      break
    }

    baseOutcome.continuationCount += 1
    const continuationPlayerId = chooseOffensivePlayer(
      state,
      offenseTeamId,
      period,
      possession * 10 + baseOutcome.continuationCount
    )
    const continuationPlayer = state.fixture.players[continuationPlayerId]!
    const continuationDefenderId = chooseDefender(
      state,
      continuationPlayer,
      defenseTeamId,
      `continuation-defender:${defenseTeamId}:${period}:${possession}:${baseOutcome.continuationCount}`
    )
    const continuationDefender = state.fixture.players[continuationDefenderId]!
    baseOutcome.shots.push(
      resolveShot(
        state,
        offenseTeamId,
        defenseTeamId,
        continuationPlayer,
        continuationDefender,
        period,
        possession,
        baseOutcome.continuationCount,
        true,
        baseOutcome.continuationCount < maxContinuations
      )
    )
  }

  baseOutcome.points =
    sum(
      baseOutcome.shots.map((shotOutcome) =>
        shotOutcome.made ? (shotOutcome.type === "three" ? 3 : 2) : 0
      )
    ) + sum(baseOutcome.freeThrows.map((freeThrow) => freeThrow.made))
  return baseOutcome
}

function applyPossessionOutcome(
  state: SimulationState,
  outcome: PossessionOutcome,
  periodPoints: Record<string, number>
): void {
  const offenseTeam = state.teams[outcome.offenseTeamId]!
  const defenseTeam = state.teams[outcome.defenseTeamId]!
  const offenseStats = state.players[outcome.opportunityPlayerId]!
  offenseTeam.possessions += 1
  offenseStats.opportunities += 1

  if (outcome.terminal === "turnover") {
    offenseStats.turnovers += 1
    offenseTeam.turnovers += 1
  }
  if (outcome.stealPlayerId) {
    const stealStats = state.players[outcome.stealPlayerId]!
    stealStats.steals += 1
    defenseTeam.steals += 1
  }

  for (const foul of outcome.fouls) {
    const foulStats = state.players[foul.playerId]!
    foulStats.fouls += 1
    state.teams[foul.teamId]!.fouls += 1
    const runtime = getTeamRuntime(state, foul.teamId)
    runtime.fouls[foul.playerId] = (runtime.fouls[foul.playerId] ?? 0) + 1
  }

  for (const shot of outcome.shots) {
    const shooterStats = state.players[shot.shooterId]!
    shooterStats.fieldGoalsAttempted += 1
    offenseTeam.fieldGoalsAttempted += 1
    shooterStats.shotProfile[
      shot.type === "three"
        ? "threePointAttempts"
        : shot.type === "rim"
          ? "rimAttempts"
          : "midrangeAttempts"
    ] += 1
    offenseTeam.shotProfile[
      shot.type === "three"
        ? "threePointAttempts"
        : shot.type === "rim"
          ? "rimAttempts"
          : "midrangeAttempts"
    ] += 1
    if (shot.type === "three") {
      shooterStats.threePointersAttempted += 1
      offenseTeam.threePointersAttempted += 1
    }
    if (shot.made) {
      const points = shot.type === "three" ? 3 : 2
      shooterStats.fieldGoalsMade += 1
      shooterStats.points += points
      offenseTeam.fieldGoalsMade += 1
      offenseTeam.points += points
      periodPoints[outcome.offenseTeamId] =
        (periodPoints[outcome.offenseTeamId] ?? 0) + points
      if (shot.type === "three") {
        shooterStats.threePointersMade += 1
        offenseTeam.threePointersMade += 1
      }
      if (shot.assistPlayerId) {
        state.players[shot.assistPlayerId]!.assists += 1
        offenseTeam.assists += 1
      }
    }
    if (shot.blockedById) {
      state.players[shot.blockedById]!.blocks += 1
      defenseTeam.blocks += 1
    }
    if (shot.rebound) {
      const reboundStats = state.players[shot.rebound.playerId]!
      reboundStats.rebounds += 1
      const reboundTeam = state.teams[shot.rebound.teamId]!
      reboundTeam.rebounds += 1
      if (shot.rebound.kind === "offensive") {
        reboundStats.offensiveRebounds += 1
        reboundTeam.offensiveRebounds += 1
      } else {
        reboundStats.defensiveRebounds += 1
        reboundTeam.defensiveRebounds += 1
      }
    }
  }

  for (const freeThrow of outcome.freeThrows) {
    const shooterStats = state.players[freeThrow.shooterId]!
    shooterStats.freeThrowsAttempted += freeThrow.attempts
    shooterStats.freeThrowsMade += freeThrow.made
    shooterStats.points += freeThrow.made
    offenseTeam.freeThrowsAttempted += freeThrow.attempts
    offenseTeam.freeThrowsMade += freeThrow.made
    offenseTeam.points += freeThrow.made
  }
  periodPoints[outcome.offenseTeamId] =
    (periodPoints[outcome.offenseTeamId] ?? 0) +
    sum(outcome.freeThrows.map((freeThrow) => freeThrow.made))
  state.ledger.entries.push(outcome)
}

function getPeriodPossessions(
  state: SimulationState,
  teamId: string,
  period: number,
  periodMinutes: number,
  overtime: boolean
): number {
  const { config, fixture } = state
  if (overtime) {
    return Math.max(
      2,
      Math.round(
        state.random
          .fork(`overtime:${period}:${teamId}`)
          .normal(10 * (periodMinutes / 5), 1.2)
      )
    )
  }
  const coach = getEffectiveCoachProfile(fixture.coaching[teamId]!, config)
  const homeBonus =
    teamId === fixture.homeTeamId
      ? (config.environment.homeCourtAdvantage - 50) * 0.04
      : 0
  const paceValue =
    94 +
    config.environment.pace * 0.12 +
    (coach.pace - 50) * (config.coaching.paceInfluence / 500) +
    homeBonus
  return Math.max(
    16,
    Math.round(
      state.random
        .fork(`possessions:${teamId}:${period}`)
        .normal(
          (paceValue * periodMinutes) / REGULATION_MINUTES,
          1.5 + config.environment.gameVariance * 0.01
        )
    )
  )
}

function simulatePeriod(
  state: SimulationState,
  period: number,
  kind: GamePeriodResult["kind"],
  periodMinutes: number
): void {
  const { fixture } = state
  const teamIds = [fixture.homeTeamId, fixture.awayTeamId]
  const teamPoints: Record<string, number> = Object.fromEntries(
    teamIds.map((teamId) => [teamId, 0])
  )
  const teamPossessions: Record<string, number> = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      getPeriodPossessions(
        state,
        teamId,
        period,
        periodMinutes,
        kind === "overtime"
      ),
    ])
  )

  for (const teamId of teamIds) {
    ensureLineup(
      state,
      teamId,
      period,
      0,
      periodMinutes,
      kind === "overtime" ? "overtime" : "period-start"
    )
  }

  const maxPossessions = Math.max(...Object.values(teamPossessions))
  for (let possession = 1; possession <= maxPossessions; possession += 1) {
    for (const offenseTeamId of teamIds) {
      const teamPossession = teamPossessions[offenseTeamId]
      if (possession > teamPossession) continue
      const defenseTeamId =
        offenseTeamId === fixture.homeTeamId
          ? fixture.awayTeamId
          : fixture.homeTeamId
      const minute = ((possession - 0.5) / teamPossession) * periodMinutes
      ensureLineup(
        state,
        offenseTeamId,
        period,
        minute,
        periodMinutes,
        kind === "overtime" ? "overtime" : "checkpoint"
      )
      ensureLineup(
        state,
        defenseTeamId,
        period,
        minute,
        periodMinutes,
        kind === "overtime" ? "overtime" : "checkpoint"
      )
      const outcome = resolvePossession(
        state,
        offenseTeamId,
        defenseTeamId,
        period,
        possession
      )
      applyPossessionOutcome(state, outcome, teamPoints)
      maybeCreateInjury(state, offenseTeamId, period, possession)
    }
  }

  for (const teamId of teamIds) {
    finishTeamPeriod(state, teamId, period, periodMinutes)
  }
  state.periods.push({
    number: period,
    kind,
    minutes: periodMinutes,
    teamPoints,
    teamPossessions,
  })
}

function createPeriods(state: SimulationState): void {
  for (let period = 1; period <= REGULATION_PERIODS; period += 1) {
    simulatePeriod(state, period, "regulation", 12)
  }
}

function createOvertimePeriods(state: SimulationState): void {
  if (!state.config.overtime.enabled) return
  const { fixture, config } = state
  let overtimeNumber = 0
  while (true) {
    const homePoints = sum(
      state.periods.map((period) => period.teamPoints[fixture.homeTeamId] ?? 0)
    )
    const awayPoints = sum(
      state.periods.map((period) => period.teamPoints[fixture.awayTeamId] ?? 0)
    )
    if (homePoints !== awayPoints) return
    overtimeNumber += 1
    simulatePeriod(
      state,
      REGULATION_PERIODS + overtimeNumber,
      "overtime",
      config.overtime.segmentMinutes
    )
    if (overtimeNumber >= config.overtime.maxSegments) {
      state.diagnostics.push({
        code: "overtime-extended",
        message:
          "The game required more overtime than the configured soft limit.",
        severity: "warning",
        scope: "possession",
      })
    }
  }
}

function finalizeMinutes(state: SimulationState): void {
  for (const teamId of [state.fixture.homeTeamId, state.fixture.awayTeamId]) {
    const plan = state.rotations[teamId]!
    const runtime = getTeamRuntime(state, teamId)
    for (const playerId of plan.playerIds) {
      const stats = state.players[playerId]
      if (!stats) continue
      stats.minutes = round(runtime.minutes[playerId] ?? 0, 1)
      stats.usageRate =
        stats.minutes > 0
          ? round(
              (stats.opportunities /
                Math.max(1, state.teams[teamId]!.possessions)) *
                100,
              1
            )
          : 0
    }
  }
}

type LedgerPlayerTotals = {
  playerId: string
  teamId: string
  opportunities: number
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
}

type LedgerTeamTotals = MutableTeamStats & {
  possessions: number
  shootingFouls: number
  nonShootingFouls: number
  secondChanceAttempts: number
  secondChancePoints: number
  offensiveReboundContinuations: number
}

type LedgerAggregate = {
  teams: Record<string, LedgerTeamTotals>
  players: Record<string, LedgerPlayerTotals>
  periodPoints: Record<number, Record<string, number>>
  periodPossessions: Record<number, Record<string, number>>
  invariantViolations: number
}

function emptyLedgerPlayerTotals(
  playerId: string,
  teamId: string
): LedgerPlayerTotals {
  return {
    playerId,
    teamId,
    opportunities: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    shotProfile: {
      rimAttempts: 0,
      midrangeAttempts: 0,
      threePointAttempts: 0,
    },
  }
}

function emptyLedgerTeamTotals(teamId: string): LedgerTeamTotals {
  return {
    ...emptyTeamStats(teamId),
    possessions: 0,
    shootingFouls: 0,
    nonShootingFouls: 0,
    secondChanceAttempts: 0,
    secondChancePoints: 0,
    offensiveReboundContinuations: 0,
  }
}

function aggregateLedger(state: SimulationState): LedgerAggregate {
  const teamIds = [state.fixture.homeTeamId, state.fixture.awayTeamId]
  const teams = Object.fromEntries(
    teamIds.map((teamId) => [teamId, emptyLedgerTeamTotals(teamId)])
  ) as Record<string, LedgerTeamTotals>
  const players = Object.fromEntries(
    Object.values(state.players).map((player) => [
      player.playerId,
      emptyLedgerPlayerTotals(player.playerId, player.teamId),
    ])
  ) as Record<string, LedgerPlayerTotals>
  const periodPoints: Record<number, Record<string, number>> = {}
  const periodPossessions: Record<number, Record<string, number>> = {}
  let invariantViolations = 0

  for (const outcome of state.ledger.entries) {
    const offenseTeam = teams[outcome.offenseTeamId]
    const defenseTeam = teams[outcome.defenseTeamId]
    const opportunityPlayer = players[outcome.opportunityPlayerId]
    if (!offenseTeam || !defenseTeam || !opportunityPlayer) {
      invariantViolations += 1
      continue
    }
    offenseTeam.possessions += 1
    opportunityPlayer.opportunities += 1
    periodPoints[outcome.period] ??= {}
    periodPossessions[outcome.period] ??= {}
    periodPossessions[outcome.period]![outcome.offenseTeamId] =
      (periodPossessions[outcome.period]![outcome.offenseTeamId] ?? 0) + 1

    if (!outcome.offenseLineupIds.includes(outcome.opportunityPlayerId)) {
      invariantViolations += 1
    }
    if (outcome.terminal === "turnover") {
      offenseTeam.turnovers += 1
      opportunityPlayer.turnovers += 1
    }
    if (outcome.stealPlayerId) {
      const stealPlayer = players[outcome.stealPlayerId]
      if (
        !stealPlayer ||
        !outcome.defenseLineupIds.includes(outcome.stealPlayerId)
      ) {
        invariantViolations += 1
      } else {
        defenseTeam.steals += 1
        stealPlayer.steals += 1
      }
    }

    for (const foul of outcome.fouls) {
      const foulPlayer = players[foul.playerId]
      if (
        !foulPlayer ||
        foul.teamId !== outcome.defenseTeamId ||
        !outcome.defenseLineupIds.includes(foul.playerId)
      ) {
        invariantViolations += 1
      } else {
        defenseTeam.fouls += 1
        foulPlayer.fouls += 1
        if (foul.type === "shooting") defenseTeam.shootingFouls += 1
        else defenseTeam.nonShootingFouls += 1
      }
    }

    let priorOffensiveRebound = false
    for (const shot of outcome.shots) {
      const shooter = players[shot.shooterId]
      if (!shooter || !outcome.offenseLineupIds.includes(shot.shooterId)) {
        invariantViolations += 1
        continue
      }
      if (shot.secondChance !== priorOffensiveRebound) {
        invariantViolations += 1
      }
      if (shot.secondChance) {
        offenseTeam.secondChanceAttempts += 1
        offenseTeam.offensiveReboundContinuations += 1
      }
      shooter.fieldGoalsAttempted += 1
      offenseTeam.fieldGoalsAttempted += 1
      shooter.shotProfile[
        shot.type === "three"
          ? "threePointAttempts"
          : shot.type === "rim"
            ? "rimAttempts"
            : "midrangeAttempts"
      ] += 1
      offenseTeam.shotProfile[
        shot.type === "three"
          ? "threePointAttempts"
          : shot.type === "rim"
            ? "rimAttempts"
            : "midrangeAttempts"
      ] += 1
      if (shot.type === "three") {
        shooter.threePointersAttempted += 1
        offenseTeam.threePointersAttempted += 1
      }
      if (shot.made) {
        const points = shot.type === "three" ? 3 : 2
        shooter.fieldGoalsMade += 1
        shooter.points += points
        offenseTeam.fieldGoalsMade += 1
        offenseTeam.points += points
        periodPoints[outcome.period]![outcome.offenseTeamId] =
          (periodPoints[outcome.period]![outcome.offenseTeamId] ?? 0) + points
        if (shot.secondChance) offenseTeam.secondChancePoints += points
        if (shot.type === "three") {
          shooter.threePointersMade += 1
          offenseTeam.threePointersMade += 1
        }
        if (shot.assistPlayerId) {
          const passer = players[shot.assistPlayerId]
          if (
            !passer ||
            passer.teamId !== outcome.offenseTeamId ||
            passer.playerId === shot.shooterId ||
            !outcome.offenseLineupIds.includes(passer.playerId)
          ) {
            invariantViolations += 1
          } else {
            passer.assists += 1
            offenseTeam.assists += 1
          }
        }
      } else if (shot.assistPlayerId) {
        invariantViolations += 1
      }
      if (shot.blockedById) {
        const blocker = players[shot.blockedById]
        if (
          shot.made ||
          !blocker ||
          blocker.teamId !== outcome.defenseTeamId ||
          !outcome.defenseLineupIds.includes(blocker.playerId)
        ) {
          invariantViolations += 1
        } else {
          blocker.blocks += 1
          defenseTeam.blocks += 1
        }
      }
      if (shot.made && shot.rebound) invariantViolations += 1
      if (!shot.made && !shot.rebound) invariantViolations += 1
      if (shot.rebound) {
        const rebounder = players[shot.rebound.playerId]
        if (
          !rebounder ||
          rebounder.teamId !== shot.rebound.teamId ||
          !(
            shot.rebound.teamId === outcome.offenseTeamId
              ? outcome.offenseLineupIds
              : outcome.defenseLineupIds
          ).includes(rebounder.playerId)
        ) {
          invariantViolations += 1
        } else {
          rebounder.rebounds += 1
          teams[shot.rebound.teamId]!.rebounds += 1
          if (shot.rebound.kind === "offensive") {
            rebounder.offensiveRebounds += 1
            teams[shot.rebound.teamId]!.offensiveRebounds += 1
            priorOffensiveRebound = true
          } else {
            rebounder.defensiveRebounds += 1
            teams[shot.rebound.teamId]!.defensiveRebounds += 1
            priorOffensiveRebound = false
          }
        }
      } else {
        priorOffensiveRebound = false
      }
    }

    for (const freeThrow of outcome.freeThrows) {
      const shooter = players[freeThrow.shooterId]
      if (
        !shooter ||
        shooter.teamId !== outcome.offenseTeamId ||
        freeThrow.made > freeThrow.attempts ||
        freeThrow.attempts <= 0
      ) {
        invariantViolations += 1
        continue
      }
      shooter.freeThrowsAttempted += freeThrow.attempts
      shooter.freeThrowsMade += freeThrow.made
      shooter.points += freeThrow.made
      offenseTeam.freeThrowsAttempted += freeThrow.attempts
      offenseTeam.freeThrowsMade += freeThrow.made
      offenseTeam.points += freeThrow.made
      periodPoints[outcome.period]![outcome.offenseTeamId] =
        (periodPoints[outcome.period]![outcome.offenseTeamId] ?? 0) +
        freeThrow.made
    }
    if (
      outcome.fouls.some((foul) => foul.type === "shooting") &&
      outcome.freeThrows.length === 0
    ) {
      invariantViolations += 1
    }
    if (
      outcome.fouls.every((foul) => foul.type !== "shooting") &&
      outcome.freeThrows.length > 0
    ) {
      invariantViolations += 1
    }
  }

  return {
    teams,
    players,
    periodPoints,
    periodPossessions,
    invariantViolations,
  }
}

function buildTelemetry(state: SimulationState): GameSimulationTelemetry {
  const byTeam = Object.fromEntries(
    [state.fixture.homeTeamId, state.fixture.awayTeamId].map((teamId) => [
      teamId,
      {
        possessions: 0,
        shootingFouls: 0,
        nonShootingFouls: 0,
        secondChanceAttempts: 0,
        secondChancePoints: 0,
        offensiveReboundContinuations: 0,
      },
    ])
  ) as Record<string, GameTeamSimulationTelemetry>
  for (const outcome of state.ledger.entries) {
    byTeam[outcome.offenseTeamId]!.possessions += 1
    for (const foul of outcome.fouls) {
      byTeam[foul.teamId]![
        foul.type === "shooting" ? "shootingFouls" : "nonShootingFouls"
      ] += 1
    }
    for (const shot of outcome.shots) {
      if (shot.secondChance) {
        byTeam[outcome.offenseTeamId]!.secondChanceAttempts += 1
        byTeam[outcome.offenseTeamId]!.offensiveReboundContinuations += 1
        if (shot.made) {
          byTeam[outcome.offenseTeamId]!.secondChancePoints +=
            shot.type === "three" ? 3 : 2
        }
      }
    }
  }
  return {
    totalPossessions: state.ledger.entries.length,
    byTeam,
  }
}

function buildResult(state: SimulationState): GameResult {
  const teams = Object.fromEntries(
    Object.entries(state.teams).map(([teamId, team]) => [
      teamId,
      buildTeamBoxScore(team, state.periods),
    ])
  ) as Record<string, GameTeamBoxScore>
  const players = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        availability: state.availability[playerId]!,
      },
    ])
  ) as Record<string, GamePlayerBoxScore>
  const homePoints = teams[state.fixture.homeTeamId]?.points ?? 0
  const awayPoints = teams[state.fixture.awayTeamId]?.points ?? 0
  return {
    version: GAME_SIMULATION_VERSION,
    seed: state.fixture.seed,
    status: "completed",
    homeTeamId: state.fixture.homeTeamId,
    awayTeamId: state.fixture.awayTeamId,
    winnerTeamId:
      homePoints === awayPoints
        ? null
        : homePoints > awayPoints
          ? state.fixture.homeTeamId
          : state.fixture.awayTeamId,
    periods: state.periods,
    teams,
    players,
    lineupSegments: state.lineupSegments,
    events: state.events,
    diagnostics: state.diagnostics,
    reconciliation: { passed: false, checks: [] },
  }
}

function reconcile(
  state: SimulationState,
  result: GameResult
): GameReconciliationReport {
  const checks: GameReconciliationCheck[] = []
  const aggregate = aggregateLedger(state)
  const totalExpectedMinutes =
    sum(result.periods.map((period) => period.minutes)) * 5
  const addCheck = (
    code: string,
    label: string,
    actual: number,
    expected: number,
    tolerance = 0
  ) => {
    const difference = actual - expected
    checks.push({
      code,
      label,
      passed: Math.abs(difference) <= tolerance,
      actual,
      expected,
      difference,
    })
  }
  const addCondition = (
    code: string,
    label: string,
    passed: boolean,
    actual: number,
    expected: number
  ) => {
    checks.push({
      code,
      label,
      passed,
      actual,
      expected,
      difference: actual - expected,
    })
  }
  const playerFields: Array<
    keyof Omit<LedgerPlayerTotals, "playerId" | "teamId" | "shotProfile">
  > = [
    "opportunities",
    "points",
    "fieldGoalsMade",
    "fieldGoalsAttempted",
    "threePointersMade",
    "threePointersAttempted",
    "freeThrowsMade",
    "freeThrowsAttempted",
    "offensiveRebounds",
    "defensiveRebounds",
    "rebounds",
    "assists",
    "turnovers",
    "steals",
    "blocks",
    "fouls",
  ]
  for (const teamId of [state.fixture.homeTeamId, state.fixture.awayTeamId]) {
    const team = result.teams[teamId]
    const expectedTeam = aggregate.teams[teamId]
    if (!team || !expectedTeam) {
      addCheck(`${teamId}:ledger-team`, `${teamId} ledger team exists`, 0, 1)
      continue
    }
    for (const field of [
      "points",
      "fieldGoalsMade",
      "fieldGoalsAttempted",
      "threePointersMade",
      "threePointersAttempted",
      "freeThrowsMade",
      "freeThrowsAttempted",
      "offensiveRebounds",
      "defensiveRebounds",
      "rebounds",
      "assists",
      "turnovers",
      "steals",
      "blocks",
      "fouls",
    ] as const) {
      addCheck(
        `${teamId}:ledger-${field}`,
        `${teamId} ${field} matches the possession ledger`,
        team[field],
        expectedTeam[field]
      )
    }
    const playerResults = Object.values(result.players).filter(
      (player) => player.teamId === teamId
    )
    for (const player of playerResults) {
      const expectedPlayer = aggregate.players[player.playerId]
      if (!expectedPlayer) {
        addCheck(
          `${teamId}:ledger-player:${player.playerId}`,
          `${player.playerId} exists in the possession ledger`,
          0,
          1
        )
        continue
      }
      for (const field of playerFields) {
        addCheck(
          `${teamId}:ledger-player-${field}:${player.playerId}`,
          `${player.playerId} ${field} matches the possession ledger`,
          player[field],
          expectedPlayer[field]
        )
      }
      for (const field of [
        "rimAttempts",
        "midrangeAttempts",
        "threePointAttempts",
      ] as const) {
        addCheck(
          `${teamId}:ledger-player-shot-${field}:${player.playerId}`,
          `${player.playerId} ${field} matches the possession ledger`,
          player.shotProfile[field],
          expectedPlayer.shotProfile[field]
        )
      }
    }
    addCheck(
      `${teamId}:terminal-outcome-count`,
      `${teamId} has one terminal ledger outcome per possession`,
      team.possessions,
      expectedTeam.possessions
    )
    addCheck(
      `${teamId}:player-points`,
      `${teamId} player points aggregate`,
      sum(playerResults.map((player) => player.points)),
      team.points
    )
    addCheck(
      `${teamId}:player-fouls`,
      `${teamId} player fouls aggregate`,
      sum(playerResults.map((player) => player.fouls)),
      team.fouls
    )
    addCondition(
      `${teamId}:field-goal-subset`,
      `${teamId} field goals made do not exceed attempts`,
      team.fieldGoalsMade <= team.fieldGoalsAttempted,
      team.fieldGoalsMade,
      team.fieldGoalsAttempted
    )
    addCondition(
      `${teamId}:three-point-subset`,
      `${teamId} three-pointers made do not exceed attempts`,
      team.threePointersMade <= team.threePointersAttempted,
      team.threePointersMade,
      team.threePointersAttempted
    )
    addCondition(
      `${teamId}:three-point-field-goal-subset`,
      `${teamId} three-pointers made do not exceed field goals made`,
      team.threePointersMade <= team.fieldGoalsMade,
      team.threePointersMade,
      team.fieldGoalsMade
    )
    addCondition(
      `${teamId}:free-throw-subset`,
      `${teamId} free throws made do not exceed attempts`,
      team.freeThrowsMade <= team.freeThrowsAttempted,
      team.freeThrowsMade,
      team.freeThrowsAttempted
    )
    addCheck(
      `${teamId}:points-formula`,
      `${teamId} points formula is legal`,
      team.points,
      (team.fieldGoalsMade - team.threePointersMade) * 2 +
        team.threePointersMade * 3 +
        team.freeThrowsMade
    )
    addCheck(
      `${teamId}:shot-profile`,
      `${teamId} shot profile reconciles`,
      team.shotProfile.rimAttempts +
        team.shotProfile.midrangeAttempts +
        team.shotProfile.threePointAttempts,
      team.fieldGoalsAttempted
    )
    addCheck(
      `${teamId}:three-point-shot-profile`,
      `${teamId} three-point shot profile reconciles`,
      team.shotProfile.threePointAttempts,
      team.threePointersAttempted
    )
    addCheck(
      `${teamId}:rebound-total`,
      `${teamId} rebounds equal offensive plus defensive rebounds`,
      team.rebounds,
      team.offensiveRebounds + team.defensiveRebounds
    )
    addCondition(
      `${teamId}:assist-ceiling`,
      `${teamId} assists do not exceed made field goals`,
      team.assists <= team.fieldGoalsMade,
      team.assists,
      team.fieldGoalsMade
    )
    addCheck(
      `${teamId}:free-throw-lineage`,
      `${teamId} free throws come from shooting fouls`,
      team.freeThrowsAttempted,
      expectedTeam.freeThrowsAttempted
    )
    addCheck(
      `${teamId}:period-points`,
      `${teamId} period points reconcile to the ledger`,
      sum(result.periods.map((period) => period.teamPoints[teamId] ?? 0)),
      sum(
        Object.values(aggregate.periodPoints).map(
          (periodPoints) => periodPoints[teamId] ?? 0
        )
      )
    )
    addCheck(
      `${teamId}:period-possessions`,
      `${teamId} period possessions reconcile to the ledger`,
      sum(result.periods.map((period) => period.teamPossessions[teamId] ?? 0)),
      sum(
        Object.values(aggregate.periodPossessions).map(
          (periodPossessions) => periodPossessions[teamId] ?? 0
        )
      )
    )
    addCheck(
      `${teamId}:minutes`,
      `${teamId} minutes are legal`,
      sum(playerResults.map((player) => player.minutes)),
      totalExpectedMinutes,
      1
    )
    for (const player of playerResults) {
      const injuredDuringGame = state.events.some(
        (event) => event.playerId === player.playerId
      )
      if (
        !state.availability[player.playerId]?.available &&
        !injuredDuringGame &&
        player.minutes > 0
      ) {
        addCheck(
          `${teamId}:unavailable-player-minutes:${player.playerId}`,
          `${player.playerId} unavailable player minutes`,
          player.minutes,
          0
        )
      }
      const minutesLimit = state.availability[player.playerId]?.minutesLimit
      if (minutesLimit !== undefined && player.minutes > minutesLimit + 0.1) {
        addCheck(
          `${teamId}:minutes-limit:${player.playerId}`,
          `${player.playerId} minutes restriction`,
          player.minutes,
          minutesLimit
        )
      }
    }
    for (const segment of state.lineupSegments.filter(
      (candidate) => candidate.teamId === teamId
    )) {
      const uniquePlayers = new Set(segment.playerIds)
      const validPlayers = segment.playerIds.every(
        (playerId) => state.players[playerId]?.teamId === teamId
      )
      if (uniquePlayers.size !== 5 || !validPlayers) {
        addCheck(
          `${teamId}:invalid-lineup:${segment.id}`,
          `${state.fixture.teams[teamId]?.name ?? teamId} lineup is invalid`,
          uniquePlayers.size,
          5
        )
      }
    }
  }
  addCheck(
    "ledger:invariant-violations",
    "Possession ledger invariants remain valid",
    aggregate.invariantViolations,
    0
  )
  addCheck(
    "ledger:total-outcomes",
    "Every team possession has one ledger outcome",
    aggregate.teams[state.fixture.homeTeamId]!.possessions +
      aggregate.teams[state.fixture.awayTeamId]!.possessions,
    state.ledger.entries.length
  )
  return { passed: checks.every((check) => check.passed), checks }
}

function finalizeExecution(state: SimulationState): GameSimulationExecution {
  finalizeMinutes(state)
  const result = buildResult(state)
  const reconcileResult = () => reconcile(state, result)
  const reconciliation = reconcileResult()
  result.reconciliation = reconciliation
  result.status = reconciliation.passed ? "completed" : "failed"
  if (!reconciliation.passed) {
    state.diagnostics.push({
      code: "box-score-reconciliation-failed",
      message: "One or more final box-score totals did not reconcile.",
      severity: "error",
      scope: "box-score",
    })
  }
  return {
    result,
    telemetry: buildTelemetry(state),
    reconcile: reconcileResult,
  }
}

function emptyTelemetry(): GameSimulationTelemetry {
  return { totalPossessions: 0, byTeam: {} }
}

function rejectedExecution(
  fixture: GameMatchupFixture,
  diagnostics: GameDiagnostic[]
): GameSimulationExecution {
  const result: GameResult = {
    version: GAME_SIMULATION_VERSION,
    seed: fixture.seed,
    status: "rejected",
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    winnerTeamId: null,
    periods: [],
    teams: {},
    players: {},
    lineupSegments: [],
    events: [],
    diagnostics,
    reconciliation: { passed: false, checks: [] },
  }
  return {
    result,
    telemetry: emptyTelemetry(),
    reconcile: () => result.reconciliation,
  }
}

function createSimulationState(fixture: GameMatchupFixture): SimulationState {
  const config = resolveGameSimulationConfig(
    fixture.config,
    fixture.config.presetId
  )
  const teams = {
    [fixture.homeTeamId]: emptyTeamStats(fixture.homeTeamId),
    [fixture.awayTeamId]: emptyTeamStats(fixture.awayTeamId),
  }
  const rotations = {
    [fixture.homeTeamId]: buildRotationPlan(
      fixture,
      fixture.homeTeamId,
      config
    ),
    [fixture.awayTeamId]: buildRotationPlan(
      fixture,
      fixture.awayTeamId,
      config
    ),
  }
  const availability: Record<string, PlayerAvailability> = {}
  const roles: Record<string, RoleAssignment> = {}
  const players: Record<string, MutablePlayerStats> = {}
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const rotation = fixture.rotations[teamId]!
    for (const playerId of getPlayersForTeam(fixture, rotation)) {
      const player = fixture.players[playerId]!
      const playerAvailability = getAvailability(fixture, playerId)
      const role = createRole(player)
      availability[playerId] = playerAvailability
      roles[playerId] = role
      players[playerId] = emptyPlayerStats(
        player,
        teamId,
        rotation.starters.includes(playerId),
        role
      )
    }
  }
  const runtimes = {
    [fixture.homeTeamId]: createTeamRuntime(
      rotations[fixture.homeTeamId].playerIds
    ),
    [fixture.awayTeamId]: createTeamRuntime(
      rotations[fixture.awayTeamId].playerIds
    ),
  }
  return {
    fixture,
    config,
    random: createDeterministicRandom(fixture.seed),
    teams,
    players,
    roles,
    rotations,
    runtimes,
    availability,
    periods: [],
    lineupSegments: [],
    events: [],
    diagnostics: [],
    ledger: { entries: [] },
  }
}

export function simulateGameMatchupWithTelemetry(
  fixture: GameMatchupFixture
): GameSimulationExecution {
  const diagnostics = validateGameMatchupFixture(fixture)
  if (diagnostics.length > 0) return rejectedExecution(fixture, diagnostics)

  try {
    const state = createSimulationState(fixture)
    createPeriods(state)
    createOvertimePeriods(state)
    return finalizeExecution(state)
  } catch (error) {
    return rejectedExecution(fixture, [
      diagnostic(
        "game-simulation-failed",
        error instanceof Error ? error.message : "Game simulation failed.",
        "possession",
        "error"
      ),
    ])
  }
}

export function simulateGameMatchup(fixture: GameMatchupFixture): GameResult {
  return simulateGameMatchupWithTelemetry(fixture).result
}
