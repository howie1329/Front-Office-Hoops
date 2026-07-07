import { Link, createFileRoute } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { useMemo, useState } from "react"

import { playerName } from "@/components/box-score/playerName"
import { AdvanceControls } from "@/components/league/AdvanceControls"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  formatGameLine,
  formatScheduledLine,
  teamName,
  winPct,
} from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { getCurrentCalendar } from "@workspace/sim"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import type {
  Player,
  PlayerSeasonStats,
  PreseasonDevelopmentReport,
  ScheduleGame,
  SeasonPhase,
  SeasonState,
  Standing,
} from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const Route = createFileRoute("/league/")({
  component: LeagueDashboardPage,
})

function LeagueDashboardPage() {
  const {
    league,
    seasonState,
    status,
    saveStatus,
    error,
    myTeam,
    phase,
    championTeamId,
    canBeginRegularSeason,
    canBeginPlayoffs,
    canBeginOffseason,
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
    rosterOverLimit,
    cutsNeeded,
    beginRegularSeason,
    skipRemainingExhibitions,
    beginPlayoffs,
    beginOffseason,
    completeReSignings,
    advanceToDraft,
    prepareDraft,
    advanceToFreeAgency,
    completeFreeAgency,
    advance,
    lastAdvanceResult,
    simulatePlayoffs,
    startNextSeason,
  } = useLeagueContext()

  const financials = useTeamFinancials(league, myTeam?.id ?? null)

  const pendingTradeOfferCount = useMemo(() => {
    if (!league || !myTeam?.id) {
      return 0
    }
    return league.pendingTradeOffers.filter(
      (offer) =>
        offer.status === "pending" &&
        (offer.toTeamId === myTeam.id || offer.fromTeamId === myTeam.id)
    ).length
  }, [league, myTeam?.id])

  const dashboard = useMemo(() => {
    if (!seasonState) {
      return null
    }

    const myStanding = myTeam
      ? (seasonState.standings.find((row) => row.teamId === myTeam.id) ?? null)
      : null
    const rank = myStanding
      ? seasonState.standings.findIndex(
          (row) => row.teamId === myStanding.teamId
        ) + 1
      : null
    const userTeamId = myTeam ? myTeam.id : null
    const standingsRows = getConferenceStandingsRows(seasonState, userTeamId)
    const rosterRows = getRosterRows(seasonState, userTeamId)
    const nextGames = seasonState.schedule
      .filter((game) => game.status === "scheduled")
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .slice(0, 16)
    const recentGames = seasonState.games
      .slice()
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
      .slice(0, 5)

    return {
      myStanding,
      rank,
      rosterRows,
      standingsRows,
      nextGames,
      recentGames,
    }
  }, [myTeam, seasonState])

  if (!seasonState) {
    return null
  }

  const isMiniLeague = seasonState.teams.length < LEAGUE_TEAM_COUNT
  const urgentItems = getUrgentItems({
    phase,
    error,
    rosterOverLimit,
    cutsNeeded,
    pendingTradeOfferCount,
    canBeginRegularSeason,
    canBeginPlayoffs,
    canBeginOffseason,
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
  })
  const latestDevelopmentReport =
    phase === "preseason" && league?.developmentReports.length
      ? league.developmentReports[league.developmentReports.length - 1]
      : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {isMiniLeague ? (
        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>6-team save detected</CardTitle>
            <CardDescription>
              This save uses the mini league format. Create a new 30-team league
              from the home page for the full product experience.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="-m-px min-h-0 flex-1 overflow-y-auto p-px">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto xl:p-px">
          <OperationsHeader
            state={seasonState}
            leagueName={league?.name ?? "League"}
            selectedTeamName={myTeam?.name ?? null}
            teamAbbrev={myTeam?.abbrev ?? null}
            teamOverall={myTeam?.overall ?? null}
            rank={dashboard?.rank ?? null}
            standing={dashboard?.myStanding ?? null}
            payroll={financials?.payroll ?? null}
            capSpace={financials?.capSpace ?? null}
            rosterCount={myTeam?.players.length ?? null}
            cutsNeeded={cutsNeeded}
            rosterOverLimit={rosterOverLimit}
            urgentCount={urgentItems.length}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <ScheduleRail
              state={seasonState}
              userTeamId={myTeam?.id ?? null}
              games={dashboard?.nextGames ?? []}
            />
            <AdvanceControls
              state={seasonState}
              phase={phase}
              status={status}
              saveStatus={saveStatus}
              error={error}
              lastAdvanceResult={lastAdvanceResult}
              onAdvance={advance}
              onSimPlayoffs={simulatePlayoffs}
              title="Advance"
              description={`Run ${league?.name ?? "the league"} from the schedule rail.`}
            />
          </div>

          <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)]">
            <ConferenceStandingsTable
              rows={dashboard?.standingsRows ?? []}
              userTeamId={myTeam?.id ?? null}
            />
            <RosterOverviewTable rows={dashboard?.rosterRows ?? []} />
          </div>

          <LeagueNotesCard
            state={seasonState}
            championTeamId={championTeamId}
            urgentItems={urgentItems}
            recentGames={dashboard?.recentGames ?? []}
            developmentReport={latestDevelopmentReport}
            canBeginRegularSeason={canBeginRegularSeason}
            canBeginPlayoffs={canBeginPlayoffs}
            canBeginOffseason={canBeginOffseason}
            canSimAiReSignings={canSimAiReSignings}
            canProceedToDraft={canProceedToDraft}
            canPrepareDraft={canPrepareDraft}
            canProceedToFreeAgency={canProceedToFreeAgency}
            canSimAiFreeAgency={canSimAiFreeAgency}
            canStartNextSeason={canStartNextSeason}
            onBeginRegularSeason={beginRegularSeason}
            onSkipRemainingExhibitions={skipRemainingExhibitions}
            onBeginPlayoffs={beginPlayoffs}
            onBeginOffseason={beginOffseason}
            onCompleteReSignings={completeReSignings}
            onAdvanceToDraft={advanceToDraft}
            onPrepareDraft={prepareDraft}
            onAdvanceToFreeAgency={advanceToFreeAgency}
            onCompleteFreeAgency={completeFreeAgency}
            onStartNextSeason={() => void startNextSeason()}
          />
        </div>
      </div>
    </div>
  )
}

