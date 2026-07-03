import type { TeamMode } from "@workspace/shared/financialTypes"
import type { Player } from "@workspace/shared/types"

function upsideValue(player: Player): number {
  const upside = Math.max(0, player.ratings.potential - player.ratings.overall)
  if (player.age <= 21) {
    return upside * 0.65
  }
  if (player.age <= 24) {
    return upside * 0.45
  }
  if (player.age <= 27) {
    return upside * 0.2
  }
  return 0
}

function ageRisk(player: Player): number {
  if (player.age <= 29) {
    return 0
  }
  if (player.ratings.overall >= 78) {
    return Math.max(0, player.age - 32) * 0.8
  }
  return Math.max(0, player.age - 29) * 1.5
}

export function calculatePlayerValue(player: Player): number {
  return player.ratings.overall + upsideValue(player) - ageRisk(player)
}

export function calculateContractValue(player: Player): number {
  const currentValue = player.ratings.overall * 0.9
  const upside = upsideValue(player) * 0.45
  const risk = ageRisk(player) * 1.4
  return currentValue + upside - risk
}

export function calculateRosterKeepValue(
  player: Player,
  mode: TeamMode
): number {
  const currentValue = player.ratings.overall
  const upside = Math.max(0, player.ratings.potential - player.ratings.overall)

  switch (mode) {
    case "selling":
      return currentValue * 0.75 + upside * 0.8 - ageRisk(player)
    case "buying":
      return currentValue + upside * 0.25 - ageRisk(player) * 0.7
    case "contending":
      return currentValue * 1.1 - Math.max(0, player.age - 33)
  }
}
