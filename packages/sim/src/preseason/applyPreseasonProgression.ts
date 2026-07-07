import type {
  PlayerDevelopmentRecord,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  RetirementEntry,
  SeasonHistoryEntry,
  TeamFinancials,
  TeamWithRoster,
} from "@workspace/shared/types"

import { deriveTeamOverall, recalculatePlayerRatings } from "../playerRatings"
import { buildPreseasonDevelopmentReport } from "../development/buildDevelopmentReport"
import { computeCultureScore } from "../development/cultureScore"
import { progressPlayer } from "../development/progressPlayer"

export type PreseasonProgressionInput = {
  teams: TeamWithRoster[]
  priorSeason: number
  newSeason: number
  playerSeasonStats: PlayerSeasonStats[]
  playerSeasonProfiles: PlayerSeasonProfile[]
  baseSeed: string
  teamFinancials?: TeamFinancials[]
  seasonHistory?: SeasonHistoryEntry[]
}

export type PreseasonProgressionResult = {
  teams: TeamWithRoster[]
  records: PlayerDevelopmentRecord[]
  report: ReturnType<typeof buildPreseasonDevelopmentReport>
  retirements: RetirementEntry[]
}

export function applyPreseasonProgression(
  input: PreseasonProgressionInput,
): PreseasonProgressionResult {
  const {
    teams,
    priorSeason,
    newSeason,
    playerSeasonStats,
    playerSeasonProfiles,
    baseSeed,
    teamFinancials = [],
    seasonHistory = [],
  } = input

  const financialsByTeam = new Map(
    teamFinancials.map((entry) => [entry.teamId, entry]),
  )

  const records: PlayerDevelopmentRecord[] = []
  const retirements: RetirementEntry[] = []

  const progressedTeams = teams.map((team) => {
    const teamFinancialsEntry = financialsByTeam.get(team.id)
    const culture = computeCultureScore({
      team,
      teamFinancials: teamFinancialsEntry,
      seasonHistory,
      priorSeason,
    })

    const progressedPlayers = team.players
      .map((player) => {
        const result = progressPlayer({
          player,
          team,
          priorSeason,
          newSeason,
          playerSeasonStats,
          playerSeasonProfiles,
          baseSeed,
          cultureScore: culture.score,
          coachingLevel: teamFinancialsEntry?.coachingLevel,
          developmentLevel: teamFinancialsEntry?.developmentLevel,
        })

        records.push(result.record)

        if (result.retirement) {
          retirements.push({
            playerId: player.id,
            season: newSeason,
            age: player.age,
            finalOverall: player.ratings.overall,
            reasons: result.retirement.reasons,
          })
        }

        return result.player
      })
      .filter((player): player is NonNullable<typeof player> => player !== null)

    const players = progressedPlayers.map((player) => ({
      ...player,
      ratings: recalculatePlayerRatings(player, progressedPlayers),
    }))

    return {
      ...team,
      overall: deriveTeamOverall(players),
      players,
    }
  })

  const report = buildPreseasonDevelopmentReport(
    newSeason,
    records,
    retirements,
  )

  return {
    teams: progressedTeams,
    records,
    report,
    retirements,
  }
}

// Backwards-compatible alias
export const applyOffseasonProgression = applyPreseasonProgression
