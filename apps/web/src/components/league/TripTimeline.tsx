import { useMemo } from "react"

import type { ScheduleGame, SeasonState } from "@workspace/shared/types"
import { getCalendarDate } from "@workspace/sim"
import { cn } from "@workspace/ui/lib/utils"

type TripTimelineProps = {
  state: SeasonState
  teamId: string
}

type TripBlock = {
  id: string
  location: "home" | "away"
  startDay: number
  endDay: number
  games: ScheduleGame[]
}

export function TripTimeline({ state, teamId }: TripTimelineProps) {
  const blocks = useMemo(
    () => buildTripBlocks(state, teamId),
    [state, teamId],
  )

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No upcoming home or road blocks on the calendar yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <div
          key={block.id}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            block.location === "home"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-sky-500/30 bg-sky-500/10",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              {block.location === "home" ? "Home stand" : "Road trip"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDayRange(block.startDay, block.endDay)}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {block.games.length} game{block.games.length === 1 ? "" : "s"}
          </p>
        </div>
      ))}
    </div>
  )
}

function buildTripBlocks(state: SeasonState, teamId: string): TripBlock[] {
  const teamGames = state.schedule
    .filter(
      (game) =>
        game.status === "scheduled" &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId),
    )
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))

  const blocks: TripBlock[] = []
  let current: TripBlock | null = null

  for (const game of teamGames) {
    const location: "home" | "away" =
      game.homeTeamId === teamId ? "home" : "away"

    if (!current || current.location !== location) {
      current = {
        id: `${location}-${game.day}`,
        location,
        startDay: game.day,
        endDay: game.day,
        games: [game],
      }
      blocks.push(current)
      continue
    }

    current.endDay = game.day
    current.games.push(game)
  }

  return blocks.slice(0, 6)
}

function formatDayRange(startDay: number, endDay: number): string {
  if (startDay === endDay) {
    return getCalendarDate(startDay).label
  }

  return `Day ${startDay}–${endDay}`
}
