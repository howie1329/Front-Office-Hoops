import type { SeasonState } from "@workspace/shared/types"

import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import { advanceInjuriesForDay, applyPostGameInjuries } from "./injuries"
import { createRng } from "./rng"
import { simulateGame } from "./simulateGame"

export function simulateRegularDay(
  state: SeasonState,
  day: number = state.currentDay
): SeasonState {
  const teamsAfterRecovery = advanceInjuriesForDay(state.teams)
  const stateWithRecoveredPlayers = {
    ...state,
    teams: teamsAfterRecovery,
  }
  const scheduledGames = state.schedule.filter(
    (game) => !game.seriesId && game.day === day && game.status === "scheduled"
  )

  if (scheduledGames.length === 0) {
    return {
      ...stateWithRecoveredPlayers,
      currentDay: day + 1,
      standings: deriveStandings(
        stateWithRecoveredPlayers.teams,
        state.games,
        state.season
      ),
      playerSeasonStats: derivePlayerSeasonStats(
        stateWithRecoveredPlayers.teams,
        state.games,
        state.season
      ),
    }
  }

  const newGames = [...state.games]
  const newSchedule = state.schedule.map((entry) => ({ ...entry }))
  let teams = stateWithRecoveredPlayers.teams

  for (const scheduledGame of scheduledGames) {
    const home = teams.find((team) => team.id === scheduledGame.homeTeamId)
    const away = teams.find((team) => team.id === scheduledGame.awayTeamId)

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
    teams = applyPostGameInjuries(
      teams,
      {
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePlayerStats: game.result.homePlayerStats,
        awayPlayerStats: game.result.awayPlayerStats,
      },
      createRng(`${state.baseSeed}:injuries:${game.id}`)
    )

    const scheduleIndex = newSchedule.findIndex(
      (entry) => entry.id === scheduledGame.id
    )
    if (scheduleIndex >= 0) {
      newSchedule[scheduleIndex] = {
        ...newSchedule[scheduleIndex]!,
        status: "final",
        gameId: game.id,
      }
    }
  }

  const nextState: SeasonState = {
    ...stateWithRecoveredPlayers,
    teams,
    schedule: newSchedule,
    games: newGames,
    currentDay: day + 1,
    standings: [],
    playerSeasonStats: [],
  }

  return {
    ...nextState,
    standings: deriveStandings(
      nextState.teams,
      nextState.games,
      nextState.season
    ),
    playerSeasonStats: derivePlayerSeasonStats(
      nextState.teams,
      nextState.games,
      nextState.season
    ),
  }
}
