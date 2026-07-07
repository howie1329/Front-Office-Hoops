import type { SeasonState } from "@workspace/shared/types"

export function isPreseasonComplete(state: SeasonState): boolean {
  const exhibitionGames = state.schedule.filter(
    (game) => game.gameType === "exhibition",
  )

  if (exhibitionGames.length === 0) {
    return false
  }

  return exhibitionGames.every((game) => game.status === "final")
}

export function hasRemainingExhibitions(state: SeasonState): boolean {
  return state.schedule.some(
    (game) => game.gameType === "exhibition" && game.status === "scheduled",
  )
}
