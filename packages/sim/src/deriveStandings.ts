import type { Game, Standing, TeamWithRoster } from "@workspace/shared/types"

function createEmptyStanding(teamId: string, season: number): Standing {
  return {
    teamId,
    season,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    streak: 0,
  }
}

function compareGames(a: Game, b: Game): number {
  if (a.day !== b.day) {
    return a.day - b.day
  }

  return a.id.localeCompare(b.id)
}

function applyGameResult(
  standingsByTeam: Map<string, Standing>,
  game: Game,
): void {
  const home = standingsByTeam.get(game.homeTeamId)
  const away = standingsByTeam.get(game.awayTeamId)

  if (!home || !away) {
    return
  }

  const { result } = game
  home.pointsFor += result.homeScore
  home.pointsAgainst += result.awayScore
  away.pointsFor += result.awayScore
  away.pointsAgainst += result.homeScore

  if (result.winnerId === game.homeTeamId) {
    home.wins += 1
    away.losses += 1
    home.streak = home.streak >= 0 ? home.streak + 1 : 1
    away.streak = away.streak <= 0 ? away.streak - 1 : -1
    return
  }

  away.wins += 1
  home.losses += 1
  away.streak = away.streak >= 0 ? away.streak + 1 : 1
  home.streak = home.streak <= 0 ? home.streak - 1 : -1
}

export function sortStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) => {
    const gamesA = a.wins + a.losses
    const gamesB = b.wins + b.losses
    const winPctA = gamesA === 0 ? 0 : a.wins / gamesA
    const winPctB = gamesB === 0 ? 0 : b.wins / gamesB

    if (winPctB !== winPctA) {
      return winPctB - winPctA
    }

    const diffA = a.pointsFor - a.pointsAgainst
    const diffB = b.pointsFor - b.pointsAgainst

    return diffB - diffA
  })
}

export function deriveStandings(
  teams: TeamWithRoster[],
  games: Game[],
  season: number,
): Standing[] {
  const standingsByTeam = new Map<string, Standing>(
    teams.map((team) => [team.id, createEmptyStanding(team.id, season)]),
  )

  const sortedGames = [...games]
    .filter((game) => game.gameType !== "exhibition")
    .sort(compareGames)

  for (const game of sortedGames) {
    applyGameResult(standingsByTeam, game)
  }

  return sortStandings([...standingsByTeam.values()])
}
