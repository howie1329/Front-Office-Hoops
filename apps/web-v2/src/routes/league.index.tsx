import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

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
  SidebarSeparator,
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

function DashboardSidebar({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const team = league.entities.teams[teamId]
  const { conference, division } = getDivisionAndConference(league, teamId)

  return (
    <Sidebar className="border-r border-border bg-muted/20" collapsible="offcanvas">
      <SidebarHeader className="border-b border-border px-6 py-5">
        <Link
          to="/"
          className="text-sm font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Front Office Hoops <span className="text-muted-foreground">/ V2</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-6 py-6">
          <p className="text-xs font-medium text-muted-foreground">League</p>
          <p className="mt-2 truncate text-sm font-semibold">
            {league.metadata.name}
          </p>
          <p className="mt-5 text-xs font-medium text-muted-foreground">
            Your team
          </p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.02em]">
            {team.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {conference?.name ?? "—"} · {division?.name ?? "—"}
          </p>
        </div>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Office</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <Link to="/league" search={{ saveId: league.metadata.id }}>
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Team</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Roster · coming next</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Schedule · coming next</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>League</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Standings · coming next</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>Transactions · coming next</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <Button
          type="button"
          className="h-10 w-full justify-between"
          disabled
          title="Advance day will be enabled with the lifecycle worker."
        >
          Advance day <span aria-hidden="true">↗</span>
        </Button>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Simulation controls are being connected to the league worker.
        </p>
        <Link
          to="/league/start"
          className="mt-5 inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground underline decoration-border underline-offset-8 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Save manager
        </Link>
      </SidebarFooter>
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
      <SidebarProvider>
        <DashboardSidebar league={league} teamId={teamId} />
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
