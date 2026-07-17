import { Link, createFileRoute } from "@tanstack/react-router"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { useEffect, useMemo, useState } from "react"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  formatScheduledLine,
  teamName,
} from "@/components/league/lib/teamFormat"
import { nullableNumberSort } from "@/components/league/lib/tableSort"
import {
  SortableTable,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@/components/league/SortableTable"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type { LeagueStatus, SaveStatus } from "@/hooks/useLeague"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { getCurrentCalendar, isPreseasonComplete } from "@workspace/sim"
import type {
  AdvanceEvent,
  AdvancePolicy,
  AdvanceResult,
  AdvanceTarget,
} from "@workspace/sim"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import type {
  Player,
  PlayerSeasonStats,
  ScheduleGame,
  SeasonPhase,
  SeasonState,
  Standing,
} from "@workspace/shared/types"
import { AdvanceSplitButton } from "@/components/league/AdvanceSplitButton"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

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
    offseasonPhase,
    canBeginRegularSeason,
    canBeginPlayoffs,
    canBeginOffseason,
    canCompleteStaffPhase,
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
    rosterOverLimit,
    cutsNeeded,
    beginRegularSeason,
    beginPlayoffs,
    beginOffseason,
    completeStaffPhase,
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
      .filter(
        (game) =>
          game.status === "scheduled" &&
          userTeamId !== null &&
          (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId)
      )
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .slice(0, 16)
    return {
      myStanding,
      rank,
      rosterRows,
      standingsRows,
      nextGames,
    }
  }, [myTeam, seasonState])

  if (!seasonState) {
    return null
  }

  const isMiniLeague = seasonState.teams.length < LEAGUE_TEAM_COUNT
  const cutsRequired =
    rosterOverLimit &&
    (phase !== "preseason" || isPreseasonComplete(seasonState))
  const urgentItems = getUrgentItems({
    phase,
    offseasonPhase,
    error,
    rosterOverLimit: cutsRequired,
    cutsNeeded,
    pendingTradeOfferCount,
    canBeginRegularSeason,
    canBeginPlayoffs,
    canBeginOffseason,
    canCompleteStaffPhase,
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
  })

  useEffect(() => {
    if (!lastAdvanceResult) {
      return
    }

    for (const event of lastAdvanceResult.events ?? []) {
      showAdvanceEventToast(event, seasonState)
    }

    if (lastAdvanceResult.stoppedReason) {
      showAdvanceStopToast(lastAdvanceResult, cutsNeeded)
    }
  }, [cutsNeeded, lastAdvanceResult, seasonState])

  useEffect(() => {
    if (error) {
      toast.error("Action blocked", {
        description: error,
      })
    }
  }, [error])

  const handleAdvance = (target: AdvanceTarget, policy?: AdvancePolicy) => {
    advance(target, policy)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
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
        <div className="flex min-h-0 min-w-0 flex-col gap-3 xl:overflow-y-auto xl:p-px">
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
            rosterOverLimit={cutsRequired}
            urgentCount={urgentItems.length}
          />

          <ScheduleRail
            state={seasonState}
            phase={phase}
            status={status}
            saveStatus={saveStatus}
            error={error}
            lastAdvanceResult={lastAdvanceResult}
            userTeamId={myTeam?.id ?? null}
            games={dashboard?.nextGames ?? []}
            rosterOverLimit={cutsRequired}
            cutsNeeded={cutsNeeded}
            canBeginRegularSeason={canBeginRegularSeason}
            canBeginPlayoffs={canBeginPlayoffs}
            canBeginOffseason={canBeginOffseason}
            canCompleteStaffPhase={canCompleteStaffPhase}
            canSimAiReSignings={canSimAiReSignings}
            canProceedToDraft={canProceedToDraft}
            canPrepareDraft={canPrepareDraft}
            canProceedToFreeAgency={canProceedToFreeAgency}
            canSimAiFreeAgency={canSimAiFreeAgency}
            canStartNextSeason={canStartNextSeason}
            onAdvance={handleAdvance}
            onSimPlayoffs={simulatePlayoffs}
            onBeginRegularSeason={beginRegularSeason}
            onBeginPlayoffs={beginPlayoffs}
            onBeginOffseason={beginOffseason}
            onCompleteStaffPhase={completeStaffPhase}
            onCompleteReSignings={completeReSignings}
            onAdvanceToDraft={advanceToDraft}
            onPrepareDraft={prepareDraft}
            onAdvanceToFreeAgency={advanceToFreeAgency}
            onCompleteFreeAgency={completeFreeAgency}
            onStartNextSeason={() => void startNextSeason()}
          />

          <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(210px,0.24fr)_minmax(0,0.76fr)]">
            <ConferenceStandingsTable
              rows={dashboard?.standingsRows ?? []}
              userTeamId={myTeam?.id ?? null}
            />
            <RosterOverviewTable rows={dashboard?.rosterRows ?? []} />
          </div>
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
    <section className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2">
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
                  : state.phase === "preseason"
                    ? `${rosterCount}/21 camp`
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
    <div className="rounded-md border bg-background px-3 py-1.5">
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
  phase,
  status,
  saveStatus,
  error,
  lastAdvanceResult,
  userTeamId,
  games,
  rosterOverLimit,
  cutsNeeded,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canCompleteStaffPhase,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
  onAdvance,
  onSimPlayoffs,
  onBeginRegularSeason,
  onBeginPlayoffs,
  onBeginOffseason,
  onCompleteStaffPhase,
  onCompleteReSignings,
  onAdvanceToDraft,
  onPrepareDraft,
  onAdvanceToFreeAgency,
  onCompleteFreeAgency,
  onStartNextSeason,
}: {
  state: SeasonState
  phase: SeasonPhase
  status: LeagueStatus
  saveStatus: SaveStatus
  error: string | null
  lastAdvanceResult: AdvanceResult | null
  userTeamId: string | null
  games: ScheduleGame[]
  rosterOverLimit: boolean
  cutsNeeded: number
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canCompleteStaffPhase: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
  onAdvance: (target: AdvanceTarget, policy?: AdvancePolicy) => void
  onSimPlayoffs?: () => void
  onBeginRegularSeason: () => void
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onCompleteStaffPhase: () => void
  onCompleteReSignings: () => void
  onAdvanceToDraft: () => void
  onPrepareDraft: () => void
  onAdvanceToFreeAgency: () => void
  onCompleteFreeAgency: () => void
  onStartNextSeason: () => void
}) {
  const remainingGames = state.schedule.filter(
    (game) => game.status === "scheduled"
  ).length
  const canAdvance =
    phase === "regular" || phase === "preseason" || phase === "playoffs"
  const showControls = phase !== "complete" && phase !== "offseason"

  return (
    <Card size="sm">
      <CardHeader className="border-b py-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>Team schedule</CardTitle>
          <CardDescription>
            Upcoming games for the selected team.
          </CardDescription>
        </div>
        {showControls && canAdvance ? (
          <AdvanceSplitButton
            className="lg:min-w-[280px]"
            phase={phase}
            size="sm"
            disabled={status === "loading"}
            onAdvance={onAdvance}
            onSimPlayoffs={onSimPlayoffs}
          />
        ) : null}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Day {state.currentDay}</span>
          <span>{state.games.length} played</span>
          <span>{remainingGames} league games left</span>
          {saveStatus === "saving" ? <span>Saving...</span> : null}
          {saveStatus === "saved" ? <span>Saved locally</span> : null}
        </div>
        {lastAdvanceResult ? (
          <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Simulated {lastAdvanceResult.daysSimmed} day
            {lastAdvanceResult.daysSimmed === 1 ? "" : "s"} ·{" "}
            {lastAdvanceResult.gamesSimmed} game
            {lastAdvanceResult.gamesSimmed === 1 ? "" : "s"}
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <ScheduleGateActions
          state={state}
          rosterOverLimit={rosterOverLimit}
          cutsNeeded={cutsNeeded}
          canBeginRegularSeason={canBeginRegularSeason}
          canBeginPlayoffs={canBeginPlayoffs}
          canBeginOffseason={canBeginOffseason}
          canCompleteStaffPhase={canCompleteStaffPhase}
          canSimAiReSignings={canSimAiReSignings}
          canProceedToDraft={canProceedToDraft}
          canPrepareDraft={canPrepareDraft}
          canProceedToFreeAgency={canProceedToFreeAgency}
          canSimAiFreeAgency={canSimAiFreeAgency}
          canStartNextSeason={canStartNextSeason}
          onBeginRegularSeason={onBeginRegularSeason}
          onBeginPlayoffs={onBeginPlayoffs}
          onBeginOffseason={onBeginOffseason}
          onCompleteStaffPhase={onCompleteStaffPhase}
          onCompleteReSignings={onCompleteReSignings}
          onAdvanceToDraft={onAdvanceToDraft}
          onPrepareDraft={onPrepareDraft}
          onAdvanceToFreeAgency={onAdvanceToFreeAgency}
          onCompleteFreeAgency={onCompleteFreeAgency}
          onStartNextSeason={onStartNextSeason}
        />
        {userTeamId === null ? (
          <p className="text-xs text-muted-foreground">
            Pick a team to show its schedule.
          </p>
        ) : games.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {games.map((game) => {
              const isCurrentDay = game.day === state.currentDay

              return (
                <Link
                  key={game.id}
                  to="/league/calendar"
                  className={cn(
                    "min-w-36 rounded-md border bg-muted/20 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
                    isCurrentDay && "border-foreground/40 bg-background"
                  )}
                >
                  <span className="block text-muted-foreground">
                    {formatCalendarDay(state, game.day)}
                  </span>
                  <span className="mt-0.5 block truncate font-medium">
                    {formatScheduledLine(state, game)}
                  </span>
                  <span className="mt-1 block text-[0.625rem] text-muted-foreground">
                    Day {game.day}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No scheduled games remain for your team.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ScheduleGateActions({
  state,
  rosterOverLimit,
  cutsNeeded,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canCompleteStaffPhase,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
  onBeginRegularSeason,
  onBeginPlayoffs,
  onBeginOffseason,
  onCompleteStaffPhase,
  onCompleteReSignings,
  onAdvanceToDraft,
  onPrepareDraft,
  onAdvanceToFreeAgency,
  onCompleteFreeAgency,
  onStartNextSeason,
}: {
  state: SeasonState
  rosterOverLimit: boolean
  cutsNeeded: number
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canCompleteStaffPhase: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
  onBeginRegularSeason: () => void
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onCompleteStaffPhase: () => void
  onCompleteReSignings: () => void
  onAdvanceToDraft: () => void
  onPrepareDraft: () => void
  onAdvanceToFreeAgency: () => void
  onCompleteFreeAgency: () => void
  onStartNextSeason: () => void
}) {
  const showGate =
    rosterOverLimit ||
    canBeginRegularSeason ||
    canBeginPlayoffs ||
    canBeginOffseason ||
    canCompleteStaffPhase ||
    canSimAiReSignings ||
    canProceedToDraft ||
    canPrepareDraft ||
    canProceedToFreeAgency ||
    canSimAiFreeAgency ||
    canStartNextSeason ||
    state.phase === "playoffs" ||
    state.phase === "offseason" ||
    state.phase === "complete"

  if (!showGate) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
      {rosterOverLimit ? (
        <>
          <span className="font-medium text-destructive">
            Cut {cutsNeeded} player{cutsNeeded === 1 ? "" : "s"}
          </span>
          <Button variant="destructive" size="sm" asChild>
            <Link to="/league/team">Manage roster</Link>
          </Button>
        </>
      ) : null}

      {canBeginRegularSeason ? (
        <Button size="sm" onClick={onBeginRegularSeason}>
          Begin regular season
        </Button>
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

      {state.phase === "offseason" &&
      state.offseasonPhase === "contract_options" ? (
        <Button size="sm" asChild>
          <Link to="/league/team-options">Decide team options</Link>
        </Button>
      ) : null}

      {state.phase === "offseason" && state.offseasonPhase === "staff" ? (
        <Button size="sm" variant="secondary" asChild>
          <Link to="/league/staff">Manage staff</Link>
        </Button>
      ) : null}

      {canCompleteStaffPhase ? (
        <Button size="sm" onClick={onCompleteStaffPhase}>
          Complete staff phase
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

type StandingsRow = {
  teamId: string
  rank: number
  team: string
  record: string
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
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Conference standings</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[44vh] overflow-y-auto">
        <SortableTable
          table={table}
          emptyLabel="No standings available."
          rowClassName={(row) =>
            row.original.teamId === userTeamId
              ? "bg-muted/60 hover:bg-muted/70"
              : ""
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
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Roster</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[44vh] overflow-y-auto">
        <SortableTable table={table} emptyLabel="No roster selected." />
      </CardContent>
    </Card>
  )
}

function formatAverage(value: number | null): string {
  if (value === null) {
    return "—"
  }
  return value.toFixed(1)
}

type UrgentItem = {
  label: string
  description: string
  tone?: "urgent"
}

function getUrgentItems({
  phase,
  offseasonPhase,
  error,
  rosterOverLimit,
  cutsNeeded,
  pendingTradeOfferCount,
  canBeginRegularSeason,
  canBeginPlayoffs,
  canBeginOffseason,
  canCompleteStaffPhase,
  canSimAiReSignings,
  canProceedToDraft,
  canPrepareDraft,
  canProceedToFreeAgency,
  canSimAiFreeAgency,
  canStartNextSeason,
}: {
  phase: SeasonPhase
  offseasonPhase:
    "contract_options" | "staff" | "re_signing" | "draft" | "free_agency" | null
  error: string | null
  rosterOverLimit: boolean
  cutsNeeded: number
  pendingTradeOfferCount: number
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canCompleteStaffPhase: boolean
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
      description: "Advance the calendar to enter the regular season.",
    })
  }
  if (canBeginPlayoffs) {
    items.push({
      label: "Regular season complete",
      description: "Advance the calendar to open the playoffs.",
    })
  }
  if (canBeginOffseason) {
    items.push({
      label: "Season complete",
      description: "Advance the calendar to enter the offseason.",
    })
  }
  if (offseasonPhase === "contract_options") {
    items.push({
      label: "Team option decisions",
      description:
        "Exercise or decline every team option before staff negotiations open.",
      tone: "urgent",
    })
  }
  if (canCompleteStaffPhase) {
    items.push({
      label: "Staff week open",
      description: "Hire and fire coaches before re-signing opens.",
    })
  }
  if (canSimAiReSignings) {
    items.push({
      label: "Re-signing window open",
      description:
        "Handle your expiring players before the draft window opens.",
    })
  }
  if (canProceedToDraft || canPrepareDraft) {
    items.push({
      label: "Draft window",
      description: canPrepareDraft
        ? "Prepare the draft class before opening the draft room."
        : "Advance the calendar to reach the draft window.",
    })
  }
  if (canProceedToFreeAgency || canSimAiFreeAgency) {
    items.push({
      label: "Free agency window",
      description: canSimAiFreeAgency
        ? "Finish your signings before the next preseason date."
        : "Complete the draft before free agency opens.",
    })
  }
  if (canStartNextSeason) {
    items.push({
      label: "Next season ready",
      description:
        "Advance the calendar once your roster and cap sheet are set.",
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

function showAdvanceEventToast(event: AdvanceEvent, state: SeasonState) {
  switch (event.type) {
    case "game_result": {
      const home = teamName(state, event.homeTeamId)
      const away = teamName(state, event.awayTeamId)
      const result = event.won ? "Win" : "Loss"

      toast(event.won ? "You won" : "You lost", {
        description: `${result}: ${away} ${event.awayScore}, ${home} ${event.homeScore}`,
      })
      return
    }

    case "phase_started": {
      type PhaseStartedEvent = Extract<AdvanceEvent, { type: "phase_started" }>
      const labels: Record<PhaseStartedEvent["phase"], string> = {
        preseason: "Preseason started",
        regular: "Regular season started",
        playoffs: "Playoffs started",
        offseason: "Offseason started",
        contract_options: "Team options opened",
        staff: "Staff week opened",
        re_signing: "Re-signing window opened",
        draft: "Draft window opened",
        free_agency: "Free agency opened",
      }

      toast.success(labels[event.phase])
      return
    }

    case "trade_deadline_passed":
      toast("Trade deadline passed", {
        description: "Trades are now closed until the offseason.",
      })
      return

    case "champion_crowned":
      toast.success("Champion crowned", {
        description: `${teamName(state, event.teamId)} won the championship.`,
      })
      return
  }
}

function showAdvanceStopToast(result: AdvanceResult, cutsNeeded: number) {
  switch (result.stoppedReason) {
    case "roster_cuts":
      toast.error("Roster cuts required", {
        description: `Cut ${Math.max(cutsNeeded, 1)} player${
          cutsNeeded === 1 ? "" : "s"
        } before advancing.`,
        action: {
          label: "Manage roster",
          onClick: () => {
            window.location.href = "/league/team"
          },
        },
      })
      return

    case "roster_under_limit":
      toast.error("Roster under limit", {
        description: "Add players before advancing to the next phase.",
        action: {
          label: "Manage roster",
          onClick: () => {
            window.location.href = "/league/team"
          },
        },
      })
      return

    case "draft_pick":
      toast("You're on the clock", {
        description: "Make your draft pick before advancing.",
        action: {
          label: "Open draft",
          onClick: () => {
            window.location.href = "/league/draft"
          },
        },
      })
      return

    case "draft_incomplete":
      toast.error("Draft must be completed", {
        description: "Finish the draft before free agency opens.",
        action: {
          label: "Open draft",
          onClick: () => {
            window.location.href = "/league/draft"
          },
        },
      })
      return

    case "user_game":
      toast("Game day", {
        description: "Your team has a game today.",
      })
      return

    case "target_reached":
    case "begin_playoffs":
    case "begin_regular_season":
    case "begin_offseason":
    case undefined:
      return
  }
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
      wins: standing.wins,
      losses: standing.losses,
    }))
    .filter((row) => allowedTeamIds.has(row.teamId))
}

function formatCalendarDay(state: SeasonState, day: number): string {
  return getCurrentCalendar({ ...state, currentDay: day }).date.label
}

function getRosterRows(state: SeasonState, teamId: string | null): RosterRow[] {
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

function average(
  total: number | undefined,
  games: number | undefined
): number | null {
  if (!total || !games) {
    return null
  }
  return total / games
}

function phaseLabel(phase: SeasonPhase): string {
  if (phase === "preseason") return "Preseason"
  if (phase === "playoffs") return "Playoffs"
  if (phase === "complete") return "Season complete"
  if (phase === "offseason") return "Offseason"
  return "Regular season"
}
