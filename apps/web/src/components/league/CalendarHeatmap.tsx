import { useMemo } from "react"

import type { ScheduleGame, SeasonState } from "@workspace/shared/types"
import {
  getCalendarDate,
  getCurrentCalendar,
  isBackToBack,
  isThreeInFour,
} from "@workspace/sim"
import { cn } from "@workspace/ui/lib/utils"

type CalendarHeatmapProps = {
  state: SeasonState
  teamId: string
  selectedDay: number
  onSelectDay: (day: number) => void
}

type DayCell = {
  day: number | null
  label: string
  weekday: number
  weekOfSeason: number
  game: ScheduleGame | null
  isHome: boolean | null
  isToday: boolean
  isPreseason: boolean
  isBackToBack: boolean
  isThreeInFour: boolean
  isTradeDeadline: boolean
}

export function CalendarHeatmap({
  state,
  teamId,
  selectedDay,
  onSelectDay,
}: CalendarHeatmapProps) {
  const cells = useMemo(
    () => buildDayCells(state, teamId),
    [state, teamId],
  )

  const weeks = useMemo(() => groupCellsByWeek(cells), [cells])

  if (weeks.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[0.625rem] font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week.weekOfSeason} className="grid grid-cols-7 gap-1">
            {week.days.map((cell, index) =>
              cell.day === null ? (
                <div key={`pad-${week.weekOfSeason}-${index}`} />
              ) : (
                <button
                  key={cell.day}
                  type="button"
                  onClick={() => onSelectDay(cell.day!)}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center rounded-md border px-1 py-1 text-[0.625rem] transition-colors",
                    cellBackground(cell),
                    selectedDay === cell.day &&
                      "ring-2 ring-primary ring-offset-1",
                    cell.isToday && "border-primary/60",
                  )}
                >
                  <span className="font-medium tabular-nums">{cell.day}</span>
                  <span className="truncate text-[0.5625rem] text-muted-foreground">
                    {cell.label.split(", ")[1]?.split(" ")[0] ?? ""}
                  </span>
                  {cell.game ? (
                    <span className="mt-0.5 text-[0.5625rem] font-medium">
                      {cell.isHome ? "vs" : "@"}
                    </span>
                  ) : (
                    <span className="mt-0.5 text-[0.5625rem] text-muted-foreground">
                      off
                    </span>
                  )}
                  {cell.isBackToBack ? (
                    <span className="absolute right-0.5 top-0.5 rounded bg-amber-500/20 px-0.5 text-[0.5rem] text-amber-700 dark:text-amber-300">
                      B2B
                    </span>
                  ) : null}
                  {cell.isThreeInFour && !cell.isBackToBack ? (
                    <span className="absolute right-0.5 top-0.5 rounded bg-orange-500/20 px-0.5 text-[0.5rem] text-orange-700 dark:text-orange-300">
                      3n4
                    </span>
                  ) : null}
                </button>
              ),
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[0.625rem] text-muted-foreground">
        <LegendSwatch className="bg-emerald-500/15" label="Home" />
        <LegendSwatch className="bg-sky-500/15" label="Away" />
        <LegendSwatch className="bg-muted/40" label="Off day" />
        <LegendSwatch className="bg-violet-500/10" label="Preseason" />
      </div>
    </div>
  )
}

function LegendSwatch({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm border", className)} />
      {label}
    </span>
  )
}

function cellBackground(cell: DayCell): string {
  if (cell.day === null) {
    return ""
  }
  if (cell.isPreseason) {
    return cell.game
      ? "bg-violet-500/10 hover:bg-violet-500/20"
      : "bg-violet-500/5 hover:bg-violet-500/10"
  }
  if (!cell.game) {
    return "bg-muted/20 hover:bg-muted/40"
  }
  return cell.isHome
    ? "bg-emerald-500/15 hover:bg-emerald-500/25"
    : "bg-sky-500/15 hover:bg-sky-500/25"
}

function buildDayCells(state: SeasonState, teamId: string): DayCell[] {
  const milestones = getCurrentCalendar(state).milestones
  const gamesByDay = new Map<number, ScheduleGame>()

  for (const game of state.schedule) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
      continue
    }
    const existing = gamesByDay.get(game.day)
    if (!existing || game.status === "scheduled") {
      gamesByDay.set(game.day, game)
    }
  }

  const startDay = Math.max(1, state.currentDay - 14)
  const endDay = Math.min(
    milestones.nextSeasonStartDay - 1,
    state.currentDay + 28,
  )

  const cells: DayCell[] = []
  for (let day = startDay; day <= endDay; day += 1) {
    const date = getCalendarDate(day)
    const game = gamesByDay.get(day) ?? null
    cells.push({
      day,
      label: date.label,
      weekday: date.weekday,
      weekOfSeason: date.weekOfSeason,
      game,
      isHome: game ? game.homeTeamId === teamId : null,
      isToday: day === state.currentDay,
      isPreseason: day <= milestones.preseasonEndDay,
      isBackToBack: isBackToBack(teamId, state, day),
      isThreeInFour: isThreeInFour(teamId, state, day),
      isTradeDeadline: day === milestones.tradeDeadlineDay,
    })
  }

  return cells
}

function groupCellsByWeek(cells: DayCell[]) {
  const byWeek = new Map<number, DayCell[]>()

  for (const cell of cells) {
    const week = byWeek.get(cell.weekOfSeason) ?? []
    week.push(cell)
    byWeek.set(cell.weekOfSeason, week)
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekOfSeason, days]) => {
      const padded = [...days]
      const firstWeekday = padded[0]?.weekday ?? 0
      for (let index = 0; index < firstWeekday; index += 1) {
        padded.unshift(createPaddingCell())
      }
      while (padded.length % 7 !== 0) {
        padded.push(createPaddingCell())
      }
      return { weekOfSeason, days: padded }
    })
}

function createPaddingCell(): DayCell {
  return {
    day: null,
    label: "",
    weekday: 0,
    weekOfSeason: 0,
    game: null,
    isHome: null,
    isToday: false,
    isPreseason: false,
    isBackToBack: false,
    isThreeInFour: false,
    isTradeDeadline: false,
  }
}
