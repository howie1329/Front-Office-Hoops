import type { PlayoffSeries, SeasonState } from "@workspace/shared/types"

import { derivePlayerSeasonStats } from "../derivePlayerSeasonStats"
import { deriveStandings } from "../deriveStandings"
import { applyPostGameInjuries } from "../injuries"
import { createRng } from "../rng"
import { simulateGame } from "../simulateGame"
import {
  getPlayoffFormat,
  getSeriesLoserId,
  getSeriesWinnerId,
  isSeriesComplete,
} from "./playoffConfig"
import { scheduleNextSeriesGame } from "./createPlayoffSchedule"

function getTeamById(state: SeasonState, teamId: string) {
  return state.teams.find((team) => team.id === teamId)
}

function finalizeSeriesIfComplete(
  series: PlayoffSeries,
  teamCount: number
): PlayoffSeries {
  const format = getPlayoffFormat(teamCount)

  if (!isSeriesComplete(series, format)) {
    return series
  }

  return {
    ...series,
    winnerId: getSeriesWinnerId(series),
    loserId: getSeriesLoserId(series),
  }
}

export function simulateSeriesGame(
  state: SeasonState,
  scheduledGameId: string
): SeasonState {
  const scheduledGame = state.schedule.find(
    (game) => game.id === scheduledGameId
  )

  if (!scheduledGame?.seriesId) {
    return state
  }

  const bracket = state.playoffBracket
  if (!bracket) {
    return state
  }

  const seriesIndex = bracket.series.findIndex(
    (series) => series.id === scheduledGame.seriesId
  )

  if (seriesIndex < 0) {
    return state
  }

  const series = bracket.series[seriesIndex]!
  const format = getPlayoffFormat(state.teams.length)

  if (isSeriesComplete(series, format)) {
    return state
  }

  const home = getTeamById(state, scheduledGame.homeTeamId)
  const away = getTeamById(state, scheduledGame.awayTeamId)

  if (!home || !away) {
    return state
  }

  const gameId = `g_${state.season}_${scheduledGame.id}`
  const game = simulateGame(home, away, {
    season: state.season,
    day: scheduledGame.day,
    gameId,
    baseSeed: state.baseSeed,
  })

  const homeIsHigher = scheduledGame.homeTeamId === series.higherSeedTeamId
  const homeWon = game.result.winnerId === scheduledGame.homeTeamId

  let updatedSeries: PlayoffSeries = {
    ...series,
    winsHigher:
      series.winsHigher +
      (homeIsHigher && homeWon ? 1 : 0) +
      (!homeIsHigher && !homeWon ? 1 : 0),
    winsLower:
      series.winsLower +
      (!homeIsHigher && homeWon ? 1 : 0) +
      (homeIsHigher && !homeWon ? 1 : 0),
  }

  updatedSeries = finalizeSeriesIfComplete(updatedSeries, state.teams.length)

  const newSchedule = state.schedule.map((entry) =>
    entry.id === scheduledGame.id
      ? { ...entry, status: "final" as const, gameId: game.id }
      : entry
  )

  const newSeries = [...bracket.series]
  newSeries[seriesIndex] = updatedSeries

  let nextState: SeasonState = {
    ...state,
    teams: applyPostGameInjuries(
      state.teams,
      {
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePlayerStats: game.result.homePlayerStats,
        awayPlayerStats: game.result.awayPlayerStats,
      },
      createRng(`${state.baseSeed}:injuries:${game.id}`)
    ),
    schedule: newSchedule,
    games: [...state.games, game],
    playoffBracket: {
      ...bracket,
      series: newSeries,
    },
    standings: [],
    playerSeasonStats: [],
  }

  if (!isSeriesComplete(updatedSeries, format)) {
    const nextGame = scheduleNextSeriesGame(nextState, updatedSeries)
    if (nextGame) {
      nextState = {
        ...nextState,
        schedule: [...nextState.schedule, nextGame],
      }
    }
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
