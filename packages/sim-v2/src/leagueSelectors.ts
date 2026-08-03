import type {
  GamePlayerBoxScore,
  LeagueDocument,
  LeagueEvent,
  LeagueGameRecord,
  LeaguePlayerAvailability,
  PlayerSeasonProduction,
  UniversalPlayerValue,
} from "@workspace/domain-v2"

export type PlayerGameHistoryEntry = {
  scheduleId: string
  season: number
  date: string
  kind: LeagueGameRecord["kind"]
  boxScore: GamePlayerBoxScore
  opponentTeamId: string
  won: boolean
}

export function getCompletedGames(league: LeagueDocument): LeagueGameRecord[] {
  return [...(league.optionalData?.games ?? [])].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.scheduleId.localeCompare(right.scheduleId)
  )
}

export function getCompletedGamesForTeam(
  league: LeagueDocument,
  teamId: string
): LeagueGameRecord[] {
  return getCompletedGames(league).filter(
    (game) =>
      game.result.homeTeamId === teamId || game.result.awayTeamId === teamId
  )
}

export function getCompletedGamesForPlayer(
  league: LeagueDocument,
  playerId: string
): LeagueGameRecord[] {
  return getCompletedGames(league).filter(
    (game) => playerId in game.result.players
  )
}

export function getPlayerGameHistory(
  league: LeagueDocument,
  playerId: string
): PlayerGameHistoryEntry[] {
  return getCompletedGamesForPlayer(league, playerId).flatMap((game) => {
    const boxScore = game.result.players[playerId]
    if (!boxScore) return []
    const opponentTeamId =
      boxScore.teamId === game.result.homeTeamId
        ? game.result.awayTeamId
        : game.result.homeTeamId
    return [
      {
        scheduleId: game.scheduleId,
        season: game.season,
        date: game.date,
        kind: game.kind,
        boxScore,
        opponentTeamId,
        won: game.result.winnerTeamId === boxScore.teamId,
      },
    ]
  })
}

export function getCurrentSeasonPlayerProduction(
  league: LeagueDocument,
  playerId: string
): PlayerSeasonProduction | null {
  return league.projections.currentSeason?.playerProduction[playerId] ?? null
}

export function getCurrentSeasonPlayerValue(
  league: LeagueDocument,
  playerId: string
): UniversalPlayerValue | null {
  return league.projections.currentSeason?.values[playerId] ?? null
}

export function getRecentLeagueEvents(
  league: LeagueDocument,
  limit = 20
): LeagueEvent[] {
  return [...league.history.events].slice(-Math.max(0, limit)).reverse()
}

export function getPlayerAvailability(
  league: LeagueDocument,
  playerId: string
): LeaguePlayerAvailability {
  return (
    league.state.availability?.[playerId] ?? {
      available: true,
      gamesRemaining: 0,
      restriction: "none",
      gamesMissed: 0,
    }
  )
}
