import type {
  Player,
  PlayerSeasonProfile,
  SeasonHistoryEntry,
  TeamFinancials,
  TeamWithRoster,
} from "@workspace/shared/types"

export type CultureScoreInput = {
  team: TeamWithRoster
  teamFinancials?: TeamFinancials
  seasonHistory: SeasonHistoryEntry[]
  priorSeason: number
}

export type CultureScoreBreakdown = {
  score: number
  veteranStrength: number
  winningScore: number
  stabilityScore: number
  coachingScore: number
  developmentScore: number
}

export function computeCultureScore(
  input: CultureScoreInput,
): CultureScoreBreakdown {
  const { team, teamFinancials, seasonHistory, priorSeason } = input

  const veterans = team.players.filter((player) => player.age >= 30)
  const veteranStrength = Math.min(
    1,
    veterans.reduce((sum, player) => sum + player.ratings.overall / 90, 0) / 4,
  )

  const recentHistory = seasonHistory
    .filter((entry) => entry.season >= priorSeason - 1)
    .slice(-2)

  let winningScore = 0
  for (const entry of recentHistory) {
    if (entry.championTeamId === team.id) {
      winningScore += 0.5
    } else if (entry.runnerUpTeamId === team.id) {
      winningScore += 0.3
    } else {
      const standing = entry.standings.find((s) => s.teamId === team.id)
      const sorted = [...entry.standings].sort((a, b) => {
        const winPctA = a.wins / Math.max(1, a.wins + a.losses)
        const winPctB = b.wins / Math.max(1, b.wins + b.losses)
        return winPctB - winPctA
      })
      const standingIndex = sorted.findIndex((s) => s.teamId === team.id)
      if (standing && standingIndex >= 0 && standingIndex < 4) {
        winningScore += 0.15
      }
    }
  }
  winningScore = Math.min(1, winningScore)

  const rosterSize = Math.max(1, team.players.length)
  const stablePlayers = team.players.filter((p) => p.seasonsWithTeam >= 2).length
  const stabilityScore = stablePlayers / rosterSize

  const coachingLevel = teamFinancials?.coachingLevel ?? 5
  const developmentLevel = teamFinancials?.developmentLevel ?? 5
  const coachingScore = (coachingLevel - 1) / 9
  const developmentScore = (developmentLevel - 1) / 9

  const score = Math.round(
    (veteranStrength * 0.25 +
      winningScore * 0.2 +
      stabilityScore * 0.15 +
      coachingScore * 0.2 +
      developmentScore * 0.2) *
      100,
  )

  return {
    score,
    veteranStrength,
    winningScore,
    stabilityScore,
    coachingScore,
    developmentScore,
  }
}

export function cultureGrowthMultiplier(score: number): number {
  return 0.85 + (score / 100) * 0.3
}

export function cultureRegressionMultiplier(score: number): number {
  return 1.15 - (score / 100) * 0.3
}

export function updateInjuryHistoryFromProfile(
  player: Player,
  profile: PlayerSeasonProfile | undefined,
  season: number,
  hadMajorInjury: boolean,
): Player["injuryHistory"] {
  const history = player.injuryHistory ?? {
    totalGamesMissed: 0,
    majorInjuryCount: 0,
    lastMajorInjurySeason: null,
  }

  const gamesMissed = profile?.gamesMissed ?? 0

  return {
    totalGamesMissed: history.totalGamesMissed + gamesMissed,
    majorInjuryCount: history.majorInjuryCount + (hadMajorInjury ? 1 : 0),
    lastMajorInjurySeason: hadMajorInjury
      ? season
      : history.lastMajorInjurySeason,
  }
}

export function hadMajorInjurySeason(
  profile: PlayerSeasonProfile | undefined,
  player: Player,
): boolean {
  if (!profile) return false
  const missedRatio =
    profile.gamesMissed / Math.max(1, profile.gp + profile.gamesMissed)
  return (
    missedRatio >= 0.35 ||
    (player.injury?.type === "major" && profile.gamesMissed >= 15)
  )
}
