import type { PlayoffSeries, ScheduleGame, SeasonState } from "@workspace/shared/types"

import {
  countSeriesGamesPlayed,
  getPlayoffFormat,
  isHigherSeedHome,
} from "./playoffConfig"

function getLastScheduleDay(state: SeasonState): number {
  if (state.schedule.length === 0) {
    return state.currentDay
  }

  return Math.max(...state.schedule.map((game) => game.day))
}

function getMatchupForSeriesGame(
  series: PlayoffSeries,
  gameNumber: number,
  format: ReturnType<typeof getPlayoffFormat>,
): { homeTeamId: string; awayTeamId: string } {
  const higherHome = isHigherSeedHome(gameNumber, format)

  return higherHome
    ? {
        homeTeamId: series.higherSeedTeamId,
        awayTeamId: series.lowerSeedTeamId,
      }
    : {
        homeTeamId: series.lowerSeedTeamId,
        awayTeamId: series.higherSeedTeamId,
      }
}

export function createSeriesScheduleGame(
  state: SeasonState,
  series: PlayoffSeries,
  day: number,
): ScheduleGame {
  const format = getPlayoffFormat(state.teams.length)
  const gameNumber = countSeriesGamesPlayed(series) + 1
  const matchup = getMatchupForSeriesGame(series, gameNumber, format)

  return {
    id: `sg_${state.season}_po_${series.id}_g${gameNumber}`,
    season: state.season,
    day,
    homeTeamId: matchup.homeTeamId,
    awayTeamId: matchup.awayTeamId,
    status: "scheduled",
    gameType: "playoff",
    seriesId: series.id,
    playoffRound: series.round,
  }
}

export function scheduleNextSeriesGame(
  state: SeasonState,
  series: PlayoffSeries,
): ScheduleGame | null {
  const format = getPlayoffFormat(state.teams.length)
  const gamesPlayed = countSeriesGamesPlayed(series)

  if (gamesPlayed >= format.seriesLength) {
    return null
  }

  const existingScheduled = state.schedule.find(
    (game) => game.seriesId === series.id && game.status === "scheduled",
  )

  if (existingScheduled) {
    return null
  }

  const day = getLastScheduleDay(state) + 1
  return createSeriesScheduleGame(state, series, day)
}

export function scheduleInitialPlayoffGames(
  state: SeasonState,
  seriesList: PlayoffSeries[],
): ScheduleGame[] {
  let day = getLastScheduleDay(state) + 1
  const games: ScheduleGame[] = []

  for (const series of seriesList) {
    const game = createSeriesScheduleGame(state, series, day)
    games.push(game)
    day += 1
  }

  return games
}

export function getPlayoffStartDay(state: SeasonState): number {
  const playoffGames = state.schedule.filter((game) => game.seriesId)
  if (playoffGames.length === 0) {
    return getLastScheduleDay(state) + 1
  }

  return Math.min(...playoffGames.map((game) => game.day))
}
