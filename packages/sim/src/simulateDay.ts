import type { SeasonState } from "@workspace/shared/types"

import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import { simulateGame } from "./simulateGame"

function getTeamById(state: SeasonState, teamId: string) {
  return state.teams.find((team) => team.id === teamId)
}

export function simulateDay(
  state: SeasonState,
  day: number = state.currentDay,
): SeasonState {
  const scheduledGames = state.schedule.filter(
    (game) => game.day === day && game.status === "scheduled",
  )

  if (scheduledGames.length === 0) {
    return {
      ...state,
      currentDay: day + 1,
      standings: deriveStandings(state.teams, state.games, state.season),
      playerSeasonStats: derivePlayerSeasonStats(
        state.teams,
        state.games,
        state.season,
      ),
    }
  }

  const newGames = [...state.games]
  const newSchedule = state.schedule.map((entry) => ({ ...entry }))

  for (const scheduledGame of scheduledGames) {
    const home = getTeamById(state, scheduledGame.homeTeamId)
    const away = getTeamById(state, scheduledGame.awayTeamId)

    if (!home || !away) {
      continue
    }

    const gameId = `g_${state.season}_${scheduledGame.id}`
    const game = simulateGame(home, away, {
      season: state.season,
      day: scheduledGame.day,
      gameId,
      baseSeed: state.baseSeed,
    })

    newGames.push(game)

    const scheduleIndex = newSchedule.findIndex((entry) => entry.id === scheduledGame.id)
    if (scheduleIndex >= 0) {
      newSchedule[scheduleIndex] = {
        ...newSchedule[scheduleIndex]!,
        status: "final",
        gameId: game.id,
      }
    }
  }

  const nextState: SeasonState = {
    ...state,
    schedule: newSchedule,
    games: newGames,
    currentDay: day + 1,
    standings: [],
    playerSeasonStats: [],
  }

  return {
    ...nextState,
    standings: deriveStandings(nextState.teams, nextState.games, nextState.season),
    playerSeasonStats: derivePlayerSeasonStats(
      nextState.teams,
      nextState.games,
      nextState.season,
    ),
  }
}
