import {
  MINI_PRESEASON_LENGTH_DAYS,
  NBA_SEASON_LENGTH_DAYS,
  PRESEASON_LENGTH_DAYS,
} from "@workspace/shared/constants"
import type {
  CalendarDate,
  LeagueCalendarState,
  SeasonMilestones,
  SeasonState,
  Weekday,
} from "@workspace/shared/types"

const MONTHS = [
  { month: 10, days: 31 },
  { month: 11, days: 30 },
  { month: 12, days: 31 },
  { month: 1, days: 31 },
  { month: 2, days: 28 },
  { month: 3, days: 31 },
  { month: 4, days: 30 },
  { month: 5, days: 31 },
  { month: 6, days: 30 },
  { month: 7, days: 31 },
  { month: 8, days: 31 },
  { month: 9, days: 30 },
] as const

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const MONTH_NAMES: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
}

/** Season day 1 starts on a Tuesday (typical NBA tip-off feel). */
const SEASON_START_WEEKDAY: Weekday = 2

export function getWeekday(day: number): Weekday {
  const normalized = Math.max(1, day)
  return ((SEASON_START_WEEKDAY + normalized - 1) % 7) as Weekday
}

export function getWeekOfSeason(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / 7) + 1
}

export function resolvePreseasonLength(teamCount: number): number {
  return teamCount === 6 ? MINI_PRESEASON_LENGTH_DAYS : PRESEASON_LENGTH_DAYS
}

export function resolveRegularSeasonLength(teamCount: number): number {
  return teamCount === 6 ? 30 : NBA_SEASON_LENGTH_DAYS
}

export function getRegularSeasonStartDay(teamCount: number): number {
  return resolvePreseasonLength(teamCount) + 1
}

export function getSeasonMilestones(
  regularSeasonLengthDays: number,
  preseasonLengthDays = PRESEASON_LENGTH_DAYS,
): SeasonMilestones {
  const preseasonStartDay = 1
  const preseasonEndDay = preseasonLengthDays
  const regularSeasonStartDay = preseasonEndDay + 1
  const regularSeasonEndDay = regularSeasonStartDay + regularSeasonLengthDays - 1
  const tradeDeadlineDay =
    regularSeasonStartDay +
    Math.max(1, Math.floor(regularSeasonLengthDays * 0.68)) -
    1

  return {
    preseasonStartDay,
    preseasonEndDay,
    regularSeasonStartDay,
    tradeDeadlineDay,
    regularSeasonEndDay,
    playoffsStartDay: regularSeasonEndDay + 1,
    offseasonStartDay: regularSeasonEndDay + 36,
    staffPhaseEndDay: regularSeasonEndDay + 43,
    draftDay: regularSeasonEndDay + 50,
    freeAgencyStartDay: regularSeasonEndDay + 56,
    nextSeasonStartDay: regularSeasonEndDay + 72,
  }
}

export function getCalendarDate(day: number): CalendarDate {
  let remaining = Math.max(1, day)

  for (const month of MONTHS) {
    if (remaining <= month.days) {
      const weekday = getWeekday(day)
      return {
        month: month.month,
        day: remaining,
        label: `${WEEKDAY_NAMES[weekday]}, ${MONTH_NAMES[month.month]} ${remaining}`,
        weekday,
        weekOfSeason: getWeekOfSeason(day),
      }
    }
    remaining -= month.days
  }

  const dateDay = ((remaining - 1) % 30) + 1
  const weekday = getWeekday(day)
  return {
    month: 9,
    day: dateDay,
    label: `${WEEKDAY_NAMES[weekday]}, Sep ${dateDay}`,
    weekday,
    weekOfSeason: getWeekOfSeason(day),
  }
}

function resolveMilestonesForState(state: SeasonState): SeasonMilestones {
  const regularGames = state.schedule.filter(
    (game) => game.gameType === "regular" || (!game.gameType && !game.seriesId),
  )
  const regularSeasonEndDay = Math.max(
    ...regularGames.map((game) => game.day),
    getRegularSeasonStartDay(state.teams.length) +
      resolveRegularSeasonLength(state.teams.length) -
      1,
    1,
  )
  const regularSeasonLengthDays =
    regularSeasonEndDay -
    getRegularSeasonStartDay(state.teams.length) +
    1

  return getSeasonMilestones(
    regularSeasonLengthDays,
    resolvePreseasonLength(state.teams.length),
  )
}

export function getCurrentCalendar(state: SeasonState): LeagueCalendarState {
  return {
    season: state.season,
    day: state.currentDay,
    date: getCalendarDate(state.currentDay),
    phase: state.phase,
    offseasonPhase: state.offseasonPhase,
    milestones: resolveMilestonesForState(state),
  }
}

export function canTradeOnDate(state: SeasonState, day = state.currentDay): boolean {
  const calendar = getCurrentCalendar(state)
  if (state.phase === "offseason") {
    return true
  }
  return (
    (state.phase === "regular" || state.phase === "preseason") &&
    day <= calendar.milestones.tradeDeadlineDay
  )
}

export function getMonthEndDay(day: number): number {
  const date = getCalendarDate(day)
  let cursor = day

  while (cursor <= day + 40) {
    const next = getCalendarDate(cursor + 1)
    if (next.month !== date.month) {
      return cursor
    }
    cursor += 1
  }

  return day
}

export function getTradeDeadlineAdvanceStopDay(state: SeasonState): number {
  return resolveMilestonesForState(state).tradeDeadlineDay + 1
}
