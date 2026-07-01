import { ROTATION_SIZE, TEAM_MINUTES } from "@workspace/shared/constants"
import type { Player, RotationEntry } from "@workspace/shared/types"

const STARTER_MINUTES = [34, 33, 32, 31, 30]
const BENCH_MINUTES = [24, 22, 20]

export function selectRotation(players: Player[]): RotationEntry[] {
  const activePlayers = players
    .filter((player) => player.status === "active")
    .sort((a, b) => b.ratings.overall - a.ratings.overall)
    .slice(0, ROTATION_SIZE)

  if (activePlayers.length === 0) {
    return []
  }

  const minutesTemplate = [
    ...STARTER_MINUTES.slice(0, Math.min(5, activePlayers.length)),
    ...BENCH_MINUTES.slice(0, Math.max(0, activePlayers.length - 5)),
  ]

  const rotation = activePlayers.map((player, index) => ({
    player,
    minutes: minutesTemplate[index] ?? 18,
  }))

  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0)
  const lastEntry = rotation[rotation.length - 1]

  if (lastEntry) {
    lastEntry.minutes += TEAM_MINUTES - totalMinutes
  }

  return rotation
}
