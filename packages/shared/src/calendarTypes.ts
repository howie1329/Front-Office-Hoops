import type { OffseasonPhase, SeasonPhase } from "./seasonTypes"

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type CalendarDate = {
  month: number
  day: number
  label: string
  weekday: Weekday
  weekOfSeason: number
}

export type SeasonMilestones = {
  preseasonStartDay: number
  preseasonEndDay: number
  regularSeasonStartDay: number
  tradeDeadlineDay: number
  regularSeasonEndDay: number
  playoffsStartDay: number
  offseasonStartDay: number
  draftDay: number
  freeAgencyStartDay: number
  nextSeasonStartDay: number
}

export type LeagueCalendarState = {
  season: number
  day: number
  date: CalendarDate
  phase: SeasonPhase
  offseasonPhase?: OffseasonPhase
  milestones: SeasonMilestones
}
