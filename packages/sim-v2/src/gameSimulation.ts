import type {
  GameDiagnostic,
  GameEvent,
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

type SimulationState = {
  fixture: GameMatchupFixture
  config: GameSimulationConfig
  random: RandomSource
  teams: Record<string, MutableTeamStats>
  players: Record<string, MutablePlayerStats>
  roles: Record<string, RoleAssignment>
  rotations: Record<string, RotationPlan>
  availability: Record<string, PlayerAvailability>
  periods: GamePeriodResult[]
  events: GameEvent[]
  diagnostics: GameDiagnostic[]
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
      return [playerId, availability.available ? Math.max(0, limited) : 0]
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
      activePlayerIds: availableIds,
      targetMinutes,
      starterIds: new Set(rotation.starters),
    }
  }

  return {
    teamId,
    playerIds,
    activePlayerIds: availableIds,
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

function syncTeamTotalsFromPlayers(state: SimulationState): void {
  for (const teamId of [state.fixture.homeTeamId, state.fixture.awayTeamId]) {
    const team = state.teams[teamId]!
    const players = Object.values(state.players).filter(
      (player) => player.teamId === teamId
    )
    const numericFields: Array<
      keyof Omit<MutableTeamStats, "teamId" | "shotProfile" | "possessions">
    > = [
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
    for (const field of numericFields) {
      team[field] = sum(players.map((player) => player[field]))
    }
    for (const field of [
      "rimAttempts",
      "midrangeAttempts",
      "threePointAttempts",
    ] as const) {
      team.shotProfile[field] = sum(
        players.map((player) => player.shotProfile[field])
      )
    }
  }
}

function playerCanPlay(state: SimulationState, playerId: string): boolean {
  const player = state.players[playerId]
  const availability = state.availability[playerId]
  return Boolean(player && availability?.available)
}

function chooseOffensivePlayer(
  state: SimulationState,
  teamId: string,
  period: number,
  possession: number
): string {
  const plan = state.rotations[teamId]!
  const config = state.config
  const entries = plan.activePlayerIds
    .filter((playerId) => playerCanPlay(state, playerId))
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
      return {
        id: playerId,
        weight:
          plannedMinutes *
          (role.creationWeight * 0.7 + role.scoringWeight * 0.3) *
          starterBoost *
          starBoost,
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
  const plan = state.rotations[teamId]!
  const entries = plan.activePlayerIds
    .filter((playerId) => playerCanPlay(state, playerId))
    .map((playerId) => ({
      id: playerId,
      weight: Math.max(1, preference(state.fixture.players[playerId]!)),
    }))
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
  const weights = [
    {
      id: "three" as const,
      weight:
        24 +
        offense.threePointRate * 0.28 +
        player.profile.skills.shooting * 0.12 +
        (quality.three - averageQuality) * disciplineBias * 0.08 +
        transitionBias * 2.2 +
        coachSelectionBias * 2.2,
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
        coachSelectionBias * 3.2,
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
        coachSelectionBias * 5.4,
    },
  ]
  return weightedChoice(
    state.random.fork(`shot:${player.id}:${period}:${possession}`),
    weights
  ) as "rim" | "midrange" | "three"
}

function simulateFreeThrows(
  state: SimulationState,
  shooter: MutablePlayerStats,
  shooterEntity: PlayerEntity,
  attempts: number
): number {
  const makeRate = clamp(
    0.45 +
      shooterEntity.profile.skills.shooting * 0.0045 +
      (state.config.environment.scoringEnvironment - 50) * 0.001,
    0.55,
    0.95
  )
  let makes = 0
  for (let index = 0; index < attempts; index += 1) {
    if (state.random.next() < makeRate) makes += 1
  }
  shooter.freeThrowsAttempted += attempts
  shooter.freeThrowsMade += makes
  shooter.points += makes
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

  if (
    state.rotations[teamId]!.activePlayerIds.filter((playerId) =>
      playerCanPlay(state, playerId)
    ).length <= 5
  ) {
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
    description: `${formatPlayerIdentity(player.identity) ?? playerId} left with a minor injury.`,
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

function simulatePossession(
  state: SimulationState,
  offenseTeamId: string,
  defenseTeamId: string,
  period: number,
  possession: number,
  periodPoints: Record<string, number>
): void {
  const offensePlayerId = chooseOffensivePlayer(
    state,
    offenseTeamId,
    period,
    possession
  )
  const offensePlayer = state.fixture.players[offensePlayerId]!
  const offenseStats = state.players[offensePlayerId]!
  const defensePlayerId = choosePlayer(
    state,
    defenseTeamId,
    `defender:${defenseTeamId}:${period}:${possession}`,
    (player) =>
      player.profile.skills.defense + player.profile.skills.basketballIQ * 0.3
  )
  const defensePlayer = state.fixture.players[defensePlayerId]!
  const defenseStats = state.players[defensePlayerId]!
  const offenseTeam = state.teams[offenseTeamId]!
  const defenseTeam = state.teams[defenseTeamId]!
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

  offenseStats.opportunities += 1
  const turnoverRate = clamp(
    0.135 +
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
      (doubleTeamActive ? 0.025 + creatorFactor * 0.025 : 0),
    0.055,
    0.22
  )

  if (state.random.next() < adjustedTurnoverRate) {
    offenseStats.turnovers += 1
    if (state.random.next() < 0.72) defenseStats.steals += 1
    maybeCreateInjury(state, offenseTeamId, period, possession)
    return
  }

  const foulRate = clamp(
    0.045 +
      config.defense.pressure * 0.00012 -
      config.defense.foulDiscipline * 0.0001 +
      coachDefenseModifier * 0.006,
    0.025,
    0.095
  )
  if (state.random.next() < foulRate) {
    defenseStats.fouls += 1
    defenseTeam.fouls += 1
    const freeThrowAttempts = state.random.next() < 0.12 ? 3 : 2
    const made = simulateFreeThrows(
      state,
      offenseStats,
      offensePlayer,
      freeThrowAttempts
    )
    offenseTeam.freeThrowsAttempted += freeThrowAttempts
    offenseTeam.freeThrowsMade += made
    offenseTeam.points += made
    periodPoints[offenseTeamId] = (periodPoints[offenseTeamId] ?? 0) + made
    maybeCreateInjury(state, offenseTeamId, period, possession)
    return
  }

  const shot = attemptType(
    state,
    offensePlayer,
    offenseTeamId,
    period,
    possession
  )
  const shootingSkill = offensePlayer.profile.skills.shooting
  const finishingSkill = offensePlayer.profile.skills.finishing
  const defensePressure =
    defensePlayer.profile.skills.defense * 0.0015 +
    config.defense.helpDefense * 0.00025 +
    coachDefenseModifier * 0.018 +
    (doubleTeamActive ? 0.012 + creatorFactor * 0.008 : 0)
  const scoringEnvironment =
    (config.environment.scoringEnvironment - 50) * 0.0009
  const talentSeparation = config.environment.talentSeparation / 100
  const variance = config.environment.gameVariance / 100
  const homeEfficiencyBonus =
    offenseTeamId === state.fixture.homeTeamId
      ? (config.environment.homeCourtAdvantage - 50) * 0.00035
      : 0
  const shotQuality =
    shot === "three"
      ? offensePlayer.profile.skills.shooting
      : shot === "rim"
        ? (offensePlayer.profile.skills.finishing +
            offensePlayer.profile.skills.handling) /
          2
        : (offensePlayer.profile.skills.shooting +
            offensePlayer.profile.skills.basketballIQ) /
          2
  const disciplineQualityBonus =
    ((config.offense.shotSelectionDiscipline - 50) / 50) *
    (shotQuality - 50) *
    0.00035
  const fatiguePenalty =
    period > 2 ? config.rotation.fatigueImpact * 0.00045 : 0
  const randomNoise = state.random.normal(0, 0.045 * variance)
  const makeRate =
    shot === "three"
      ? clamp(
          0.27 +
            shootingSkill * 0.00105 * talentSeparation +
            scoringEnvironment +
            homeEfficiencyBonus +
            disciplineQualityBonus -
            fatiguePenalty -
            defensePressure +
            randomNoise,
          0.18,
          0.52
        )
      : shot === "rim"
        ? clamp(
            0.42 +
              finishingSkill * 0.0012 * talentSeparation +
              scoringEnvironment +
              homeEfficiencyBonus +
              disciplineQualityBonus -
              fatiguePenalty -
              defensePressure * 0.7 +
              randomNoise,
            0.3,
            0.78
          )
        : clamp(
            0.31 +
              shootingSkill * 0.0009 * talentSeparation +
              scoringEnvironment +
              homeEfficiencyBonus +
              disciplineQualityBonus -
              fatiguePenalty -
              defensePressure +
              randomNoise,
            0.2,
            0.58
          )

  offenseStats.fieldGoalsAttempted += 1
  offenseTeam.fieldGoalsAttempted += 1
  offenseStats.shotProfile[
    shot === "three"
      ? "threePointAttempts"
      : shot === "rim"
        ? "rimAttempts"
        : "midrangeAttempts"
  ] += 1
  offenseTeam.shotProfile[
    shot === "three"
      ? "threePointAttempts"
      : shot === "rim"
        ? "rimAttempts"
        : "midrangeAttempts"
  ] += 1
  if (shot === "three") {
    offenseStats.threePointersAttempted += 1
    offenseTeam.threePointersAttempted += 1
  }

  const made = state.random.next() < makeRate
  if (made) {
    const points = shot === "three" ? 3 : 2
    offenseStats.fieldGoalsMade += 1
    offenseStats.points += points
    offenseTeam.fieldGoalsMade += 1
    offenseTeam.points += points
    periodPoints[offenseTeamId] = (periodPoints[offenseTeamId] ?? 0) + points
    if (shot === "three") {
      offenseStats.threePointersMade += 1
      offenseTeam.threePointersMade += 1
    }

    const assistChance = clamp(
      0.22 +
        config.offense.ballMovement * 0.004 -
        config.offense.isolationRate * 0.0025 +
        offensePlayer.profile.skills.passing * 0.001,
      0.08,
      0.7
    )
    if (state.random.next() < assistChance) {
      const passerId = choosePlayer(
        state,
        offenseTeamId,
        `assist:${offenseTeamId}:${period}:${possession}`,
        (player) =>
          player.profile.skills.passing + player.profile.skills.basketballIQ
      )
      if (passerId && passerId !== offensePlayerId) {
        state.players[passerId]!.assists += 1
        offenseTeam.assists += 1
      }
    }
  } else {
    const blockChance = clamp(
      shot === "rim"
        ? 0.035 +
            config.defense.helpDefense * 0.0006 +
            defensePlayer.profile.skills.defense * 0.0004
        : 0.01 + defensePlayer.profile.skills.defense * 0.00012,
      0.005,
      0.12
    )
    if (state.random.next() < blockChance) defenseStats.blocks += 1

    const offensiveReboundChance = clamp(
      0.16 +
        config.offense.offensiveRebounding * 0.0008 +
        offensePlayer.profile.skills.rebounding * 0.001 -
        defensePlayer.profile.skills.rebounding * 0.0005,
      0.08,
      0.38
    )
    if (state.random.next() < offensiveReboundChance) {
      const rebounderId = choosePlayer(
        state,
        offenseTeamId,
        `offensive-rebound:${offenseTeamId}:${period}:${possession}`,
        (player) =>
          player.profile.skills.rebounding +
          player.profile.physical.strength * 0.3
      )
      state.players[rebounderId]!.offensiveRebounds += 1
      state.players[rebounderId]!.rebounds += 1
      offenseTeam.offensiveRebounds += 1
      offenseTeam.rebounds += 1
    } else {
      const rebounderId = choosePlayer(
        state,
        defenseTeamId,
        `defensive-rebound:${defenseTeamId}:${period}:${possession}`,
        (player) =>
          player.profile.skills.rebounding +
          player.profile.physical.strength * 0.3
      )
      state.players[rebounderId]!.defensiveRebounds += 1
      state.players[rebounderId]!.rebounds += 1
      defenseTeam.defensiveRebounds += 1
      defenseTeam.rebounds += 1
    }
  }

  maybeCreateInjury(state, offenseTeamId, period, possession)
}

function createPeriods(state: SimulationState): void {
  const { config, fixture } = state
  for (let period = 1; period <= REGULATION_PERIODS; period += 1) {
    const teamPoints: Record<string, number> = {
      [fixture.homeTeamId]: 0,
      [fixture.awayTeamId]: 0,
    }
    const teamPossessions: Record<string, number> = {
      [fixture.homeTeamId]: 0,
      [fixture.awayTeamId]: 0,
    }
    for (const offenseTeamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      const defenseTeamId =
        offenseTeamId === fixture.homeTeamId
          ? fixture.awayTeamId
          : fixture.homeTeamId
      const coach = getEffectiveCoachProfile(
        fixture.coaching[offenseTeamId]!,
        config
      )
      const homeBonus =
        offenseTeamId === fixture.homeTeamId
          ? (config.environment.homeCourtAdvantage - 50) * 0.04
          : 0
      const paceValue =
        94 +
        config.environment.pace * 0.12 +
        (coach.pace - 50) * (config.coaching.paceInfluence / 500) +
        homeBonus
      const possessions = Math.max(
        16,
        Math.round(
          state.random
            .fork(`possessions:${offenseTeamId}:${period}`)
            .normal(
              paceValue / REGULATION_PERIODS,
              1.5 + config.environment.gameVariance * 0.01
            )
        )
      )
      teamPossessions[offenseTeamId] = possessions
      state.teams[offenseTeamId]!.possessions += possessions
      for (let possession = 1; possession <= possessions; possession += 1) {
        simulatePossession(
          state,
          offenseTeamId,
          defenseTeamId,
          period,
          possession,
          teamPoints
        )
      }
    }
    state.periods.push({
      number: period,
      kind: "regulation",
      minutes: 12,
      teamPoints,
      teamPossessions,
    })
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
    const teamPoints: Record<string, number> = {
      [fixture.homeTeamId]: 0,
      [fixture.awayTeamId]: 0,
    }
    const teamPossessions: Record<string, number> = {
      [fixture.homeTeamId]: 0,
      [fixture.awayTeamId]: 0,
    }
    for (const offenseTeamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      const defenseTeamId =
        offenseTeamId === fixture.homeTeamId
          ? fixture.awayTeamId
          : fixture.homeTeamId
      const possessions = Math.max(
        2,
        Math.round(
          state.random
            .fork(`overtime:${overtimeNumber}:${offenseTeamId}`)
            .normal(10, 1.2)
        )
      )
      teamPossessions[offenseTeamId] = possessions
      state.teams[offenseTeamId]!.possessions += possessions
      for (let possession = 1; possession <= possessions; possession += 1) {
        simulatePossession(
          state,
          offenseTeamId,
          defenseTeamId,
          REGULATION_PERIODS + overtimeNumber,
          possession,
          teamPoints
        )
      }
    }
    state.periods.push({
      number: REGULATION_PERIODS + overtimeNumber,
      kind: "overtime",
      minutes: config.overtime.segmentMinutes,
      teamPoints,
      teamPossessions,
    })
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
  const totalGameMinutes = sum(state.periods.map((period) => period.minutes))
  const expectedTeamMinutes = totalGameMinutes * 5
  for (const teamId of [state.fixture.homeTeamId, state.fixture.awayTeamId]) {
    const plan = state.rotations[teamId]!
    const playerIds = plan.playerIds
    const played = Object.fromEntries(
      playerIds.map((playerId) => {
        const event = state.events.find(
          (candidate) => candidate.playerId === playerId
        )
        const fraction = event
          ? Math.max(0.08, (event.period - 1) / state.periods.length)
          : 1
        const availability = state.availability[playerId]!
        const limited =
          availability.restriction === "minutes-limited"
            ? Math.min(
                plan.targetMinutes[playerId] ?? 0,
                availability.minutesLimit ?? 24
              )
            : (plan.targetMinutes[playerId] ?? 0)
        return [playerId, availability.available ? limited : limited * fraction]
      })
    ) as Record<string, number>
    const total = sum(Object.values(played))
    const activeIds = playerIds.filter(
      (playerId) => state.availability[playerId]?.available
    )
    let remaining = Math.max(0, expectedTeamMinutes - total)
    while (remaining > 0.01) {
      const eligibleIds = activeIds.filter((playerId) => {
        const availability = state.availability[playerId]!
        const limit =
          availability.restriction === "minutes-limited"
            ? (availability.minutesLimit ?? 24)
            : Number.POSITIVE_INFINITY
        return limit - (played[playerId] ?? 0) > 0.01
      })
      if (eligibleIds.length === 0) break
      const weightTotal = sum(
        eligibleIds.map((playerId) => Math.max(1, played[playerId] ?? 0))
      )
      let allocated = 0
      for (const playerId of eligibleIds) {
        const availability = state.availability[playerId]!
        const limit =
          availability.restriction === "minutes-limited"
            ? (availability.minutesLimit ?? 24)
            : Number.POSITIVE_INFINITY
        const share = Math.min(
          remaining,
          remaining * (Math.max(1, played[playerId] ?? 0) / weightTotal)
        )
        const addition = Math.min(share, limit - (played[playerId] ?? 0))
        played[playerId] = (played[playerId] ?? 0) + addition
        allocated += addition
      }
      if (allocated <= 0.01) break
      remaining -= allocated
    }
    for (const playerId of playerIds) {
      const stats = state.players[playerId]
      if (!stats) continue
      stats.minutes = round(played[playerId] ?? 0, 1)
      stats.usageRate = plan.targetMinutes[playerId]
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

function reconcile(state: SimulationState): GameReconciliationReport {
  const checks: GameReconciliationCheck[] = []
  const totalExpectedMinutes =
    sum(state.periods.map((period) => period.minutes)) * 5
  for (const teamId of [state.fixture.homeTeamId, state.fixture.awayTeamId]) {
    const team = state.teams[teamId]!
    const players = Object.values(state.players).filter(
      (player) => player.teamId === teamId
    )
    const check = (
      code: string,
      label: string,
      actual: number,
      expected: number,
      tolerance = 0
    ) => {
      const difference = actual - expected
      checks.push({
        code: `${teamId}:${code}`,
        label: `${state.fixture.teams[teamId]?.name ?? teamId} ${label}`,
        passed: Math.abs(difference) <= tolerance,
        actual,
        expected,
        difference,
      })
    }
    const playerSum = (field: keyof MutablePlayerStats) =>
      sum(
        players.map((player) =>
          typeof player[field] === "number" ? (player[field] as number) : 0
        )
      )
    check("points", "points reconcile", playerSum("points"), team.points)
    check(
      "field-goals",
      "field goals reconcile",
      playerSum("fieldGoalsMade"),
      team.fieldGoalsMade
    )
    check(
      "three-pointers",
      "three-pointers reconcile",
      playerSum("threePointersMade"),
      team.threePointersMade
    )
    check(
      "free-throws",
      "free throws reconcile",
      playerSum("freeThrowsMade"),
      team.freeThrowsMade
    )
    check(
      "rebounds",
      "rebounds reconcile",
      playerSum("rebounds"),
      team.rebounds
    )
    check("assists", "assists reconcile", playerSum("assists"), team.assists)
    check(
      "turnovers",
      "turnovers reconcile",
      playerSum("turnovers"),
      team.turnovers
    )
    check(
      "minutes",
      "minutes are legal",
      playerSum("minutes"),
      totalExpectedMinutes,
      1
    )
    for (const player of players) {
      const injuredDuringGame = state.events.some(
        (event) => event.playerId === player.playerId
      )
      if (
        !state.availability[player.playerId]?.available &&
        !injuredDuringGame &&
        player.minutes > 0
      ) {
        checks.push({
          code: `${teamId}:unavailable-player-minutes:${player.playerId}`,
          label: `${player.playerId} unavailable player minutes`,
          passed: false,
          actual: player.minutes,
          expected: 0,
          difference: player.minutes,
        })
      }
    }
  }
  return { passed: checks.every((check) => check.passed), checks }
}

function finalizeResult(state: SimulationState): GameResult {
  finalizeMinutes(state)
  syncTeamTotalsFromPlayers(state)
  const reconciliation = reconcile(state)
  if (!reconciliation.passed) {
    state.diagnostics.push({
      code: "box-score-reconciliation-failed",
      message: "One or more final box-score totals did not reconcile.",
      severity: "error",
      scope: "box-score",
    })
  }
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
    status: reconciliation.passed ? "completed" : "failed",
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
    events: state.events,
    diagnostics: state.diagnostics,
    reconciliation,
  }
}

function rejectedResult(
  fixture: GameMatchupFixture,
  diagnostics: GameDiagnostic[]
): GameResult {
  return {
    version: GAME_SIMULATION_VERSION,
    seed: fixture.seed,
    status: "rejected",
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    winnerTeamId: null,
    periods: [],
    teams: {},
    players: {},
    events: [],
    diagnostics,
    reconciliation: { passed: false, checks: [] },
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
  return {
    fixture,
    config,
    random: createDeterministicRandom(fixture.seed),
    teams,
    players,
    roles,
    rotations,
    availability,
    periods: [],
    events: [],
    diagnostics: [],
  }
}

export function simulateGameMatchup(fixture: GameMatchupFixture): GameResult {
  const diagnostics = validateGameMatchupFixture(fixture)
  if (diagnostics.length > 0) return rejectedResult(fixture, diagnostics)

  try {
    const state = createSimulationState(fixture)
    createPeriods(state)
    createOvertimePeriods(state)
    return finalizeResult(state)
  } catch (error) {
    return rejectedResult(fixture, [
      diagnostic(
        "game-simulation-failed",
        error instanceof Error ? error.message : "Game simulation failed.",
        "possession",
        "error"
      ),
    ])
  }
}
