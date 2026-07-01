import type { PlayoffSeries, SeasonState, UserPlayoffResult } from "@workspace/shared/types"

import { getPlayoffTeamIds, seedPlayoffTeams } from "./playoffs/seedTeams"

function getLatestUserSeries(
  bracket: NonNullable<SeasonState["playoffBracket"]>,
  userTeamId: string,
): PlayoffSeries | undefined {
  const userSeries = bracket.series.filter(
    (series) =>
      series.higherSeedTeamId === userTeamId ||
      series.lowerSeedTeamId === userTeamId,
  )

  return userSeries.sort((a, b) => b.round - a.round)[0]
}

export function deriveUserPlayoffResult(
  state: SeasonState,
  userTeamId: string | null,
): UserPlayoffResult | null {
  if (!userTeamId) {
    return null
  }

  const bracket = state.playoffBracket
  if (!bracket) {
    const seeded = seedPlayoffTeams(state)
    const playoffTeams = getPlayoffTeamIds(seeded)
    return playoffTeams.has(userTeamId) ? null : "missed_playoffs"
  }

  if (bracket.championTeamId === userTeamId) {
    return "champion"
  }

  if (bracket.runnerUpTeamId === userTeamId) {
    return "runner_up"
  }

  const seeded = seedPlayoffTeams(state)
  const playoffTeams = getPlayoffTeamIds(seeded)

  if (!playoffTeams.has(userTeamId)) {
    return "missed_playoffs"
  }

  const latestSeries = getLatestUserSeries(bracket, userTeamId)
  if (!latestSeries) {
    return "missed_playoffs"
  }

  if (latestSeries.winnerId === userTeamId) {
    if (latestSeries.round === 3 && state.teams.length === 30) {
      return "conference_finals"
    }
    if (latestSeries.round === 1 && state.teams.length === 6) {
      return "semifinals"
    }
    return "semifinals"
  }

  if (latestSeries.round === 1) {
    return "first_round"
  }

  if (latestSeries.round === 2 && state.teams.length === 30) {
    return "semifinals"
  }

  if (latestSeries.round === 3 && state.teams.length === 30) {
    return "conference_finals"
  }

  if (latestSeries.round === 2 && state.teams.length === 6) {
    return "runner_up"
  }

  return "first_round"
}