function OperationsHeader({
  state,
  leagueName,
  selectedTeamName,
  teamAbbrev,
  teamOverall,
  rank,
  standing,
  payroll,
  capSpace,
  rosterCount,
  cutsNeeded,
  rosterOverLimit,
  urgentCount,
}: {
  state: SeasonState
  leagueName: string
  selectedTeamName: string | null
  teamAbbrev: string | null
  teamOverall: number | null
  rank: number | null
  standing: Standing | null
  payroll: number | null
  capSpace: number | null
  rosterCount: number | null
  cutsNeeded: number
  rosterOverLimit: boolean
  urgentCount: number
}) {
  const calendar = getCurrentCalendar(state)

  return (
    <section className="rounded-lg border bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-medium">{leagueName}</h1>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              Season {state.season}
            </span>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {phaseLabel(state.phase)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedTeamName
              ? `${selectedTeamName}${teamAbbrev ? ` · ${teamAbbrev}` : ""} · ${calendar.date.label} · Day ${state.currentDay}`
              : "Pick a team to start operating the league office."}
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-7">
          <HeaderStat
            label="Record"
            value={standing ? `${standing.wins}-${standing.losses}` : "-"}
          />
          <HeaderStat label="Rank" value={rank ? `#${rank}` : "-"} />
          <HeaderStat
            label="Overall"
            value={teamOverall === null ? "-" : String(teamOverall)}
          />
          <HeaderStat
            label="Payroll"
            value={payroll === null ? "-" : formatMoney(payroll)}
          />
          <HeaderStat
            label="Cap"
            value={capSpace === null ? "-" : formatMoney(capSpace)}
            tone={capSpace !== null && capSpace < 0 ? "urgent" : undefined}
          />
          <HeaderStat
            label="Roster"
            value={
              rosterCount === null
                ? "-"
                : rosterOverLimit
                  ? `${rosterCount}/15 · cut ${cutsNeeded}`
                  : `${rosterCount}/15`
            }
            tone={rosterOverLimit ? "urgent" : undefined}
          />
          <HeaderStat
            label="Open items"
            value={urgentCount === 0 ? "Clear" : String(urgentCount)}
            tone={urgentCount > 0 ? "urgent" : undefined}
          />
        </div>
      </div>
    </section>
  )
}

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "urgent"
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p
        className={
          tone === "urgent"
            ? "mt-0.5 truncate font-medium text-destructive"
            : "mt-0.5 truncate font-medium"
        }
      >
        {value}
      </p>
    </div>
  )
}

