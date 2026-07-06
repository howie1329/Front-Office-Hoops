import type { OffseasonPhase, SeasonPhase } from "./seasonTypes"

export type CalendarDate = {
  month: number
  day: number
  label: string
}

export type SeasonMilestones = {
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
