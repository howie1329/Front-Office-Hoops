import {
  PLAYOFF_SERIES_LENGTH,
  PLAYOFF_WINS_TO_ADVANCE,
  SIX_TEAM_PLAYOFF_SERIES_LENGTH,
  SIX_TEAM_PLAYOFF_WINS_TO_ADVANCE,
} from "@workspace/shared/constants"

export type PlayoffFormat = {
  seriesLength: number
  winsToAdvance: number
}

export function getPlayoffFormat(teamCount: number): PlayoffFormat {
  if (teamCount === 30) {
    return {
      seriesLength: PLAYOFF_SERIES_LENGTH,
      winsToAdvance: PLAYOFF_WINS_TO_ADVANCE,
    }
  }

  if (teamCount === 6) {
    return {
      seriesLength: SIX_TEAM_PLAYOFF_SERIES_LENGTH,
      winsToAdvance: SIX_TEAM_PLAYOFF_WINS_TO_ADVANCE,
    }
  }

  throw new Error(`Unsupported playoff format for ${teamCount} teams`)
}

export function isHigherSeedHome(gameNumber: number, format: PlayoffFormat): boolean {
  if (format.seriesLength === 7) {
    const pattern = [true, true, false, false, true, false, true]
    return pattern[gameNumber - 1] ?? true
  }

  if (format.seriesLength === 3) {
    return gameNumber !== 2
  }

  return gameNumber % 2 === 1
}

export function countSeriesGamesPlayed(series: {
  winsHigher: number
  winsLower: number
}): number {
  return series.winsHigher + series.winsLower
}

export function isSeriesComplete(
  series: { winsHigher: number; winsLower: number },
  format: PlayoffFormat,
): boolean {
  return (
    series.winsHigher >= format.winsToAdvance ||
    series.winsLower >= format.winsToAdvance
  )
}

export function getSeriesWinnerId(series: {
  higherSeedTeamId: string
  lowerSeedTeamId: string
  winsHigher: number
  winsLower: number
}): string | undefined {
  if (series.winsHigher > series.winsLower) {
    return series.higherSeedTeamId
  }
  if (series.winsLower > series.winsHigher) {
    return series.lowerSeedTeamId
  }
  return undefined
}

export function getSeriesLoserId(series: {
  higherSeedTeamId: string
  lowerSeedTeamId: string
  winsHigher: number
  winsLower: number
}): string | undefined {
  const winnerId = getSeriesWinnerId(series)
  if (!winnerId) {
    return undefined
  }

  return winnerId === series.higherSeedTeamId
    ? series.lowerSeedTeamId
    : series.higherSeedTeamId
}
