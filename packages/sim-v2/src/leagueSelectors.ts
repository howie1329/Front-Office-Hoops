import type {
  LeagueDocument,
  LeagueEvent,
  LeagueGameRecord,
  LeagueGameKind,
  LeaguePlayerAvailability,
  PlayerContractSummary,
  PlayerGameLogEntry,
  PlayerInformationView,
  PlayerInjuryHistoryEntry,
  PlayerRatingSnapshot,
  PlayerSeasonLog,
  PlayerSeasonProduction,
  PlayerTeamSeasonSplit,
  UniversalPlayerValue,
} from "@workspace/domain-v2"

import { getPlayerCurrentAbility } from "./playerGeneration"
import { getCareerPhase } from "./careerDevelopment"
import { projectTeamFinance } from "./finance"

export type PlayerGameHistoryEntry = PlayerGameLogEntry

export type PlayerGameHistoryFilter = {
  season?: number
  kinds?: LeagueGameKind[]
}

function sortGames(left: LeagueGameRecord, right: LeagueGameRecord): number {
  return (
    left.season - right.season ||
    left.date.localeCompare(right.date) ||
    left.scheduleId.localeCompare(right.scheduleId)
  )
}

export function getCompletedGames(
  league: LeagueDocument,
  filter: PlayerGameHistoryFilter = {}
): LeagueGameRecord[] {
  const seen = new Set<string>()
  const games = [
    ...(league.history.seasonArchives ?? []).flatMap(
      (archive) => archive.games
    ),
    ...(league.optionalData?.games ?? []),
  ]
  return games
    .filter((game) => {
      if (
        game.result.status !== "completed" ||
        (filter.season !== undefined && game.season !== filter.season) ||
        (filter.kinds && !filter.kinds.includes(game.kind))
      ) {
        return false
      }
      const key = `${game.season}:${game.scheduleId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort(sortGames)
}

export function getCompletedGamesForTeam(
  league: LeagueDocument,
  teamId: string,
  filter?: PlayerGameHistoryFilter
): LeagueGameRecord[] {
  return getCompletedGames(league, filter).filter(
    (game) =>
      game.result.homeTeamId === teamId || game.result.awayTeamId === teamId
  )
}

export function getCompletedGamesForPlayer(
  league: LeagueDocument,
  playerId: string,
  filter?: PlayerGameHistoryFilter
): LeagueGameRecord[] {
  return getCompletedGames(league, filter).filter(
    (game) => (game.result.players[playerId]?.minutes ?? 0) > 0
  )
}

export function getPlayerGameHistory(
  league: LeagueDocument,
  playerId: string,
  filter?: PlayerGameHistoryFilter
): PlayerGameHistoryEntry[] {
  return getCompletedGamesForPlayer(league, playerId, filter).flatMap((game) => {
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
        teamId: boxScore.teamId,
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

export function getPlayerSeasonHistory(
  league: LeagueDocument,
  playerId: string
): PlayerSeasonLog[] {
  const archives = (league.history.seasonArchives ?? [])
    .filter((archive) => archive.playerProduction[playerId])
    .map((archive) => {
      const total = archive.playerProduction[playerId]!
      const teamSplits =
        total.teamSplits ??
        (total.teamId
          ? { [total.teamId]: { ...total, teamId: total.teamId } }
          : {})
      return {
        season: archive.season,
        playerId,
        total,
        teamSplits: teamSplits as Record<string, PlayerTeamSeasonSplit>,
        ...(archive.playerValues[playerId]
          ? { value: archive.playerValues[playerId] }
          : {}),
        ...(archive.ratingSnapshots[playerId]
          ? { rating: archive.ratingSnapshots[playerId] }
          : {}),
      }
    })
  const current = getCurrentSeasonPlayerProduction(league, playerId)
  if (current) {
    const teamSplits =
      current.teamSplits ??
      (current.teamId
        ? { [current.teamId]: { ...current, teamId: current.teamId } }
        : {})
    archives.push({
      season: league.state.season,
      playerId,
      total: current,
      teamSplits: teamSplits as Record<string, PlayerTeamSeasonSplit>,
      ...(getCurrentSeasonPlayerValue(league, playerId)
        ? { value: getCurrentSeasonPlayerValue(league, playerId)! }
        : {}),
    })
  }
  return archives.sort((left, right) => left.season - right.season)
}

export function getPlayerRatingHistory(
  league: LeagueDocument,
  playerId: string
): PlayerRatingSnapshot[] {
  const history = (league.history.seasonArchives ?? [])
    .map((archive) => archive.ratingSnapshots[playerId])
    .filter((snapshot): snapshot is PlayerRatingSnapshot => Boolean(snapshot))
  const player = league.entities.players[playerId]
  if (player) {
    history.push({
      season: league.state.season,
      age: player.age,
      overall: getPlayerCurrentAbility(player),
      skills: structuredClone(player.profile.skills),
      phase: getCareerPhase(
        player.age,
        player.profile.development.peakAge,
        player.profile.development.declineStartAge
      ),
    })
  }
  return history.sort((left, right) => left.season - right.season)
}

export function getPlayerInjuryHistory(
  league: LeagueDocument,
  playerId: string
): PlayerInjuryHistoryEntry[] {
  return [...(league.history.injuries ?? [])]
    .filter((injury) => injury.playerId === playerId)
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) ||
        left.id.localeCompare(right.id)
    )
}

export function getPlayerContractSummary(
  league: LeagueDocument,
  playerId: string
): PlayerContractSummary | null {
  const teamIds = Object.keys(league.entities.teams).sort()
  for (const teamId of teamIds) {
    const contract = projectTeamFinance(league, teamId).contracts.find(
      (candidate) => candidate.playerId === playerId
    )
    if (contract && contract.contractId) {
      const yearsRemaining = contract.endSeason === null
        ? 0
        : Math.max(0, contract.endSeason - league.state.season + 1)
      return {
        ...contract,
        status: contract.status ?? "active",
        yearsRemaining,
        remainingValue: contract.annualSalary
          .slice(0, yearsRemaining)
          .reduce((sum, salary) => sum + salary, 0),
      }
    }
  }
  return null
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

export function getPlayerInformationView(
  league: LeagueDocument,
  playerId: string
): PlayerInformationView | null {
  const player = league.entities.players[playerId]
  if (!player) return null
  const ratingHistory = getPlayerRatingHistory(league, playerId)
  const currentRating = ratingHistory.at(-1) ?? {
    season: league.state.season,
    age: player.age,
    overall: getPlayerCurrentAbility(player),
    skills: structuredClone(player.profile.skills),
    phase: getCareerPhase(
      player.age,
      player.profile.development.peakAge,
      player.profile.development.declineStartAge
    ),
  }
  const teamId =
    player.leagueStatus.kind === "rostered" ? player.leagueStatus.teamId : null
  return {
    player,
    currentRating,
    ratingHistory,
    availability: getPlayerAvailability(league, playerId),
    contract: getPlayerContractSummary(league, playerId),
    rotation: teamId
      ? (league.state.gamePlans?.[teamId]?.rotation ??
        league.state.rotations?.[teamId] ??
        null)
      : null,
    currentProduction: getCurrentSeasonPlayerProduction(league, playerId),
    currentValue: getCurrentSeasonPlayerValue(league, playerId),
    seasonLogs: getPlayerSeasonHistory(league, playerId),
    gameLog: getPlayerGameHistory(league, playerId),
    injuries: getPlayerInjuryHistory(league, playerId),
    recentEvents: getRecentLeagueEvents(league).filter((event) =>
      event.entityRefs.some(
        (ref) => ref.type === "player" && ref.id === playerId
      )
    ),
  }
}
