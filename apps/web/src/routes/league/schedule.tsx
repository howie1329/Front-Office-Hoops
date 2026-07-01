import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { formatScheduledLine } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type { ScheduleGame } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export const Route = createFileRoute("/league/schedule")({
  component: LeagueSchedulePage,
})

function LeagueSchedulePage() {
  const { seasonState } = useLeagueContext()
  const [statusFilter, setStatusFilter] = useState<"all" | ScheduleGame["status"]>(
    "all",
  )

  const games = useMemo(() => {
    if (!seasonState) {
      return []
    }

    const rows = seasonState.schedule
      .slice()
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))

    if (statusFilter === "all") {
      return rows
    }

    return rows.filter((game) => game.status === statusFilter)
  }, [seasonState, statusFilter])

  if (!seasonState) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <CardDescription>
          Full season schedule with links to completed games.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="schedule-status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | ScheduleGame["status"])
            }
          >
            <SelectTrigger id="schedule-status-filter" className="w-full">
              <SelectValue placeholder="All games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All games</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="final">Final</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto text-sm">
          {games.map((game) => {
            const line = `Day ${game.day}: ${formatScheduledLine(seasonState, game)} · ${game.status}`
            const completedGame = seasonState.games.find(
              (entry) => entry.id === game.id,
            )

            if (game.status === "final" && completedGame) {
              return (
                <Button
                  key={game.id}
                  variant="ghost"
                  className="h-auto justify-start px-2 py-1.5 text-left font-normal"
                  asChild
                >
                  <Link to="/league/games/$gameId" params={{ gameId: game.id }}>
                    {line}
                  </Link>
                </Button>
              )
            }

            return <p key={game.id}>{line}</p>
          })}
        </div>
      </CardContent>
    </Card>
  )
}
