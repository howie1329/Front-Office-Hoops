import type { Game, TeamMomentumState } from "@workspace/shared/types"
import { DEFAULT_TEAM_MOMENTUM } from "@workspace/shared/types"

export const MOMENTUM_WINDOW = 5

export function computeTeamMomentum(
  teamId: string,
  games: Game[],
  season: number,
): TeamMomentumState {
  const recent = games
    .filter(
      (game) =>
        game.season === season &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId),
    )
    .slice(-MOMENTUM_WINDOW)

  if (recent.length === 0) {
    return { ...DEFAULT_TEAM_MOMENTUM }
  }

  let netSum = 0

  for (const game of recent) {
    const isHome = game.homeTeamId === teamId
    const teamScore = isHome ? game.result.homeScore : game.result.awayScore
    const oppScore = isHome ? game.result.awayScore : game.result.homeScore
    const possessions = isHome
      ? game.result.meta.homePossessions
      : game.result.meta.awayPossessions
    const oppPossessions = isHome
      ? game.result.meta.awayPossessions
      : game.result.meta.homePossessions

    const offRtg = possessions > 0 ? (teamScore / possessions) * 100 : 0
    const defRtg = oppPossessions > 0 ? (oppScore / oppPossessions) * 100 : 0
    netSum += offRtg - defRtg
  }

  return {
    rollingNetRtg: netSum / recent.length,
    sampleSize: recent.length,
  }
}

export function momentumEfficiencyModifier(
  state: TeamMomentumState | undefined,
  streak: number,
): number {
  const rolling = state?.rollingNetRtg ?? 0
  let modifier = (rolling / 5) * 0.003

  if (streak >= 3) {
    modifier += 0.005
  } else if (streak <= -3) {
    modifier -= 0.005
  }

  return Math.max(-0.03, Math.min(0.03, modifier))
}

export function updateTeamMomentumMap(
  teamMomentum: Record<string, TeamMomentumState> | undefined,
  teamIds: string[],
  games: Game[],
  season: number,
): Record<string, TeamMomentumState> {
  const next = { ...(teamMomentum ?? {}) }

  for (const teamId of teamIds) {
    next[teamId] = computeTeamMomentum(teamId, games, season)
  }

  return next
}
