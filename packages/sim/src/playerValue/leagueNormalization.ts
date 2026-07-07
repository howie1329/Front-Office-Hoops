import type { Player } from "@workspace/shared/types"

export function normalizeLeagueValue(
  value: number,
  players: Player[],
): number {
  const values = players.map((player) => player.ratings.overall)
  if (values.length === 0) {
    return value
  }

  const mean = values.reduce((sum, entry) => sum + entry, 0) / values.length
  const variance =
    values.reduce((sum, entry) => sum + (entry - mean) ** 2, 0) / values.length
  const std = Math.max(1, Math.sqrt(variance))
  return (value - mean) / std
}
