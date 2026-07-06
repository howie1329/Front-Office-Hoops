import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import {
  formatScheduledLine,
  teamAbbrev,
  teamName,
} from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type { Game, ScheduleGame, SeasonState } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

export const Route = createFileRoute("/league/schedule")({
  component: LeagueSchedulePage,
})

type ScheduleView = "today" | "upcoming" | "completed" | "full"
type StatusFilter = "all" | ScheduleGame["status"]
type TeamFilter = "all" | "mine"

type ScheduleRow = {
  game: ScheduleGame
  completedGame: Game | null
  isUserTeamGame: boolean
}

const viewOptions: { key: ScheduleView; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "full", label: "Full season" },
]

function LeagueSchedulePage() {
  const { seasonState, myTeam } = useLeagueContext()
  const [view, setView] = useState<ScheduleView>("upcoming")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all")

  const rows = useMemo(() => {
    if (!seasonState) {
      return []
    }

    return buildScheduleRows(seasonState, myTeam?.id ?? null)
  }, [myTeam?.id, seasonState])

  const visibleRows = useMemo(
    () =>
      sortScheduleRows(
        filterScheduleRows({
          rows,
          currentDay: seasonState?.currentDay ?? 1,
          statusFilter,
          teamFilter,
          view,
        }),
        view
      ),
    [myTeam?.id, rows, seasonState?.currentDay, statusFilter, teamFilter, view]
  )

  const summary = useMemo(
    () =>
      seasonState
        ? buildScheduleSummary(seasonState, myTeam?.id ?? null)
        : null,
    [myTeam?.id, seasonState]
  )

  if (!seasonState || !summary) {
    return null
  }

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <ScheduleSummary
        state={seasonState}
        summary={summary}
        teamLabel={myTeam?.abbrev ?? null}
      />

      <Card className="min-h-0 flex-1">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>League schedule</CardTitle>
              <CardDescription>
                Review today, upcoming games, completed results, and
                team-specific calendar spots.
              </CardDescription>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {visibleRows.length} of {rows.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {viewOptions.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  variant={view === option.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Select
                value={teamFilter}
                onValueChange={(value) => setTeamFilter(value as TeamFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  <SelectItem value="mine" disabled={!myTeam}>
                    My team
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Matchup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <ScheduleTableRow
                      key={row.game.id}
                      row={row}
                      state={seasonState}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No games match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ScheduleSummary({
  state,
  summary,
  teamLabel,
}: {
  state: SeasonState
  summary: ReturnType<typeof buildScheduleSummary>
  teamLabel: string | null
}) {
  return (
    <section className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-medium">Schedule</h1>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              Season {state.season}
            </span>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              Day {state.currentDay}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            League calendar, box-score links, and {teamLabel ?? "team"} schedule
            context.
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5 xl:min-w-[680px]">
          <SummaryMetric label="Today" value={String(summary.todayCount)} />
          <SummaryMetric label="Completed" value={String(summary.completed)} />
          <SummaryMetric label="Remaining" value={String(summary.remaining)} />
          <SummaryMetric
            label="Next game"
            value={summary.nextGameLabel ?? "Season complete"}
          />
          <SummaryMetric
            label="My next"
            value={summary.nextUserGameLabel ?? "-"}
          />
        </div>
      </div>
    </section>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  )
}

function ScheduleTableRow({
  row,
  state,
}: {
  row: ScheduleRow
  state: SeasonState
}) {
  const { game, completedGame, isUserTeamGame } = row
  const stage = game.playoffRound ? `Playoffs R${game.playoffRound}` : "Regular"

  return (
    <TableRow
      className={cn(isUserTeamGame ? "bg-muted/70 hover:bg-muted/80" : "")}
    >
      <TableCell className="font-medium tabular-nums">Day {game.day}</TableCell>
      <TableCell>
        <div className="flex min-w-48 flex-col">
          <span className="font-medium">
            {formatScheduledLine(state, game)}
          </span>
          <span className="text-xs text-muted-foreground">
            {teamName(state, game.awayTeamId)} at{" "}
            {teamName(state, game.homeTeamId)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="rounded-sm border bg-muted/30 px-1.5 py-0.5 text-xs font-medium">
          {game.status === "final" ? "Final" : "Scheduled"}
        </span>
      </TableCell>
      <TableCell>
        {completedGame && game.gameId ? (
          <Button variant="ghost" size="sm" className="h-6 px-2" asChild>
            <Link to="/league/games/$gameId" params={{ gameId: game.gameId }}>
              {formatResult(completedGame)}
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{stage}</TableCell>
    </TableRow>
  )
}

function buildScheduleRows(
  state: SeasonState,
  userTeamId: string | null
): ScheduleRow[] {
  const gamesById = new Map(state.games.map((game) => [game.id, game]))

  return state.schedule.map((game) => ({
    game,
    completedGame: game.gameId ? (gamesById.get(game.gameId) ?? null) : null,
    isUserTeamGame:
      !!userTeamId &&
      (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId),
  }))
}

function filterScheduleRows({
  rows,
  currentDay,
  statusFilter,
  teamFilter,
  view,
}: {
  rows: ScheduleRow[]
  currentDay: number
  statusFilter: StatusFilter
  teamFilter: TeamFilter
  view: ScheduleView
}): ScheduleRow[] {
  return rows.filter((row) => {
    if (teamFilter === "mine" && !row.isUserTeamGame) {
      return false
    }

    if (statusFilter !== "all" && row.game.status !== statusFilter) {
      return false
    }

    if (view === "today") {
      return row.game.day === currentDay
    }
    if (view === "upcoming") {
      return row.game.status === "scheduled" && row.game.day >= currentDay
    }
    if (view === "completed") {
      return row.game.status === "final"
    }

    return true
  })
}

function sortScheduleRows(
  rows: ScheduleRow[],
  view: ScheduleView
): ScheduleRow[] {
  return [...rows].sort((a, b) => {
    if (view === "completed") {
      return b.game.day - a.game.day || b.game.id.localeCompare(a.game.id)
    }

    return a.game.day - b.game.day || a.game.id.localeCompare(b.game.id)
  })
}

function buildScheduleSummary(state: SeasonState, userTeamId: string | null) {
  const rows = buildScheduleRows(state, userTeamId)
  const scheduledRows = rows
    .filter((row) => row.game.status === "scheduled")
    .sort(
      (a, b) => a.game.day - b.game.day || a.game.id.localeCompare(b.game.id)
    )
  const nextGame = scheduledRows.at(0) ?? null
  const nextUserGame = scheduledRows.find((row) => row.isUserTeamGame) ?? null

  return {
    todayCount: rows.filter(
      (row) =>
        row.game.day === state.currentDay && row.game.status === "scheduled"
    ).length,
    completed: rows.filter((row) => row.game.status === "final").length,
    remaining: scheduledRows.length,
    nextGameLabel: nextGame ? summaryGameLabel(state, nextGame.game) : null,
    nextUserGameLabel: nextUserGame
      ? summaryGameLabel(state, nextUserGame.game)
      : null,
  }
}

function summaryGameLabel(state: SeasonState, game: ScheduleGame): string {
  return `Day ${game.day} · ${teamAbbrev(state, game.awayTeamId)} @ ${teamAbbrev(
    state,
    game.homeTeamId
  )}`
}

function formatResult(game: Game): string {
  return `${game.result.awayScore}-${game.result.homeScore}`
}
