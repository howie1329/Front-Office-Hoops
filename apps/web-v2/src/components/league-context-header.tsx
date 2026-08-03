import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LeagueDocument, LeagueScheduleEntry } from "@workspace/domain-v2"
import type { LifecycleActionState } from "@workspace/sim-v2"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

type LeagueContextHeaderProps = {
  league: LeagueDocument
  teamId: string
  pageLabel: string
  advanceAction: LifecycleActionState
  isSimulating: boolean
  onAdvanceDay: () => void
}

function phaseLabel(phase: LeagueDocument["state"]["phase"]): string {
  return {
    foundation: "Foundation",
    preseason: "Preseason",
    "regular-season": "Regular season",
    playoffs: "Playoffs",
    offseason: "Offseason",
  }[phase]
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`))
}

function getRecord(league: LeagueDocument, teamId: string) {
  const standing = league.projections.standings.find(
    (row) => row.teamId === teamId
  )
  const team = league.entities.teams[teamId]
  const division = league.state.structure?.divisions.find(
    (item) => item.id === team.divisionId
  )
  const conferenceTeamIds = new Set(
    Object.values(league.entities.teams)
      .filter((candidate) => {
        const candidateDivision = league.state.structure?.divisions.find(
          (item) => item.id === candidate.divisionId
        )
        return candidateDivision?.conferenceId === division?.conferenceId
      })
      .map((candidate) => candidate.id)
  )
  const rankedStandings = conferenceTeamIds.size
    ? league.projections.standings.filter((row) =>
        conferenceTeamIds.has(row.teamId)
      )
    : league.projections.standings
  const rank = [...rankedStandings]
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      return left.losses - right.losses
    })
    .findIndex((row) => row.teamId === teamId)

  return {
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    rank: rank >= 0 ? rank + 1 : null,
  }
}

function getConferenceName(league: LeagueDocument, teamId: string): string {
  const team = league.entities.teams[teamId]
  const division = league.state.structure?.divisions.find(
    (item) => item.id === team.divisionId
  )
  return (
    league.state.structure?.conferences.find(
      (item) => item.id === division?.conferenceId
    )?.name ?? "Conference"
  )
}

function getNextGame(
  league: LeagueDocument,
  teamId: string
): LeagueScheduleEntry | undefined {
  return league.state.calendar.schedule
    .filter(
      (game) =>
        game.status === "scheduled" &&
        game.date >= league.state.calendar.currentDate &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId)
    )
    .sort((left, right) => left.date.localeCompare(right.date))[0]
}

function ContextMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </p>
      {detail ? (
        <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}

export function LeagueContextHeader({
  league,
  teamId,
  pageLabel,
  advanceAction,
  isSimulating,
  onAdvanceDay,
}: LeagueContextHeaderProps) {
  const team = league.entities.teams[teamId]
  const record = getRecord(league, teamId)
  const conference = getConferenceName(league, teamId)
  const nextGame = getNextGame(league, teamId)
  const nextOpponent = nextGame
    ? league.entities.teams[
        nextGame.homeTeamId === teamId
          ? nextGame.awayTeamId
          : nextGame.homeTeamId
      ]
    : undefined
  const nextGameLabel = nextOpponent
    ? `${nextGame?.homeTeamId === teamId ? "vs." : "at"} ${nextOpponent.name}`
    : "No game scheduled"

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="lg:hidden" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                {pageLabel}
              </p>
              <p className="truncate text-sm font-semibold">{team.name}</p>
            </div>
          </div>
          <ContextMetric
            label="Record"
            value={`${record.wins}-${record.losses}`}
          />
          <ContextMetric
            label="Conference rank"
            value={record.rank ? `#${record.rank} ${conference}` : "—"}
          />
          <ContextMetric
            label="Next game"
            value={nextGameLabel}
            detail={nextGame ? formatDate(nextGame.date) : undefined}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 xl:justify-end">
          <div className="flex items-center gap-2 text-xs">
            <p className="font-semibold tabular-nums">
              {formatDate(league.state.calendar.currentDate)}
            </p>
            <Badge variant="outline">
              Season {league.state.season} · {phaseLabel(league.state.phase)}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={isSimulating}
                title={advanceAction.enabled ? undefined : advanceAction.reason}
                className="gap-1.5"
              >
                {isSimulating ? "Simulating…" : advanceAction.label}
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Advance</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={isSimulating || !advanceAction.enabled}
                onSelect={onAdvanceDay}
              >
                {advanceAction.label}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={13}
                  strokeWidth={2}
                  className="ml-auto"
                  aria-hidden="true"
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Simulate to</DropdownMenuLabel>
              <DropdownMenuItem
                disabled
                title="The lifecycle worker does not expose this command yet."
              >
                Next game
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                title="The lifecycle worker does not expose this command yet."
              >
                Next key date
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>More simulation</DropdownMenuLabel>
              <DropdownMenuItem
                disabled
                title="The lifecycle worker does not expose this command yet."
              >
                Trade deadline
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                title="The lifecycle worker does not expose this command yet."
              >
                Regular-season end
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
