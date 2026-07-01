import type { Game, ScheduleGame, SeasonState } from "@workspace/shared/types"

export function teamAbbrev(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.abbrev ?? teamId
}

export function teamName(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.name ?? teamId
}

export function getTeamById(state: SeasonState, teamId: string) {
  return state.teams.find((team) => team.id === teamId)
}

export function winPct(wins: number, losses: number): string {
  const games = wins + losses
  if (games === 0) {
    return ".000"
  }

  return (wins / games).toFixed(3).replace(/^0/, "")
}

export function formatStreak(streak: number): string {
  if (streak > 0) {
    return `W${streak}`
  }
  if (streak < 0) {
    return `L${Math.abs(streak)}`
  }
  return "-"
}

export function formatGameLine(state: SeasonState, game: Game): string {
  const home = teamAbbrev(state, game.homeTeamId)
  const away = teamAbbrev(state, game.awayTeamId)
  return `Day ${game.day}: ${away} @ ${home} — ${game.result.awayScore}-${game.result.homeScore}`
}

export function formatScheduledLine(state: SeasonState, game: ScheduleGame): string {
  const home = teamAbbrev(state, game.homeTeamId)
  const away = teamAbbrev(state, game.awayTeamId)
  return `${away} @ ${home}`
}
