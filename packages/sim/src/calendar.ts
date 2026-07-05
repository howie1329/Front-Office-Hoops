import type {
  CalendarDate,
  LeagueCalendarState,
  SeasonMilestones,
  SeasonState,
} from "@workspace/shared/types"

const MONTHS = [
  { month: 10, days: 8 },
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

export function getSeasonMilestones(
  seasonLengthDays: number
): SeasonMilestones {
  const regularSeasonEndDay = seasonLengthDays
  return {
    regularSeasonStartDay: 1,
    tradeDeadlineDay: Math.max(1, Math.floor(seasonLengthDays * 0.68)),
    regularSeasonEndDay,
    playoffsStartDay: regularSeasonEndDay + 1,
    offseasonStartDay: regularSeasonEndDay + 36,
    draftDay: regularSeasonEndDay + 50,
    freeAgencyStartDay: regularSeasonEndDay + 56,
    nextSeasonStartDay: regularSeasonEndDay + 72,
  }
}

export function getCalendarDate(day: number): CalendarDate {
  let remaining = Math.max(1, day)

  for (const month of MONTHS) {
    if (remaining <= month.days) {
      return {
        month: month.month,
        day: remaining,
        label: `${MONTH_NAMES[month.month]} ${remaining}`,
      }
    }
    remaining -= month.days
  }

  const dateDay = ((remaining - 1) % 30) + 1
  return {
    month: 9,
    day: dateDay,
    label: `Sep ${dateDay}`,
  }
}

export function getCurrentCalendar(state: SeasonState): LeagueCalendarState {
  const finalRegularDay = Math.max(
    ...state.schedule.filter((game) => !game.seriesId).map((game) => game.day),
    state.currentDay
  )
  return {
    season: state.season,
    day: state.currentDay,
    date: getCalendarDate(state.currentDay),
    phase: state.phase,
    offseasonPhase: state.offseasonPhase,
    milestones: getSeasonMilestones(finalRegularDay),
  }
}

export function canTradeOnDate(state: SeasonState): boolean {
  const calendar = getCurrentCalendar(state)
  if (state.phase === "offseason") {
    return true
  }
  return (
    state.phase === "regular" &&
    state.currentDay < calendar.milestones.tradeDeadlineDay
  )
}
