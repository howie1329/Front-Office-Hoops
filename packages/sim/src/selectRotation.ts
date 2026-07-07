import { ROTATION_SIZE, TEAM_MINUTES } from "@workspace/shared/constants"
import type {
  GameRotation,
  GameRotationEntry,
  Player,
  RotationEntry,
  RotationPlan,
  RotationPlanEntry,
  RotationRole,
  TeamWithRoster,
} from "@workspace/shared/types"

const MINUTES_BY_ROLE: Record<
  RotationRole,
  { target: number; min: number; max: number }
> = {
  star: { target: 36, min: 32, max: 38 },
  starter: { target: 31, min: 26, max: 35 },
  sixth_man: { target: 25, min: 20, max: 30 },
  rotation: { target: 18, min: 12, max: 24 },
  bench: { target: 8, min: 0, max: 14 },
}

function roleForPlayer(player: Player, index: number): RotationRole {
  if (index < 2 && player.ratings.overall >= 72) {
    return "star"
  }

  if (index < 5) {
    return "starter"
  }

  if (index === 5) {
    return "sixth_man"
  }

  if (index < ROTATION_SIZE) {
    return "rotation"
  }

  return "bench"
}

function staminaAdjustment(player: Player): number {
  const stamina = player.ratings.stamina

  if (stamina >= 76) {
    return 2
  }

  if (stamina <= 48) {
    return -4
  }

  if (stamina <= 58) {
    return -2
  }

  return 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeMinutes(entries: RotationPlanEntry[]): RotationPlanEntry[] {
  const normalized = entries.map((entry) => ({ ...entry }))
  let total = normalized.reduce((sum, entry) => sum + entry.targetMinutes, 0)
  let remaining = TEAM_MINUTES - total

  while (remaining !== 0) {
    const direction = remaining > 0 ? 1 : -1
    let changed = false

    for (const entry of normalized) {
      if (remaining === 0) {
        break
      }

      const min = entry.minMinutes ?? 0
      const max = entry.maxMinutes ?? TEAM_MINUTES
      const next = entry.targetMinutes + direction

      if (next >= min && next <= max) {
        entry.targetMinutes = next
        remaining -= direction
        changed = true
      }
    }

    if (!changed) {
      break
    }
  }

  total = normalized.reduce((sum, entry) => sum + entry.targetMinutes, 0)
  const delta = TEAM_MINUTES - total
  const lastEntry = normalized.at(-1)

  if (lastEntry) {
    lastEntry.targetMinutes = Math.max(0, lastEntry.targetMinutes + delta)
  }

  return normalized
}

export function createAutoRotationPlan(team: TeamWithRoster): RotationPlan {
  const eligiblePlayers = team.players.filter(
    (player) => player.status === "active"
  )
  const activePlayers = (
    eligiblePlayers.length >= 5
      ? eligiblePlayers
      : team.players.filter((player) => player.status !== "free_agent")
  ).sort((a, b) => b.ratings.overall - a.ratings.overall)

  const entries = activePlayers
    .slice(0, ROTATION_SIZE + 2)
    .map((player, index) => {
      const role = roleForPlayer(player, index)
      const band = MINUTES_BY_ROLE[role]
      const targetMinutes = clamp(
        band.target + staminaAdjustment(player),
        band.min,
        band.max
      )

      return {
        playerId: player.id,
        role,
        targetMinutes,
        minMinutes: band.min,
        maxMinutes: band.max,
      }
    })

  return {
    teamId: team.id,
    source: "auto",
    entries: normalizeMinutes(entries),
  }
}

export function createGameRotation(
  team: TeamWithRoster,
  plan: RotationPlan = createAutoRotationPlan(team)
): GameRotation {
  const starterIds = new Set(
    plan.entries.slice(0, 5).map((entry) => entry.playerId)
  )

  return {
    teamId: team.id,
    source: plan.source,
    entries: plan.entries.map<GameRotationEntry>((entry) => ({
      ...entry,
      minutes: entry.targetMinutes,
      starter: starterIds.has(entry.playerId),
    })),
  }
}

export function selectRotation(players: Player[]): RotationEntry[] {
  const team: TeamWithRoster = {
    id: "rotation",
    name: "Rotation",
    abbrev: "ROT",
    overall: 0,
    players,
  }
  const gameRotation = createGameRotation(team)
  const playerById = new Map(players.map((player) => [player.id, player]))

  return gameRotation.entries.flatMap((entry) => {
    const player = playerById.get(entry.playerId)

    if (!player || entry.minutes <= 0) {
      return []
    }

    return {
      player,
      minutes: entry.minutes,
      role: entry.role,
      starter: entry.starter,
    }
  })
}
