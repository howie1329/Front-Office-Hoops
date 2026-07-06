import type { Player, PlayerPosition } from "@workspace/shared/types"

export type RosterRole = "guards" | "wings" | "bigs"

export const ROLE_POSITIONS: Record<RosterRole, PlayerPosition[]> = {
  guards: ["PG", "SG"],
  wings: ["SG", "SF", "PF"],
  bigs: ["PF", "C"],
}

const TARGET_ROLE_COUNTS: Record<RosterRole, number> = {
  guards: 4,
  wings: 5,
  bigs: 3,
}

export function getRosterRoleCounts(
  players: Player[]
): Record<RosterRole, number> {
  return {
    guards: players.filter((player) =>
      ROLE_POSITIONS.guards.includes(player.position)
    ).length,
    wings: players.filter((player) =>
      ROLE_POSITIONS.wings.includes(player.position)
    ).length,
    bigs: players.filter((player) =>
      ROLE_POSITIONS.bigs.includes(player.position)
    ).length,
  }
}

export function getRosterNeeds(players: Player[]): Record<RosterRole, number> {
  const counts = getRosterRoleCounts(players)
  return {
    guards: Math.max(0, TARGET_ROLE_COUNTS.guards - counts.guards),
    wings: Math.max(0, TARGET_ROLE_COUNTS.wings - counts.wings),
    bigs: Math.max(0, TARGET_ROLE_COUNTS.bigs - counts.bigs),
  }
}

export function getPlayerRoleNeedBonus(
  players: Player[],
  player: Player
): number {
  const needs = getRosterNeeds(players)
  let bonus = 0

  for (const role of Object.keys(ROLE_POSITIONS) as RosterRole[]) {
    if (ROLE_POSITIONS[role].includes(player.position)) {
      bonus += needs[role] * 2
    }
  }

  return bonus
}

export function getScarceRolePenalty(
  players: Player[],
  player: Player
): number {
  const counts = getRosterRoleCounts(players)
  let penalty = 0

  for (const role of Object.keys(ROLE_POSITIONS) as RosterRole[]) {
    if (ROLE_POSITIONS[role].includes(player.position)) {
      const target = TARGET_ROLE_COUNTS[role]
      if (counts[role] <= target) {
        penalty += (target - counts[role] + 1) * 6
      }
    }
  }

  return penalty
}

export function scoreRosterBalance(players: Player[]): number {
  const needs = getRosterNeeds(players)
  return Object.values(needs).reduce((sum, need) => sum - need * 10, 0)
}
