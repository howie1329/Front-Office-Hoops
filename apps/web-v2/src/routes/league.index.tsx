import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import {
  ArrowRight01Icon,
  Calendar01Icon,
  ChartLineIcon,
  DashboardSquare01Icon,
  Resize01Icon,
  SaveIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LeagueDocument, LeagueScheduleEntry } from "@workspace/domain-v2"
import { V2LeagueRepository } from "@workspace/db-v2"
import { getPlayerCurrentAbility } from "@workspace/sim-v2"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/league/")({
  component: LeagueShellPage,
})

const repository = new V2LeagueRepository()

function phaseLabel(phase: LeagueDocument["state"]["phase"]): string {
  return {
    foundation: "Foundation",
    preseason: "Preseason",
    "regular-season": "Regular season",
    playoffs: "Playoffs",
    offseason: "Offseason",
  }[phase]
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${dateKey}T00:00:00Z`))
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`
}

function numericValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function getDivisionAndConference(league: LeagueDocument, teamId: string) {
  const team = league.entities.teams[teamId]
  const division = team.divisionId
    ? league.state.structure?.divisions.find(
        (item) => item.id === team.divisionId
      )
    : undefined
  const conference = division?.conferenceId
    ? league.state.structure?.conferences.find(
        (item) => item.id === division.conferenceId
      )
    : undefined

  return { division, conference }
}

function getNextGames(
  league: LeagueDocument,
  teamId: string
): Array<LeagueScheduleEntry> {
  return league.state.calendar.schedule
    .filter(
      (game) =>
        game.status === "scheduled" &&
        game.date >= league.state.calendar.currentDate &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId)
    )
    .slice(0, 5)
}

