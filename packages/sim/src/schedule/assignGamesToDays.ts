import { MAX_GAMES_PER_TEAM_PER_WEEK } from "@workspace/shared/constants"
import type { Rng } from "@workspace/shared/types"

import { getWeekOfSeason } from "../calendar"

export type PairMatchup = {
  homeTeamId: string
  awayTeamId: string
}

export type AssignGamesOptions = {
  startDay: number
  endDay: number
  rng: Rng
  maxGamesPerTeamPerWeek?: number
}

function isTeamBooked(
  teamId: string,
  day: number,
  teamDays: Map<string, Set<number>>,
): boolean {
  return teamDays.get(teamId)?.has(day) ?? false
}

function getTeamWeekCount(
  teamId: string,
  week: number,
  teamWeekCounts: Map<string, Map<number, number>>,
): number {
  return teamWeekCounts.get(teamId)?.get(week) ?? 0
}

function markTeamDay(
  teamId: string,
  day: number,
  teamDays: Map<string, Set<number>>,
  teamWeekCounts: Map<string, Map<number, number>>,
): void {
  const days = teamDays.get(teamId) ?? new Set<number>()
  days.add(day)
  teamDays.set(teamId, days)

  const week = getWeekOfSeason(day)
  const weekCounts = teamWeekCounts.get(teamId) ?? new Map<number, number>()
  weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1)
  teamWeekCounts.set(teamId, weekCounts)
}

function canPlaceMatchup(
  matchup: PairMatchup,
  day: number,
  teamDays: Map<string, Set<number>>,
  teamWeekCounts: Map<string, Map<number, number>>,
  maxGamesPerTeamPerWeek: number,
  enforceWeeklyCap: boolean,
): boolean {
  if (
    isTeamBooked(matchup.homeTeamId, day, teamDays) ||
    isTeamBooked(matchup.awayTeamId, day, teamDays)
  ) {
    return false
  }

  if (!enforceWeeklyCap) {
    return true
  }

  const week = getWeekOfSeason(day)
  if (
    getTeamWeekCount(matchup.homeTeamId, week, teamWeekCounts) >=
      maxGamesPerTeamPerWeek ||
    getTeamWeekCount(matchup.awayTeamId, week, teamWeekCounts) >=
      maxGamesPerTeamPerWeek
  ) {
    return false
  }

  return true
}

function findDayForMatchup(
  matchup: PairMatchup,
  options: AssignGamesOptions,
  teamDays: Map<string, Set<number>>,
  teamWeekCounts: Map<string, Map<number, number>>,
  maxGamesPerTeamPerWeek: number,
  searchStart: number,
): number | null {
  for (let day = searchStart; day <= options.endDay; day++) {
    if (
      canPlaceMatchup(
        matchup,
        day,
        teamDays,
        teamWeekCounts,
        maxGamesPerTeamPerWeek,
        true,
      )
    ) {
      return day
    }
  }

  for (let day = options.startDay; day <= options.endDay; day++) {
    if (
      canPlaceMatchup(
        matchup,
        day,
        teamDays,
        teamWeekCounts,
        maxGamesPerTeamPerWeek,
        false,
      )
    ) {
      return day
    }
  }

  return null
}

export function assignGamesToDays(
  matchups: PairMatchup[],
  options: AssignGamesOptions,
): number[] {
  const maxGamesPerTeamPerWeek =
    options.maxGamesPerTeamPerWeek ?? MAX_GAMES_PER_TEAM_PER_WEEK
  const teamDays = new Map<string, Set<number>>()
  const teamWeekCounts = new Map<string, Map<number, number>>()
  const days: number[] = []
  let searchStart = options.startDay

  for (const matchup of matchups) {
    const day = findDayForMatchup(
      matchup,
      options,
      teamDays,
      teamWeekCounts,
      maxGamesPerTeamPerWeek,
      searchStart,
    )

    if (day === null) {
      throw new Error(
        `Failed to assign matchup ${matchup.homeTeamId} vs ${matchup.awayTeamId} between days ${options.startDay}-${options.endDay}`,
      )
    }

    days.push(day)
    markTeamDay(matchup.homeTeamId, day, teamDays, teamWeekCounts)
    markTeamDay(matchup.awayTeamId, day, teamDays, teamWeekCounts)
    searchStart = day
  }

  return days
}
