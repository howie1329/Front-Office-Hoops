import type { Player } from "@workspace/shared/types"

export function playerName(players: Player[], playerId: string): string {
  const player = players.find((entry) => entry.id === playerId)
  return player ? `${player.firstName} ${player.lastName}` : playerId
}