function ScheduleRail({
  state,
  userTeamId,
  games,
}: {
  state: SeasonState
  userTeamId: string | null
  games: ScheduleGame[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Schedule rail</CardTitle>
        <CardDescription>
          Upcoming league games from the current day pointer.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {games.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {games.map((game) => {
              const isUserGame =
                userTeamId !== null &&
                (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId)
              const isCurrentDay = game.day === state.currentDay

              return (
                <Link
                  key={game.id}
                  to="/league/calendar"
                  className={cn(
                    "min-w-36 rounded-md border bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    isCurrentDay && "border-foreground/40 bg-background",
                    isUserGame && "bg-background"
                  )}
                >
                  <span className="block text-muted-foreground">
                    Day {game.day}
                  </span>
                  <span className="mt-0.5 block truncate font-medium">
                    {formatScheduledLine(state, game)}
                  </span>
                  {isUserGame ? (
                    <span className="mt-1 block text-[0.625rem] text-muted-foreground">
                      Your game
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No scheduled games remain.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

type StandingsRow = {
  teamId: string
  rank: number
  team: string
  record: string
  pct: string
  wins: number
  losses: number
}

function ConferenceStandingsTable({
  rows,
  userTeamId,
}: {
  rows: StandingsRow[]
  userTeamId: string | null
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ])
  const columns = useMemo<ColumnDef<StandingsRow>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "Rank",
        cell: ({ row }) => row.original.rank,
      },
      {
        accessorKey: "team",
        header: "Team",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.team}</span>
        ),
      },
      {
        accessorKey: "record",
        header: "Record",
        sortingFn: (a, b) =>
          a.original.wins - b.original.wins ||
          b.original.losses - a.original.losses,
      },
      {
        accessorKey: "pct",
        header: "PCT",
      },
    ],
    []
  )
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Conference standings</CardTitle>
        <CardDescription>
          The table for your team&apos;s side of the league.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SortableTable
          table={table}
          emptyLabel="No standings available."
          rowClassName={(row) =>
            row.original.teamId === userTeamId ? "bg-muted/60 hover:bg-muted/70" : ""
          }
        />
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/league/standings">View full standings</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

type RosterRow = {
  playerId: string
  player: string
  pos: string
  age: number
  overall: number
  gp: number
  min: number | null
  pts: number | null
  reb: number | null
  ast: number | null
}

function RosterOverviewTable({ rows }: { rows: RosterRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "overall", desc: true },
  ])
  const columns = useMemo<ColumnDef<RosterRow>[]>(
    () => [
      {
        accessorKey: "player",
        header: "Player",
        cell: ({ row }) => (
          <Link
            to="/league/players/$playerId"
            params={{ playerId: row.original.playerId }}
            className="font-medium hover:underline"
          >
            {row.original.player}
          </Link>
        ),
      },
      { accessorKey: "pos", header: "Pos" },
      { accessorKey: "age", header: "Age" },
      {
        accessorKey: "overall",
        header: "OVR",
      },
      {
        accessorKey: "min",
        header: "MIN",
        cell: ({ row }) => formatAverage(row.original.min),
        sortingFn: nullableNumberSort("min"),
      },
      {
        accessorKey: "pts",
        header: "PTS",
        cell: ({ row }) => formatAverage(row.original.pts),
        sortingFn: nullableNumberSort("pts"),
      },
      {
        accessorKey: "reb",
        header: "REB",
        cell: ({ row }) => formatAverage(row.original.reb),
        sortingFn: nullableNumberSort("reb"),
      },
      {
        accessorKey: "ast",
        header: "AST",
        cell: ({ row }) => formatAverage(row.original.ast),
        sortingFn: nullableNumberSort("ast"),
      },
    ],
    []
  )
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Roster</CardTitle>
        <CardDescription>
          Per-game averages from completed games. Ratings stay visible before
          stats exist.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SortableTable table={table} emptyLabel="No roster selected." />
      </CardContent>
    </Card>
  )
}

function SortableTable<TData>({
  table,
  emptyLabel,
  rowClassName,
}: {
  table: ReturnType<typeof useReactTable<TData>>
  emptyLabel: string
  rowClassName?: (row: { original: TData }) => string
}) {
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : (
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 text-left font-medium",
                      header.column.getCanSort() && "hover:text-foreground"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getIsSorted() ? (
                      <span className="text-[0.625rem] text-muted-foreground">
                        {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </button>
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={rowClassName?.(row)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={table.getAllColumns().length}
              className="text-muted-foreground"
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function LeagueNotesCard({
  state,
  championTeamId,
  urgentItems,
  recentGames,
  developmentReport,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
  onBeginRegularSeason,
  onSkipRemainingExhibitions,
  onBeginPlayoffs,
  onBeginOffseason,
  onCompleteReSignings,
  onAdvanceToDraft,
  onPrepareDraft,
  onAdvanceToFreeAgency,
  onCompleteFreeAgency,
  onStartNextSeason,
}: {
  state: SeasonState
  championTeamId: string | null
  urgentItems: UrgentItem[]
  recentGames: SeasonState["games"]
  developmentReport: PreseasonDevelopmentReport | null
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
  onBeginRegularSeason: () => void
  onSkipRemainingExhibitions: () => void
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onCompleteReSignings: () => void
  onAdvanceToDraft: () => void
  onPrepareDraft: () => void
  onAdvanceToFreeAgency: () => void
  onCompleteFreeAgency: () => void
  onStartNextSeason: () => void
}) {
  const calendar = getCurrentCalendar(state)
  const championName = championTeamId ? teamName(state, championTeamId) : null

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>League notes</CardTitle>
        <CardDescription>
          Results, blockers, and season gates. This area can host generated
          league events later.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-2">
            <NoteMetric label="Trade deadline" value={getCurrentCalendar({
              ...state,
              currentDay: calendar.milestones.tradeDeadlineDay,
            }).date.label} />
            <NoteMetric
              label="Season state"
              value={
                championName
                  ? `${championName} won the title`
                  : phaseDescription(state.phase, state.offseasonPhase)
              }
            />
          </div>

          {urgentItems.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {urgentItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-md border bg-muted/20 px-3 py-2 text-xs",
                    item.tone === "urgent" &&
                      "border-destructive/40 bg-destructive/10 text-destructive"
                  )}
                >
                  <p className="font-medium">{item.label}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-muted-foreground",
                      item.tone === "urgent" && "text-destructive"
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No blockers. Advance when you are done reviewing the roster and
              standings.
            </p>
          )}

          <PhaseActions
            state={state}
            canBeginRegularSeason={canBeginRegularSeason}
            canBeginPlayoffs={canBeginPlayoffs}
            canBeginOffseason={canBeginOffseason}
            canSimAiReSignings={canSimAiReSignings}
            canProceedToDraft={canProceedToDraft}
            canPrepareDraft={canPrepareDraft}
            canProceedToFreeAgency={canProceedToFreeAgency}
            canSimAiFreeAgency={canSimAiFreeAgency}
            canStartNextSeason={canStartNextSeason}
            onBeginRegularSeason={onBeginRegularSeason}
            onSkipRemainingExhibitions={onSkipRemainingExhibitions}
            onBeginPlayoffs={onBeginPlayoffs}
            onBeginOffseason={onBeginOffseason}
            onCompleteReSignings={onCompleteReSignings}
            onAdvanceToDraft={onAdvanceToDraft}
            onPrepareDraft={onPrepareDraft}
            onAdvanceToFreeAgency={onAdvanceToFreeAgency}
            onCompleteFreeAgency={onCompleteFreeAgency}
            onStartNextSeason={onStartNextSeason}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Recent results</p>
            <div className="mt-2 flex flex-col gap-1">
              {recentGames.length > 0 ? (
                recentGames.map((game) => (
                  <Button
                    key={game.id}
                    variant="ghost"
                    className="h-auto justify-start px-2 py-1.5 text-left font-normal"
                    asChild
                  >
                    <Link
                      to="/league/games/$gameId"
                      params={{ gameId: game.id }}
                    >
                      {formatGameLine(state, game)}
                    </Link>
                  </Button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Results appear after you simulate the first day.
                </p>
              )}
            </div>
          </div>

          {developmentReport ? (
            <DevelopmentReportSummary
              report={developmentReport}
              seasonState={state}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

type UrgentItem = {
  label: string
  description: string
  tone?: "urgent"
}

function getUrgentItems({
  phase,
  error,
  rosterOverLimit,
  cutsNeeded,
  pendingTradeOfferCount,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
}: {
  phase: SeasonPhase
  error: string | null
  rosterOverLimit: boolean
  cutsNeeded: number
  pendingTradeOfferCount: number
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
}): UrgentItem[] {
  const items: UrgentItem[] = []

  if (error) {
    items.push({
      label: "Command failed",
      description: error,
      tone: "urgent",
    })
  }
  if (pendingTradeOfferCount > 0) {
    items.push({
      label: "Pending trade offers",
      description: `${pendingTradeOfferCount} trade offer${
        pendingTradeOfferCount === 1 ? "" : "s"
      } waiting on your decision. Review them on the trades page.`,
      tone: "urgent",
    })
  }
  if (phase === "preseason" && rosterOverLimit) {
    items.push({
      label: "Camp roster cuts",
      description: `Cut ${cutsNeeded} player${cutsNeeded === 1 ? "" : "s"} to reach a 15-man roster before the regular season.`,
      tone: "urgent",
    })
  }
  if (phase !== "preseason" && rosterOverLimit) {
    items.push({
      label: "Roster over limit",
      description: `Release ${cutsNeeded} player${cutsNeeded === 1 ? "" : "s"} before starting the next season.`,
      tone: "urgent",
    })
  }
  if (canBeginRegularSeason) {
    items.push({
      label: "Preseason complete",
      description: "Begin the regular season when your roster is set.",
    })
  }
  if (canBeginPlayoffs) {
    items.push({
      label: "Regular season complete",
      description:
        "Begin playoffs when you are done reviewing final standings.",
    })
  }
  if (canBeginOffseason) {
    items.push({
      label: "Season complete",
      description:
        "Begin the offseason to handle re-signings, draft, and free agency.",
    })
  }
  if (canSimAiReSignings) {
    items.push({
      label: "AI re-signings ready",
      description:
        "Your re-signing window is complete. Sim AI re-signings to continue.",
    })
  }
  if (canProceedToDraft || canPrepareDraft) {
    items.push({
      label: "Draft gate",
      description: canPrepareDraft
        ? "Prepare the draft class before opening the draft room."
        : "Proceed to the draft when re-signings are complete.",
    })
  }
  if (canProceedToFreeAgency || canSimAiFreeAgency) {
    items.push({
      label: "Free agency gate",
      description: canSimAiFreeAgency
        ? "Finish your signings, then let AI teams complete free agency."
        : "Proceed to free agency when the draft is complete.",
    })
  }
  if (canStartNextSeason) {
    items.push({
      label: "Next season ready",
      description:
        "Start the next season once your roster and cap sheet are set.",
    })
  }
  if (phase === "playoffs" && items.length === 0) {
    items.push({
      label: "Playoff bracket active",
      description:
        "Use the playoff page for bracket context or advance the postseason here.",
    })
  }

  return items
}

function NoteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}

function PhaseActions({
  state,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
  onBeginRegularSeason,
  onSkipRemainingExhibitions,
  onBeginPlayoffs,
  onBeginOffseason,
  onCompleteReSignings,
  onAdvanceToDraft,
  onPrepareDraft,
  onAdvanceToFreeAgency,
  onCompleteFreeAgency,
  onStartNextSeason,
}: {
  state: SeasonState
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
  onBeginRegularSeason: () => void
  onSkipRemainingExhibitions: () => void
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onCompleteReSignings: () => void
  onAdvanceToDraft: () => void
  onPrepareDraft: () => void
  onAdvanceToFreeAgency: () => void
  onCompleteFreeAgency: () => void
  onStartNextSeason: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {state.phase === "preseason" ? (
        <>
          <Button variant="secondary" size="sm" onClick={onSkipRemainingExhibitions}>
            Skip exhibitions
          </Button>
          {canBeginRegularSeason ? (
            <Button size="sm" onClick={onBeginRegularSeason}>
              Begin regular season
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/team">Manage roster</Link>
          </Button>
        </>
      ) : null}

      {canBeginPlayoffs ? (
        <Button size="sm" onClick={onBeginPlayoffs}>
          Begin playoffs
        </Button>
      ) : null}

      {state.phase === "playoffs" ? (
        <Button variant="secondary" size="sm" asChild>
          <Link to="/league/playoffs">View bracket</Link>
        </Button>
      ) : null}

      {canBeginOffseason ? (
        <Button size="sm" onClick={onBeginOffseason}>
          Begin offseason
        </Button>
      ) : null}

      {canSimAiReSignings ? (
        <Button size="sm" onClick={onCompleteReSignings}>
          Sim AI re-signings
        </Button>
      ) : null}

      {canProceedToDraft ? (
        <Button variant="secondary" size="sm" onClick={onAdvanceToDraft}>
          Proceed to draft
        </Button>
      ) : null}

      {canPrepareDraft ? (
        <Button size="sm" onClick={onPrepareDraft}>
          Prepare draft
        </Button>
      ) : null}

      {state.phase === "offseason" &&
      state.draftState &&
      !state.draftState.completed ? (
        <Button variant="secondary" size="sm" asChild>
          <Link to="/league/draft">Go to draft</Link>
        </Button>
      ) : null}

      {canProceedToFreeAgency ? (
        <Button size="sm" onClick={onAdvanceToFreeAgency}>
          Proceed to free agency
        </Button>
      ) : null}

      {canSimAiFreeAgency ? (
        <Button variant="secondary" size="sm" onClick={onCompleteFreeAgency}>
          Sim AI free agency
        </Button>
      ) : null}

      {canStartNextSeason ? (
        <Button size="sm" onClick={onStartNextSeason}>
          Start Season {state.season + 1}
        </Button>
      ) : null}

      {state.phase === "complete" || state.phase === "offseason" ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/league/history">View history</Link>
        </Button>
      ) : null}
    </div>
  )
}

function DevelopmentReportSummary({
  report,
  seasonState,
}: {
  report: PreseasonDevelopmentReport
  seasonState: SeasonState
}) {
  const allPlayers = seasonState.teams.flatMap((team) => team.players)

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <p className="text-sm font-medium">Development report</p>
      <div className="mt-2 grid gap-3">
        <div>
          <p className="font-medium">Risers</p>
          {report.topRisers.length === 0 ? (
            <p className="text-muted-foreground">No major risers this year.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {report.topRisers.slice(0, 3).map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3">
                  <Link
                    to="/league/players/$playerId"
                    params={{ playerId: entry.playerId }}
                    className="hover:underline"
                  >
                    {playerName(allPlayers, entry.playerId)}
                  </Link>
                  <span>
                    {entry.overallBefore} → {entry.overallAfter} (
                    {entry.overallAfter - entry.overallBefore > 0 ? "+" : ""}
                    {entry.overallAfter - entry.overallBefore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="font-medium">Fallers</p>
          {report.topFallers.length === 0 ? (
            <p className="text-muted-foreground">No major fallers this year.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {report.topFallers.slice(0, 3).map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3">
                  <Link
                    to="/league/players/$playerId"
                    params={{ playerId: entry.playerId }}
                    className="hover:underline"
                  >
                    {playerName(allPlayers, entry.playerId)}
                  </Link>
                  <span>
                    {entry.overallBefore} → {entry.overallAfter}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {report.retirements.length > 0 ? (
          <div>
            <p className="font-medium">Retirements ({report.retirements.length})</p>
            <p className="text-muted-foreground">
              {report.retirements.length} player
              {report.retirements.length === 1 ? "" : "s"} retired this preseason.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function getConferenceStandingsRows(
  state: SeasonState,
  userTeamId: string | null
): StandingsRow[] {
  const userTeam = userTeamId
    ? (state.teams.find((team) => team.id === userTeamId) ?? null)
    : null
  const conferenceId = userTeam?.conferenceId ?? null
  const allowedTeamIds = new Set(
    conferenceId
      ? state.teams
          .filter((team) => team.conferenceId === conferenceId)
          .map((team) => team.id)
      : state.teams.map((team) => team.id)
  )

  return state.standings
    .map((standing, index) => ({
      teamId: standing.teamId,
      rank: index + 1,
      team: teamName(state, standing.teamId),
      record: `${standing.wins}-${standing.losses}`,
      pct: winPct(standing.wins, standing.losses),
      wins: standing.wins,
      losses: standing.losses,
    }))
    .filter((row) => allowedTeamIds.has(row.teamId))
}

function getRosterRows(
  state: SeasonState,
  teamId: string | null
): RosterRow[] {
  const team = teamId ? state.teams.find((entry) => entry.id === teamId) : null
  if (!team) {
    return []
  }

  const statsByPlayerId = new Map(
    state.playerSeasonStats.map((stats) => [stats.playerId, stats])
  )

  return team.players
    .map((player) => toRosterRow(player, statsByPlayerId.get(player.id)))
    .sort((a, b) => b.overall - a.overall || a.age - b.age)
}

function toRosterRow(
  player: Player,
  stats: PlayerSeasonStats | undefined
): RosterRow {
  return {
    playerId: player.id,
    player: `${player.firstName} ${player.lastName}`,
    pos: player.position,
    age: player.age,
    overall: player.ratings.overall,
    gp: stats?.gp ?? 0,
    min: average(stats?.min, stats?.gp),
    pts: average(stats?.pts, stats?.gp),
    reb: average(stats?.reb, stats?.gp),
    ast: average(stats?.ast, stats?.gp),
  }
}

function average(total: number | undefined, games: number | undefined): number | null {
  if (!total || !games) {
    return null
  }
  return total / games
}

function formatAverage(value: number | null): string {
  return value === null ? "-" : value.toFixed(1)
}

function nullableNumberSort(key: keyof RosterRow) {
  return (a: { original: RosterRow }, b: { original: RosterRow }) => {
    const first = a.original[key]
    const second = b.original[key]
    const firstValue = typeof first === "number" ? first : -1
    const secondValue = typeof second === "number" ? second : -1
    return firstValue - secondValue
  }
}

function phaseLabel(phase: SeasonPhase): string {
  if (phase === "preseason") return "Preseason"
  if (phase === "playoffs") return "Playoffs"
  if (phase === "complete") return "Season complete"
  if (phase === "offseason") return "Offseason"
  return "Regular season"
}

function phaseDescription(
  phase: SeasonPhase,
  offseasonPhase: SeasonState["offseasonPhase"]
): string {
  if (phase === "preseason") {
    return "Run exhibitions, cut to 15, then start the regular season"
  }
  if (phase === "regular") {
    return "Advance through the regular season schedule"
  }
  if (phase === "playoffs") {
    return "Postseason bracket is active"
  }
  if (phase === "offseason" && offseasonPhase === "draft") {
    return "Draft stage is active"
  }
  if (phase === "offseason" && offseasonPhase === "free_agency") {
    return "Free agency stage is active"
  }
  if (phase === "offseason") {
    return "Re-signing stage is active"
  }
  return "Season complete"
}
