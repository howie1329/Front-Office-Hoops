import { Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { CalendarHeatmap } from "@/components/league/CalendarHeatmap"
import {
  formatScheduledLine,
  teamAbbrev,
} from "@/components/league/lib/teamFormat"
import { TripTimeline } from "@/components/league/TripTimeline"
import type { ScheduleGame, SeasonState } from "@workspace/shared/types"
import { getCalendarDate, getCurrentCalendar } from "@workspace/sim"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

type TeamCalendarProps = {
  state: SeasonState
  teamId: string
}

export function TeamCalendar({ state, teamId }: TeamCalendarProps) {
  const [selectedDay, setSelectedDay] = useState(state.currentDay)
  const calendar = getCurrentCalendar(state)
  const selectedGame = useMemo(
    () => findTeamGameOnDay(state, teamId, selectedDay),
    [selectedDay, state, teamId],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <Card className="min-h-0">
        <CardHeader className="border-b">
          <CardTitle>Team calendar</CardTitle>
          <CardDescription>
            {calendar.date.label} · Week {calendar.date.weekOfSeason} · tap a day
            for matchup details
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <CalendarHeatmap
            state={state}
            teamId={teamId}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Day detail</CardTitle>
            <CardDescription>{getCalendarDate(selectedDay).label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <DayDetail
              state={state}
              teamId={teamId}
              day={selectedDay}
              game={selectedGame}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Trip timeline</CardTitle>
            <CardDescription>
              Upcoming home stands and road trips
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <TripTimeline state={state} teamId={teamId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-4 text-sm">
            <MilestoneRow
              label="Trade deadline"
              day={calendar.milestones.tradeDeadlineDay}
              currentDay={state.currentDay}
            />
            <MilestoneRow
              label="Regular season ends"
              day={calendar.milestones.regularSeasonEndDay}
              currentDay={state.currentDay}
            />
            <MilestoneRow
              label="Playoffs begin"
              day={calendar.milestones.playoffsStartDay}
              currentDay={state.currentDay}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DayDetail({
  state,
  teamId,
  day,
  game,
}: {
  state: SeasonState
  teamId: string
  day: number
  game: ScheduleGame | null
}) {
  if (day < state.currentDay) {
    const completed = state.games.find(
      (entry) =>
        entry.day === day &&
        (entry.homeTeamId === teamId || entry.awayTeamId === teamId),
    )

    if (completed) {
      const scheduleEntry =
        state.schedule.find((entry) => entry.gameId === completed.id) ??
        state.schedule.find(
          (entry) =>
            entry.day === day &&
            (entry.homeTeamId === teamId || entry.awayTeamId === teamId),
        )

      return (
        <div className="space-y-2">
          {scheduleEntry ? (
            <p className="text-sm">{formatScheduledLine(state, scheduleEntry)}</p>
          ) : (
            <p className="text-sm">
              Final · Day {completed.day}
            </p>
          )}
          <Link
            to="/league/games/$gameId"
            params={{ gameId: completed.id }}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View box score
          </Link>
        </div>
      )
    }
  }

  if (!game) {
    return <p className="text-sm text-muted-foreground">No game scheduled.</p>
  }

  const opponentId =
    game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId
  const location = game.homeTeamId === teamId ? "Home" : "Away"
  const typeLabel =
    game.gameType === "exhibition"
      ? "Exhibition"
      : game.gameType === "playoff"
        ? "Playoff"
        : "Regular season"

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">
        {location} vs {teamAbbrev(state, opponentId)}
      </p>
      <p className="text-muted-foreground">{typeLabel}</p>
      <p>{formatScheduledLine(state, game)}</p>
      {game.status === "final" && game.gameId ? (
        <Link
          to="/league/games/$gameId"
          params={{ gameId: game.gameId }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          View box score
        </Link>
      ) : null}
    </div>
  )
}

function MilestoneRow({
  label,
  day,
  currentDay,
}: {
  label: string
  day: number
  currentDay: number
}) {
  const passed = currentDay > day
  const today = currentDay === day

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2",
        today && "border-primary/40 bg-primary/5",
        passed && "opacity-70",
      )}
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">
        {getCalendarDate(day).label}
      </span>
    </div>
  )
}

function findTeamGameOnDay(
  state: SeasonState,
  teamId: string,
  day: number,
): ScheduleGame | null {
  return (
    state.schedule.find(
      (game) =>
        game.day === day &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId),
    ) ?? null
  )
}