function getStandingRows(league: LeagueDocument) {
  return Object.values(league.entities.teams)
    .map((team) => {
      const standing = league.projections.standings.find(
        (row) => row.teamId === team.id
      )
      return {
        team,
        wins: numericValue(standing?.wins),
        losses: numericValue(standing?.losses),
      }
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      if (left.losses !== right.losses) return left.losses - right.losses
      return left.team.name.localeCompare(right.team.name)
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

function getRosterWatch(league: LeagueDocument, teamId: string) {
  const roster = league.entities.teams[teamId].rosterPlayerIds ?? []
  return roster
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .sort(
      (left, right) =>
        getPlayerCurrentAbility(right) - getPlayerCurrentAbility(left)
    )
    .slice(0, 5)
}

function gameOpponent(
  league: LeagueDocument,
  game: LeagueScheduleEntry,
  teamId: string
): { name: string; home: boolean } {
  const home = game.homeTeamId === teamId
  const opponentId = home ? game.awayTeamId : game.homeTeamId
  return {
    name: league.entities.teams[opponentId].name,
    home,
  }
}

const DEFAULT_SIDEBAR_WIDTH = 224
const MIN_SIDEBAR_WIDTH = 208
const MAX_SIDEBAR_WIDTH = 296
const SIDEBAR_WIDTH_STORAGE_KEY = "foh-v2-sidebar-width"

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function SidebarResizeHandle({
  width,
  onChange,
}: {
  width: number
  onChange: (width: number) => void
}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartX = React.useRef(0)
  const dragStartWidth = React.useRef(width)

  React.useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: PointerEvent) => {
      onChange(clampSidebarWidth(dragStartWidth.current + event.clientX - dragStartX.current))
    }
    const handlePointerUp = () => setIsDragging(false)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, onChange])

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 32 : 8
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      onChange(clampSidebarWidth(width - step))
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      onChange(clampSidebarWidth(width + step))
    } else if (event.key === "Home") {
      event.preventDefault()
      onChange(MIN_SIDEBAR_WIDTH)
    } else if (event.key === "End") {
      event.preventDefault()
      onChange(MAX_SIDEBAR_WIDTH)
    }
  }

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels wide`}
      title="Resize sidebar"
      className="group/resize absolute inset-y-0 -right-1 z-30 hidden w-2 cursor-col-resize lg:block"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.preventDefault()
        dragStartX.current = event.clientX
        dragStartWidth.current = width
        setIsDragging(true)
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-border group-focus-visible/resize:bg-ring"
      />
      <HugeiconsIcon
        icon={Resize01Icon}
        size={12}
        strokeWidth={2}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-sidebar p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100"
      />
      <span className="sr-only">
        Use the left and right arrow keys to resize. Hold Shift for larger steps.
      </span>
    </button>
  )
}

function DashboardSidebar({
  league,
  teamId,
  width,
  onWidthChange,
}: {
  league: LeagueDocument
  teamId: string
  width: number
  onWidthChange: (width: number) => void
}) {
  const team = league.entities.teams[teamId]
  const { conference, division } = getDivisionAndConference(league, teamId)
  const teamMark = team.name.slice(0, 2).toUpperCase()

  return (
    <Sidebar className="relative border-r border-border bg-muted/20" collapsible="offcanvas">
      <SidebarHeader className="gap-0 border-b border-border px-4 py-3">
        <Link
          to="/"
          className="truncate text-[13px] font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Front Office Hoops <span className="text-muted-foreground">/ V2</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <div className="border-b border-border px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">League</p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-semibold tracking-[0.04em] text-primary-foreground"
            >
              {teamMark}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{league.metadata.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {team.name} · {conference?.name ?? "—"}
              </p>
            </div>
          </div>
          <p className="mt-3 truncate text-[11px] text-muted-foreground">
            {division?.name ?? "Division not set"}
          </p>
        </div>

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive size="sm" className="h-8">
                  <Link to="/league" search={{ saveId: league.metadata.id }}>
                    <HugeiconsIcon
                      icon={DashboardSquare01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Team
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled size="sm" className="h-8 justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={UserGroupIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Roster</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled size="sm" className="h-8 justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={Calendar01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Schedule</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            League
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled size="sm" className="h-8 justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={ChartLineIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Standings</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled size="sm" className="h-8 justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={SaveIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Transactions</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/50" />
          <span className="truncate">Simulation worker connecting</span>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 w-full justify-between"
          disabled
          title="Advance day will be enabled with the lifecycle worker."
        >
          Advance day
          <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} aria-hidden="true" />
        </Button>
        <Link
          to="/league/start"
          className="inline-flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <HugeiconsIcon icon={SaveIcon} size={14} strokeWidth={2} aria-hidden="true" />
          Manage saves
        </Link>
      </SidebarFooter>
      <SidebarResizeHandle width={width} onChange={onWidthChange} />
    </Sidebar>
  )
}

function MobileDashboardHeader({ league }: { league: LeagueDocument }) {
  return (
    <div className="border-b border-border px-5 py-4 lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <SidebarTrigger className="lg:hidden" />
        <Link
          to="/"
          className="text-sm font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Front Office Hoops <span className="text-muted-foreground">/ V2</span>
        </Link>
        <Link
          to="/league/start"
          className="text-xs font-medium text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Saves
        </Link>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Your league
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {league.metadata.name}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled
          title="Coming with the lifecycle worker."
        >
          Advance day
        </Button>
      </div>
    </div>
  )
}

function CommandHeader({ league }: { league: LeagueDocument }) {
  return (
    <header className="border-b border-border px-5 py-4 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-sm font-semibold">
            {formatDate(league.state.calendar.currentDate, { year: "numeric" })}
          </p>
          <Badge variant="outline">
            Season {league.state.season} · {phaseLabel(league.state.phase)}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Trade deadline{" "}
            {formatDate(league.state.calendar.milestones.tradeDeadline)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled
            title="Coming with the lifecycle worker."
          >
            Advance day
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming with the lifecycle worker."
          >
            Next game
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled
            title="Coming with the lifecycle worker."
          >
            Next key date
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                More simulation
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Simulate to deadline</DropdownMenuItem>
              <DropdownMenuItem disabled>Simulate to season end</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function TeamSnapshot({
  league,
  teamId,
  nextGame,
  record,
}: {
  league: LeagueDocument
  teamId: string
  nextGame?: LeagueScheduleEntry
  record: { wins: number; losses: number; rank: number }
}) {
  const team = league.entities.teams[teamId]
  const { conference, division } = getDivisionAndConference(league, teamId)
  const opponent = nextGame ? gameOpponent(league, nextGame, teamId) : null

  return (
    <section
      aria-labelledby="team-snapshot-heading"
      className="border-y border-border"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Team snapshot
          </p>
          <h2
            id="team-snapshot-heading"
            className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
          >
            {team.name}
          </h2>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-muted-foreground">Next game</p>
          <p className="mt-2 text-sm font-semibold">
            {opponent
              ? `${opponent.home ? "vs." : "at"} ${opponent.name}`
              : "No game scheduled"}
          </p>
          {nextGame && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(nextGame.date)} ·{" "}
              {nextGame.kind === "preseason" ? "Exhibition" : "Regular season"}
            </p>
          )}
        </div>
      </div>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="w-1/2 font-medium text-muted-foreground">
              Record
            </TableCell>
            <TableCell className="tabular-nums">
              {formatRecord(record.wins, record.losses)} · {record.rank}
              {record.rank === 1
                ? "st"
                : record.rank === 2
                  ? "nd"
                  : record.rank === 3
                    ? "rd"
                    : "th"}{" "}
              overall
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">
              Conference
            </TableCell>
            <TableCell>{conference?.name ?? "—"}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">
              Division
            </TableCell>
            <TableCell>{division?.name ?? "—"}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">
              Roster
            </TableCell>
            <TableCell className="tabular-nums">
              {team.rosterPlayerIds?.length ?? 0} players registered
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  )
}

function RosterWatch({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const players = getRosterWatch(league, teamId)

  return (
    <section
      aria-labelledby="roster-watch-heading"
      className="border-y border-border"
    >
      <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Attention list
          </p>
          <h2
            id="roster-watch-heading"
            className="mt-2 text-lg font-semibold tracking-[-0.02em]"
          >
            Roster watch
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Top five by overall
        </span>
      </div>
      <Table>
        <TableCaption className="sr-only">
          Top five players on the selected team's roster.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">OVR</TableHead>
            <TableHead className="text-right">Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">
                {player.identity.firstName} {player.identity.lastName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {player.profile.role.primaryPosition}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Math.round(getPlayerCurrentAbility(player))}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {player.age}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t border-border px-5 py-4 sm:px-6">
        <span className="text-sm text-muted-foreground">
          Full roster management will open here next.
        </span>
      </div>
    </section>
  )
}

function LeagueSnapshot({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const rows = getStandingRows(league).slice(0, 8)

  return (
    <section
      aria-labelledby="league-snapshot-heading"
      className="border-y border-border"
    >
      <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            League snapshot
          </p>
          <h2
            id="league-snapshot-heading"
            className="mt-2 text-lg font-semibold tracking-[-0.02em]"
          >
            Standings
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">Top eight</span>
      </div>
      <Table>
        <TableCaption className="sr-only">
          Current league standings.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">W</TableHead>
            <TableHead className="text-right">L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.team.id}
              data-state={row.team.id === teamId ? "selected" : undefined}
            >
              <TableCell className="text-muted-foreground tabular-nums">
                {row.rank}
              </TableCell>
              <TableCell className="font-medium">{row.team.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.wins}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {row.losses}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t border-border px-5 py-4 sm:px-6">
        <span className="text-sm text-muted-foreground">
          Full standings will include conference and playoff context.
        </span>
      </div>
    </section>
  )
}

function UpcomingSchedule({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const games = getNextGames(league, teamId)

  return (
    <section
      aria-labelledby="upcoming-schedule-heading"
      className="border-y border-border"
    >
      <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            What is next
          </p>
          <h2
            id="upcoming-schedule-heading"
            className="mt-2 text-lg font-semibold tracking-[-0.02em]"
          >
            Upcoming schedule
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">Next five</span>
      </div>
      <Table>
        <TableCaption className="sr-only">
          The selected team's next five scheduled games.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Opponent</TableHead>
            <TableHead>H/A</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((game, index) => {
            const opponent = gameOpponent(league, game, teamId)
            return (
              <TableRow
                key={game.id}
                data-state={index === 0 ? "selected" : undefined}
              >
                <TableCell className="font-medium">
                  {formatDate(game.date)}
                </TableCell>
                <TableCell>{opponent.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {opponent.home ? "Home" : "Away"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {game.kind === "preseason" ? "Exhibition" : "Scheduled"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {games.length === 0 && (
        <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">
          No scheduled games are waiting on the current calendar.
        </p>
      )}
    </section>
  )
}

function LeagueShellPage() {
  const { saveId } = Route.useSearch()
  const [league, setLeague] = React.useState<LeagueDocument | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH)
  const [isSidebarWidthHydrated, setIsSidebarWidthHydrated] = React.useState(false)

  React.useEffect(() => {
    try {
      const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
      if (Number.isFinite(storedWidth)) setSidebarWidth(clampSidebarWidth(storedWidth))
    } catch {
      // Local storage is optional; the default width remains usable.
    }
    setIsSidebarWidthHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!isSidebarWidthHydrated) return
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
    } catch {
      // Local storage is optional; resizing still works for this session.
    }
  }, [isSidebarWidthHydrated, sidebarWidth])

  React.useEffect(() => {
    let active = true

    async function loadLeague() {
      try {
        const id = saveId ?? (await repository.list())[0]?.id
        const document = id ? await repository.load(id) : null

        if (!active) return
        if (!document) {
          setError("That league could not be found in this browser.")
        } else {
          setLeague(document)
        }
      } catch {
        if (active)
          setError("That league could not be loaded from this browser.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadLeague()
    return () => {
      active = false
    }
  }, [saveId])

  if (isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-5 text-sm text-muted-foreground">
        <div className="grid w-full max-w-sm gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    )
  }

  if (error || !league) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-10">
          <Link
            to="/league/start"
            className="w-fit text-sm text-muted-foreground underline underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to saves
          </Link>
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>Dashboard unavailable.</EmptyTitle>
              <EmptyDescription>
                {error ?? "No league is selected."}
              </EmptyDescription>
            </EmptyHeader>
            {error ? (
              <Alert variant="destructive" className="mt-4 w-full max-w-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </Empty>
        </div>
      </main>
    )
  }

  const teamId = league.state.userTeamId
  if (!teamId) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-[88rem] items-center">
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>Select a team to open the dashboard.</EmptyTitle>
              <EmptyDescription>
                This league is generated, but it does not have an active team
                yet.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild className="mt-4">
              <Link to="/league/start">Back to saves</Link>
            </Button>
          </Empty>
        </div>
      </main>
    )
  }

  const standing = getStandingRows(league).find(
    (row) => row.team.id === teamId
  ) ?? {
    wins: 0,
    losses: 0,
    rank: 0,
  }
  const nextGames = getNextGames(league, teamId)

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <SidebarProvider
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <DashboardSidebar
          league={league}
          teamId={teamId}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
        <SidebarInset>
          <MobileDashboardHeader league={league} />
          <CommandHeader league={league} />

          <div className="mx-auto w-full max-w-[96rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  League dashboard
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                  Run the office.
                </h1>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Review the team, read the league, and see what is waiting on the
                calendar.
              </p>
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
              <TeamSnapshot
                league={league}
                teamId={teamId}
                nextGame={nextGames[0]}
                record={standing}
              />
              <LeagueSnapshot league={league} teamId={teamId} />
              <RosterWatch league={league} teamId={teamId} />
              <UpcomingSchedule league={league} teamId={teamId} />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </main>
  )
}
