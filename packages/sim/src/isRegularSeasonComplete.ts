import type { SeasonState } from "@workspace/shared/types"

export function isRegularSeasonComplete(state: SeasonState): boolean {
  const regularGames = state.schedule.filter((game) => !game.seriesId)

  if (regularGames.length === 0) {
    return false
  }

  return regularGames.every((game) => game.status === "final")
}
