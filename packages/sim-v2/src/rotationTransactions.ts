import type {
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  PlayerEntity,
  ValidationIssue,
} from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

type SetRotationCommand = Extract<LeagueCommand, { type: "SetRotation" }>

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const

export class SetRotationCommandError extends Error {
  readonly reason: ValidationIssue

  constructor(reason: ValidationIssue) {
    super(reason.message)
    this.name = "SetRotationCommandError"
    this.reason = reason
  }
}

export type SetRotationResult = {
  league: LeagueDocument
  event: LeagueEvent
}

function fail(
  code: string,
  message: string,
  path?: Array<string | number>
): never {
  throw new SetRotationCommandError({ code, message, path })
}

function isEligible(player: PlayerEntity, position: string): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

function canCoverLineup(players: PlayerEntity[]): boolean {
  function cover(positionIndex: number, used: Set<string>): boolean {
    if (positionIndex === POSITIONS.length) return true

    const position = POSITIONS[positionIndex]!
    return players.some((player) => {
      if (used.has(player.id) || !isEligible(player, position)) return false
      used.add(player.id)
      const covered = cover(positionIndex + 1, used)
      used.delete(player.id)
      return covered
    })
  }

  return cover(0, new Set())
}

function validateRotation(
  league: LeagueDocument,
  command: SetRotationCommand
): void {
  const team = league.entities.teams[command.teamId]
  if (!team) {
    fail(
      "unknown_rotation_team",
      "The team setting the rotation does not exist.",
      ["command", "teamId"]
    )
  }

  const rosterIds = new Set(team.rosterPlayerIds ?? [])
  const rotation = command.rotation

  if (
    league.state.userTeamId !== null &&
    league.state.userTeamId !== command.teamId
  ) {
    fail(
      "rotation_team_not_selected",
      "Only the selected user team can change its gameplay rotation.",
      ["command", "teamId"]
    )
  }

  if (rotation.starters.length !== 5) {
    fail(
      "invalid_starter_count",
      "A rotation must have exactly five starters.",
      ["command", "rotation", "starters"]
    )
  }

  if (new Set(rotation.starters).size !== rotation.starters.length) {
    fail(
      "duplicate_starter",
      "A player cannot occupy more than one starting spot.",
      ["command", "rotation", "starters"]
    )
  }

  if (new Set(rotation.depthOrder).size !== rotation.depthOrder.length) {
    fail(
      "duplicate_depth_player",
      "A player cannot appear more than once in the bench order.",
      ["command", "rotation", "depthOrder"]
    )
  }

  const orderedIds = new Set(rotation.depthOrder)
  for (const playerId of rotation.starters) {
    if (!orderedIds.has(playerId)) {
      fail(
        "starter_missing_from_depth_order",
        "Every starter must also appear in the rotation order.",
        ["command", "rotation", "depthOrder"]
      )
    }
  }

  const rotationPlayers: PlayerEntity[] = []
  for (const playerId of rotation.depthOrder) {
    if (!rosterIds.has(playerId)) {
      fail(
        "rotation_player_not_on_roster",
        "Every rotation player must be on the team roster.",
        ["command", "rotation", "depthOrder", playerId]
      )
    }

    const player = league.entities.players[playerId]
    if (!player) {
      fail(
        "unknown_rotation_player",
        "The rotation references a player who does not exist.",
        ["command", "rotation", "depthOrder", playerId]
      )
    }
    rotationPlayers.push(player)
  }

  const starters = rotation.starters.map((playerId) => {
    const player = league.entities.players[playerId]
    if (!player || !rosterIds.has(playerId)) {
      fail(
        "starter_not_on_roster",
        "Every starter must be on the team roster.",
        ["command", "rotation", "starters", playerId]
      )
    }
    return player
  })

  for (const playerId of rotation.starters) {
    const availability = league.state.availability?.[playerId]
    if (availability && !availability.available) {
      fail(
        "unavailable_starter",
        "An unavailable player cannot be listed as a starter.",
        ["command", "rotation", "starters", playerId]
      )
    }
  }

  if (!canCoverLineup(starters)) {
    fail(
      "invalid_starter_coverage",
      "The starting five cannot cover all five positions.",
      ["command", "rotation", "starters"]
    )
  }

  for (const [playerId, minutes] of Object.entries(rotation.targetMinutes)) {
    if (!orderedIds.has(playerId)) {
      fail(
        "minutes_for_unlisted_player",
        "Target minutes can only be assigned to players in the rotation order.",
        ["command", "rotation", "targetMinutes", playerId]
      )
    }
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60) {
      fail(
        "invalid_target_minutes",
        "Target minutes must be between 0 and 60.",
        ["command", "rotation", "targetMinutes", playerId]
      )
    }
  }

  if (league.state.userTeamId !== null) {
    const totalMinutes = Object.values(rotation.targetMinutes).reduce(
      (sum, minutes) => sum + minutes,
      0
    )
    if (Math.abs(totalMinutes - 240) > 0.001) {
      fail(
        "invalid_rotation_minutes_total",
        `Target minutes must total exactly 240 regulation minutes (received ${totalMinutes}).`,
        ["command", "rotation", "targetMinutes"]
      )
    }
  }

  if (rotationPlayers.length < 5) {
    fail(
      "insufficient_rotation_players",
      "A rotation must include at least five players.",
      ["command", "rotation", "depthOrder"]
    )
  }
}

export function setRotation(
  league: LeagueDocument,
  command: SetRotationCommand
): SetRotationResult {
  validateRotation(league, command)

  const nextLeague = structuredClone(league)
  nextLeague.state.rotations ??= {}
  nextLeague.state.rotations[command.teamId] = structuredClone(command.rotation)
  if (nextLeague.state.gamePlans) {
    nextLeague.state.gamePlans[command.teamId] = {
      rotation: structuredClone(command.rotation),
      coaching: nextLeague.state.gamePlans[command.teamId]?.coaching ?? {
        pace: 50,
        offensiveStyle: 50,
        defensivePressure: 50,
        shotSelection: 50,
        rotationDepth: 50,
      },
    }
  }
  nextLeague.metadata.updatedAt = new Date().toISOString()

  const team = nextLeague.entities.teams[command.teamId]!
  const event: LeagueEvent = {
    id: `event:${command.commandId}`,
    type: "command.completed",
    season: nextLeague.state.season,
    phase: nextLeague.state.phase,
    leagueDay: nextLeague.state.leagueDay,
    entityRefs: [{ type: "team", id: command.teamId }],
    payload: {
      action: "set-rotation",
      teamId: command.teamId,
      starters: command.rotation.starters,
      depthOrder: command.rotation.depthOrder,
      targetMinutes: command.rotation.targetMinutes,
    },
    summary: `Updated the ${team.name} rotation.`,
    importance: "notable",
    storyTags: ["team-management", "rotation"],
    source: { kind: "command", id: command.commandId },
  }

  nextLeague.history.events.push(event)

  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    fail(
      "invalid_rotation_snapshot",
      validation.issues[0]?.message ??
        "The rotation command produced an invalid league snapshot.",
      validation.issues[0]?.path
    )
  }

  return { league: validation.data, event }
}
