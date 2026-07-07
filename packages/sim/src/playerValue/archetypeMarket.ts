import type { PlayerArchetype } from "@workspace/shared/playerTypes"
import type { LeagueRecord, Player } from "@workspace/shared/types"

const SCARCE_ARCHETYPES = new Set<PlayerArchetype>([
  "three_and_d_wing",
  "stretch_big",
  "lead_guard",
  "rim_protector",
])

function meetsQualityThreshold(player: Player): boolean {
  const { threePoint, defense, passing, rebounding } = player.ratings
  switch (player.archetype) {
    case "three_and_d_wing":
      return threePoint >= 60 && defense >= 60
    case "stretch_big":
      return threePoint >= 60 && rebounding >= 58
    case "lead_guard":
      return passing >= 64
    case "rim_protector":
      return defense >= 64 && rebounding >= 62
    default:
      return player.ratings.overall >= 68
  }
}

export function countLeagueArchetypeSupply(
  league: LeagueRecord,
  archetype: PlayerArchetype,
): number {
  const players = [
    ...league.seasonState.teams.flatMap((team) => team.players),
    ...league.freeAgentPool,
  ]
  return players.filter(
    (player) => player.archetype === archetype && meetsQualityThreshold(player),
  ).length
}

export function getOverallTierMultiplier(overall: number): number {
  if (overall >= 78) {
    return 1.15
  }
  if (overall >= 68) {
    return 1.05
  }
  return 1
}

export function getArchetypeMarketPremium(
  player: Player,
  league: LeagueRecord,
): number {
  if (!SCARCE_ARCHETYPES.has(player.archetype)) {
    return getOverallTierMultiplier(player.ratings.overall)
  }

  const supply = countLeagueArchetypeSupply(league, player.archetype)
  const scarcityBoost = Math.max(0, 6 - supply) * 0.35
  return getOverallTierMultiplier(player.ratings.overall) + scarcityBoost
}
