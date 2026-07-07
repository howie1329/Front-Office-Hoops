import {
  RATING_MAX,
  RATING_MIN,
  ROTATION_SIZE,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { Player, PlayerRatings, SkillKey } from "@workspace/shared/types"
import { OVERALL_SKILL_WEIGHTS } from "@workspace/shared/skillRatings"

import { selectRotation } from "./selectRotation"

export function clampRating(value: number): number {
  return Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, value)))
}

export function deriveOverall(
  ratings: Omit<PlayerRatings, "overall" | "potential" | "usage" | "fuzz">,
): number {
  const totalWeight = SKILL_KEYS.reduce(
    (sum, key) => sum + OVERALL_SKILL_WEIGHTS[key],
    0,
  )
  const weighted = SKILL_KEYS.reduce(
    (sum, key) => sum + ratings[key] * OVERALL_SKILL_WEIGHTS[key],
    0,
  )

  return clampRating(weighted / totalWeight)
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

export function getSkillRatings(
  ratings: PlayerRatings,
): Record<SkillKey, number> {
  return {
    threePoint: ratings.threePoint,
    midRange: ratings.midRange,
    freeThrow: ratings.freeThrow,
    inside: ratings.inside,
    passing: ratings.passing,
    ballHandling: ratings.ballHandling,
    rebounding: ratings.rebounding,
    defense: ratings.defense,
    stamina: ratings.stamina,
    offensiveIQ: ratings.offensiveIQ,
    defensiveIQ: ratings.defensiveIQ,
  }
}

export function recalculatePlayerRatings(
  player: Player,
  players: Player[],
): Player["ratings"] {
  const skills = getSkillRatings(player.ratings)
  const overall = deriveOverall(skills)
  const rosterIndex = getRosterIndex(player, players)

  return {
    ...skills,
    fuzz: player.ratings.fuzz,
    overall,
    potential: player.ratings.potential,
    usage: deriveUsage(overall, rosterIndex),
  }
}
