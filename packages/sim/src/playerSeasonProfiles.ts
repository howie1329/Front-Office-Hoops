import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonProfileRole,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function estimateScheduledGames(teams: TeamWithRoster[], gamesPlayed: number): number {
  if (teams.length === 0) {
    return gamesPlayed
  }

  return Math.max(0, Math.floor((gamesPlayed * 2) / teams.length))
}

function roleFromStats(stats: PlayerSeasonStats | undefined): PlayerSeasonProfileRole {
  if (!stats || stats.gp === 0) {
    return "inactive"
  }

  const mpg = stats.min / stats.gp
  const startRate = stats.gs / stats.gp

  if (mpg >= 32 && startRate >= 0.7) {
    return "star"
  }
  if (mpg >= 24 && startRate >= 0.5) {
    return "starter"
  }
  if (mpg >= 20) {
    return "sixth_man"
  }
  if (mpg >= 10) {
    return "rotation"
  }
  return "bench"
}

function usageEstimate(stats: PlayerSeasonStats | undefined): number {
  if (!stats || stats.min === 0) {
    return 0
  }

  return roundOne(((stats.fga + 0.44 * stats.fta + stats.tov) / stats.min) * 36)
}

function createProfile(
  player: Player,
  teamId: string,
  season: number,
  scheduledGames: number,
  stats?: PlayerSeasonStats,
): PlayerSeasonProfile {
  const gp = stats?.gp ?? 0
  const totalMinutes = stats?.min ?? 0

  return {
    id: `psp_${season}_${player.id}`,
    playerId: player.id,
    teamId,
    season,
    gp,
    gs: stats?.gs ?? 0,
    totalMinutes,
    mpg: gp > 0 ? roundOne(totalMinutes / gp) : 0,
    primaryRole: roleFromStats(stats),
    gamesMissed: Math.max(0, scheduledGames - gp),
    usageRateEstimate: usageEstimate(stats),
  }
}

export function derivePlayerSeasonProfiles(
  teams: TeamWithRoster[],
  playerSeasonStats: PlayerSeasonStats[],
  gamesPlayed: number,
  season: number,
): PlayerSeasonProfile[] {
  const statsByPlayer = new Map(
    playerSeasonStats
      .filter((entry) => entry.season === season)
      .map((entry) => [entry.playerId, entry]),
  )
  const scheduledGames = estimateScheduledGames(teams, gamesPlayed)

  return teams.flatMap((team) =>
    team.players.map((player) =>
      createProfile(
        player,
        team.id,
        season,
        scheduledGames,
        statsByPlayer.get(player.id),
      ),
    ),
  )
}
