import { useMemo, useState } from "react"

import type { SeasonState } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { formatScheduledLine } from "./lib/teamFormat"

type SchedulePanelProps = {
  state: SeasonState
  upcomingLimit?: number
  showFullScheduleToggle?: boolean
}

export function SchedulePanel({
  state,
  upcomingLimit = 7,
  showFullScheduleToggle = false,
}: SchedulePanelProps) {
  const [showFullSchedule, setShowFullSchedule] = useState(false)

  const todaysGames = useMemo(
    () =>
      state.schedule.filter(
        (game) => game.day === state.currentDay && game.status === "scheduled",
      ),
    [state],
  )

  const upcomingGames = useMemo(
    () =>
      state.schedule
        .filter((game) => game.status === "scheduled")
        .sort((a, b) => a.day - b.day)
        .slice(0, upcomingLimit),
    [state, upcomingLimit],
  )

  const fullSchedule = useMemo(
    () =>
      state.schedule
        .slice()
        .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)),
    [state.schedule],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Today (Day {state.currentDay})</CardTitle>
          <CardDescription>
            Scheduled games for the current day pointer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {todaysGames.length > 0 ? (
            todaysGames.map((game) => (
              <p key={game.id}>{formatScheduledLine(state, game)}</p>
            ))
          ) : (
            <p className="text-muted-foreground">No games scheduled today.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>Next scheduled games.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {upcomingGames.length > 0 ? (
            upcomingGames.map((game) => (
              <p key={game.id}>
                Day {game.day}: {formatScheduledLine(state, game)}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">Season complete.</p>
          )}
        </CardContent>
      </Card>

      {showFullScheduleToggle ? (
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Full schedule</CardTitle>
              <CardDescription>All scheduled and completed games.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullSchedule((current) => !current)}
            >
              {showFullSchedule ? "Hide" : "Show"} full schedule
            </Button>
          </CardHeader>
          {showFullSchedule ? (
            <CardContent className="flex max-h-96 flex-col gap-1 overflow-y-auto text-sm">
              {fullSchedule.map((game) => (
                <p key={game.id}>
                  Day {game.day}: {formatScheduledLine(state, game)} · {game.status}
                </p>
              ))}
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
