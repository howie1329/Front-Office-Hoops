import { RATING_MAX, RATING_MIN, ROTATION_SIZE } from "@workspace/shared/constants"
import type { Player, PlayerRatings } from "@workspace/shared/types"

import { selectRotation } from "./selectRotation"

export function clampRating(value: number): number {
  return Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, value)))
}

export function deriveOverall(
  ratings: Omit<PlayerRatings, "overall" | "potential" | "usage">,
): number {
  return clampRating(
    (ratings.shooting +
      ratings.inside +
      ratings.passing +
      ratings.rebounding +
      ratings.defense +
      ratings.stamina) /
      6,
  )
}

export function deriveUsage(overall: number, index: number): number {
  if (index < 2) return Math.min(30, Math.max(8, Math.round(22 + overall / 8)))
  if (index < 5) return Math.min(26, Math.max(8, Math.round(16 + overall / 10)))
  if (index < ROTATION_SIZE) {
    return Math.min(22, Math.max(6, Math.round(10 + overall / 12)))
  }
  return Math.min(16, Math.max(4, Math.round(6 + overall / 15)))
}

export function deriveTeamOverall(players: Player[]): number {
  const rotation = selectRotation(players)
  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0)

  if (totalMinutes === 0) {
    return 50
  }

  const weightedOverall = rotation.reduce(
    (sum, entry) => sum + entry.player.ratings.overall * entry.minutes,
    0,
  )

  return Math.round(weightedOverall / totalMinutes)
}

export function getRosterIndex(player: Player, players: Player[]): number {
  const sorted = [...players].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )
  return sorted.findIndex((entry) => entry.id === player.id)
}

export function recalculatePlayerRatings(
  player: Player,
  players: Player[],
): Player["ratings"] {
  const { shooting, inside, passing, rebounding, defense, stamina } = player.ratings
  const skillRatings = { shooting, inside, passing, rebounding, defense, stamina }
  const overall = deriveOverall(skillRatings)
  const rosterIndex = getRosterIndex(player, players)

  return {
    ...skillRatings,
    overall,
    potential: player.ratings.potential,
    usage: deriveUsage(overall, rosterIndex),
  }
}
