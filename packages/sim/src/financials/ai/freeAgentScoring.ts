import type { PlayerPosition } from "@workspace/shared/playerTypes"
import type { TeamMode } from "@workspace/shared/financialTypes"
import type { Player, TeamWithRoster } from "@workspace/shared/types"

import { calculatePlayerValue } from "../../playerValue"
import { getPlayerRoleNeedBonus } from "../../roster/rosterBalance"

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

export function getPositionNeeds(
  team: TeamWithRoster
): Record<PlayerPosition, number> {
  const needs = Object.fromEntries(
    POSITIONS.map((position) => [position, 0])
  ) as Record<PlayerPosition, number>

  for (const position of POSITIONS) {
    const atPosition = team.players.filter(
      (player) => player.position === position
    )
    if (atPosition.length === 0) {
      needs[position] = 10
      continue
    }
    const avgOvr =
      atPosition.reduce((sum, player) => sum + player.ratings.overall, 0) /
      atPosition.length
    needs[position] = Math.max(0, Math.round(75 - avgOvr))
  }

  return needs
}

export function scoreFreeAgentForTeam(
  player: Player,
  team: TeamWithRoster,
  mode: TeamMode,
  expectedOffer: number,
  fairSalary: number
): number {
  const needs = getPositionNeeds(team)
  let score = calculatePlayerValue(player)
  score += needs[player.position] ?? 0
  score += getPlayerRoleNeedBonus(team.players, player)

  switch (mode) {
    case "selling":
      score += (player.ratings.potential - player.ratings.overall) * 0.6
      if (player.age > 28) {
        score -= 8
      }
      if (player.age <= 24) {
        score += 4
      }
      break
    case "buying":
      score += (needs[player.position] ?? 0) * 0.5
      score += player.ratings.overall * 0.1
      break
    case "contending":
      if (player.age >= 27 && player.age <= 32) {
        score += 3
      }
      if ((needs[player.position] ?? 0) >= 8) {
        score += 5
      }
      break
  }

  if (expectedOffer > fairSalary) {
    score -= (expectedOffer - fairSalary) * 0.5
  }

  return score
}

export function selectFreeAgentTarget(
  freeAgentPool: Player[],
  _team: TeamWithRoster,
  _mode: TeamMode,
  scoreFn: (player: Player) => number
): Player | undefined {
  if (freeAgentPool.length === 0) {
    return undefined
  }

  return [...freeAgentPool].sort((a, b) => scoreFn(b) - scoreFn(a))[0]
}
