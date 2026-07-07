import type {
  Game,
  PlayerGameStats,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

function compareGames(a: Game, b: Game): number {
  if (a.day !== b.day) {
    return a.day - b.day
  }

  return a.id.localeCompare(b.id)
}

function createEmptyPlayerSeasonStats(
  playerId: string,
  teamId: string,
  season: number,
): PlayerSeasonStats {
  return {
    id: `pss_${season}_${playerId}`,
    playerId,
    teamId,
    season,
    gp: 0,
    gs: 0,
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  }
}

function applyPlayerGameLine(
  statsByPlayer: Map<string, PlayerSeasonStats>,
  line: PlayerGameStats,
  season: number,
): void {
  let stats = statsByPlayer.get(line.playerId)

  if (!stats) {
    stats = createEmptyPlayerSeasonStats(line.playerId, line.teamId, season)
    statsByPlayer.set(line.playerId, stats)
  }

  stats.gp += 1
  stats.gs += line.starter ? 1 : 0
  stats.min += line.minutes
  stats.pts += line.pts
  stats.reb += line.reb
  stats.ast += line.ast
  stats.stl += line.stl
  stats.blk += line.blk
  stats.tov += line.tov
  stats.fgm += line.fgm
  stats.fga += line.fga
  stats.tpm += line.tpm
  stats.tpa += line.tpa
  stats.ftm += line.ftm
  stats.fta += line.fta
}

export function sortPlayerSeasonStats(
  stats: PlayerSeasonStats[],
): PlayerSeasonStats[] {
  return [...stats].sort((a, b) => {
    if (b.pts !== a.pts) {
      return b.pts - a.pts
    }

    return a.playerId.localeCompare(b.playerId)
  })
}

export function derivePlayerSeasonStats(
  _teams: TeamWithRoster[],
  games: Game[],
  season: number,
): PlayerSeasonStats[] {
  const statsByPlayer = new Map<string, PlayerSeasonStats>()
  const sortedGames = [...games]
    .filter((game) => game.gameType !== "exhibition")
    .sort(compareGames)

  for (const game of sortedGames) {
    for (const line of game.result.homePlayerStats) {
      applyPlayerGameLine(statsByPlayer, line, season)
    }

    for (const line of game.result.awayPlayerStats) {
      applyPlayerGameLine(statsByPlayer, line, season)
    }
  }

  return sortPlayerSeasonStats([...statsByPlayer.values()])
}
