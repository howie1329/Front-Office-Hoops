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
    const userTeamId = myTeam ? myTeam.id : null
    const standingsRows = getConferenceStandingsRows(seasonState, userTeamId)
    const rank = myStanding
      ? (standingsRows.find((row) => row.teamId === myStanding.teamId)?.rank ??
        null)
      : null
    const rosterRows = getRosterRows(seasonState, userTeamId)
    const teamSchedule = seasonState.schedule.filter(
      (game) =>
        userTeamId !== null &&
        (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId)
    )
    const recentGames = teamSchedule
      .filter((game) => game.status === "final")
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
      .slice(0, 4)
      .reverse()
    const upcomingGames = teamSchedule
      .filter((game) => game.status === "scheduled")
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .slice(0, 8)
    return {
      myStanding,
      rank,
      rosterRows,
      standingsRows,
      scheduleRail: [...recentGames, ...upcomingGames],
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
            salaryCap={financials?.seasonFinancials.salaryCap ?? null}
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
            games={dashboard?.scheduleRail ?? []}
            urgentItems={urgentItems}
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

          <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(380px,0.9fr)_minmax(560px,1.1fr)]">
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
  salaryCap,
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
  salaryCap: number | null
  capSpace: number | null
  rosterCount: number | null
  cutsNeeded: number
  rosterOverLimit: boolean
  urgentCount: number
}) {
  const calendar = getCurrentCalendar(state)

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex min-w-0 items-end justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">League dashboard</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {leagueName} · {selectedTeamName ?? "No team selected"}
          </p>
        </div>
        {urgentCount > 0 ? (
          <span className="shrink-0 text-xs font-medium text-warning">
            {urgentCount} need{urgentCount === 1 ? "s" : ""} attention
          </span>
        ) : null}
      </div>

      <section
        aria-label="League status"
        className="overflow-x-auto rounded-lg ring-1 ring-foreground/10"
      >
        <div className="grid min-w-[880px] grid-cols-[0.8fr_1fr_1.2fr_1.5fr_0.9fr_0.9fr_1.4fr_1fr] bg-card px-1 py-2 text-xs tabular-nums">
          <StatusField label="Season" value={`Season ${state.season}`} />
          <StatusField label="Phase" value={phaseLabel(state.phase)} />
          <StatusField
            label="Date"
            value={`Day ${state.currentDay} · ${calendar.date.label}`}
          />
          <StatusField
            label="Team"
            value={
              selectedTeamName
                ? `${selectedTeamName}${teamAbbrev ? ` · ${teamAbbrev}` : ""}`
                : "Not selected"
            }
          />
          <StatusField
            label="Record"
            value={standing ? `${standing.wins}-${standing.losses}` : "—"}
          />
          <StatusField label="Conf. rank" value={rank ? `#${rank}` : "—"} />
          <StatusField
            label="Payroll / cap"
            value={
              payroll === null || salaryCap === null
                ? "—"
                : `${formatMoney(payroll)} / ${formatMoney(salaryCap)}`
            }
            tone={capSpace !== null && capSpace < 0 ? "negative" : undefined}
          />
          <StatusField
            label="Roster"
            value={
              rosterCount === null
                ? "—"
                : rosterOverLimit
                  ? `${rosterCount}/15 · cut ${cutsNeeded}`
                  : state.phase === "preseason"
                    ? `${rosterCount}/21 camp`
                    : `${rosterCount}/15${teamOverall === null ? "" : ` · ${teamOverall} OVR`}`
            }
            tone={rosterOverLimit ? "warning" : undefined}
          />
        </div>
      </section>
    </div>
  )
}

function StatusField({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "negative" | "warning"
}) {
  return (
    <div className="min-w-0 border-l border-border px-3 first:border-l-0">
      <p className="text-[0.625rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-medium",
          tone === "negative" && "text-destructive",
          tone === "warning" && "text-warning"
        )}
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
  urgentItems,
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
  urgentItems: UrgentItem[]
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
  const nextMilestone = getNextMilestone(state)
  const nextTeamGame = games.find((game) => game.status === "scheduled")

  return (
    <section className="shrink-0 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(230px,1.25fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(140px,0.8fr)]">
        <div className="flex items-center p-3">
          {showControls && canAdvance ? (
            <AdvanceSplitButton
              className="sm:min-w-[230px]"
              phase={phase}
              size="default"
              primaryLabel="Continue simulation"
              disabled={status === "loading"}
              onAdvance={onAdvance}
              onSimPlayoffs={onSimPlayoffs}
            />
          ) : (
            <p className="text-xs font-medium">Season controls</p>
          )}
        </div>
        <CommandField label="Next milestone" value={nextMilestone} />
        <CommandField
          label="Next team game"
          value={
            nextTeamGame
              ? `${formatCalendarDay(state, nextTeamGame.day)} · Day ${nextTeamGame.day}`
              : "No game scheduled"
          }
        />
        <CommandField
          label={urgentItems.length > 0 ? "Needs attention" : "League state"}
          value={
            urgentItems[0]?.label ??
            (saveStatus === "saving" ? "Saving…" : "Ready to advance")
          }
          tone={urgentItems.length > 0 ? "warning" : "default"}
        />
      </div>

      <div className="border-t px-3 py-2">
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
          <span>{state.games.length} games played</span>
          <span>{remainingGames} league games left</span>
          {saveStatus === "saving" ? <span>Saving locally…</span> : null}
          {saveStatus === "saved" ? <span>Saved locally</span> : null}
          {lastAdvanceResult ? (
            <span>
              Last run: {lastAdvanceResult.daysSimmed} day
              {lastAdvanceResult.daysSimmed === 1 ? "" : "s"} ·{" "}
              {lastAdvanceResult.gamesSimmed} game
              {lastAdvanceResult.gamesSimmed === 1 ? "" : "s"}
            </span>
          ) : null}
          {error ? (
            <span className="font-medium text-destructive">{error}</span>
          ) : null}
        </div>
      </div>

      <div className="border-t px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium">Team schedule</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/league/calendar">View full schedule</Link>
          </Button>
        </div>
        {userTeamId === null ? (
          <p className="text-xs text-muted-foreground">
            Pick a team to show its schedule.
          </p>
        ) : games.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {games.map((game) => (
              <ScheduleRailItem
                key={game.id}
                state={state}
                game={game}
                userTeamId={userTeamId}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No scheduled games remain for your team.
          </p>
        )}
      </div>
    </section>
  )
}

function CommandField({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "warning"
}) {
  return (
    <div className="min-w-0 border-t px-3 py-2.5 sm:border-l lg:border-t-0 [&:nth-child(2)]:sm:border-t-0 [&:nth-child(3)]:sm:border-l-0 [&:nth-child(3)]:lg:border-l">
      <p className="text-[0.625rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-xs font-medium tabular-nums",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ScheduleRailItem({
  state,
  game,
  userTeamId,
}: {
  state: SeasonState
  game: ScheduleGame
  userTeamId: string
}) {
  const playedGame = game.gameId
    ? state.games.find((entry) => entry.id === game.gameId)
    : undefined
  const userIsHome = game.homeTeamId === userTeamId
  const opponentId = userIsHome ? game.awayTeamId : game.homeTeamId
  const opponent = teamName(state, opponentId)
  const userScore = playedGame
    ? userIsHome
      ? playedGame.result.homeScore
      : playedGame.result.awayScore
    : null
  const opponentScore = playedGame
    ? userIsHome
      ? playedGame.result.awayScore
      : playedGame.result.homeScore
    : null
  const won =
    userScore !== null && opponentScore !== null && userScore > opponentScore
  const resultLabel =
    userScore !== null && opponentScore !== null
      ? `${won ? "W" : "L"} ${userScore}–${opponentScore}`
      : null
  const className = cn(
    "min-w-40 rounded-md border bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
    game.day === state.currentDay && "border-foreground/40 bg-background"
  )
  const content = (
    <>
      <span className="block truncate text-muted-foreground">
        {formatCalendarDay(state, game.day)}
      </span>
      <span className="mt-1 block truncate font-medium">
        {userIsHome ? "vs" : "@"} {opponent}
      </span>
      <span
        className={cn(
          "mt-1 block font-medium tabular-nums",
          resultLabel
            ? won
              ? "text-success"
              : "text-destructive"
            : "text-muted-foreground"
        )}
      >
        {resultLabel ?? formatScheduledLine(state, game)}
      </span>
    </>
  )

  return game.gameId ? (
    <Link
      to="/league/games/$gameId"
      params={{ gameId: game.gameId }}
      className={className}
    >
      {content}
    </Link>
  ) : (
    <Link to="/league/calendar" className={className}>
      {content}
    </Link>
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
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs">
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
  pct: string
  pctValue: number
  differential: number
  streak: number
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
        sortingFn: (a, b) => a.original.pctValue - b.original.pctValue,
      },
      {
        accessorKey: "differential",
        header: "DIFF",
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              row.original.differential > 0 && "text-success",
              row.original.differential < 0 && "text-destructive"
            )}
          >
            {formatSigned(row.original.differential)}
          </span>
        ),
      },
      {
        accessorKey: "streak",
        header: "STRK",
        cell: ({ row }) => (
          <span
            className={cn(
              "font-medium tabular-nums",
              row.original.streak > 0 && "text-success",
              row.original.streak < 0 && "text-destructive"
            )}
          >
            {row.original.streak === 0
              ? "—"
              : `${row.original.streak > 0 ? "W" : "L"}${Math.abs(row.original.streak)}`}
          </span>
        ),
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
      <CardContent className="max-h-[48vh] overflow-y-auto">
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
      <CardContent className="max-h-[48vh] overflow-y-auto">
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
    .filter((standing) => allowedTeamIds.has(standing.teamId))
    .map((standing, index) => {
      const gamesPlayed = standing.wins + standing.losses
      const pctValue = gamesPlayed > 0 ? standing.wins / gamesPlayed : 0
      const differential =
        gamesPlayed > 0
          ? (standing.pointsFor - standing.pointsAgainst) / gamesPlayed
          : 0

      return {
        teamId: standing.teamId,
        rank: index + 1,
        team: teamName(state, standing.teamId),
        record: `${standing.wins}-${standing.losses}`,
        wins: standing.wins,
        losses: standing.losses,
        pct: pctValue.toFixed(3).replace(/^0/, ""),
        pctValue,
        differential,
        streak: standing.streak,
      }
    })
}

function formatCalendarDay(state: SeasonState, day: number): string {
  return getCurrentCalendar({ ...state, currentDay: day }).date.label
}

function getNextMilestone(state: SeasonState): string {
  const calendar = getCurrentCalendar(state)
  const milestones = calendar.milestones
  const candidates = [
    { label: "Trade deadline", day: milestones.tradeDeadlineDay },
    { label: "Playoffs", day: milestones.playoffsStartDay },
    { label: "Offseason", day: milestones.offseasonStartDay },
    { label: "Draft", day: milestones.draftDay },
    { label: "Free agency", day: milestones.freeAgencyStartDay },
    { label: `Season ${state.season + 1}`, day: milestones.nextSeasonStartDay },
  ]
  const next = candidates.find((candidate) => candidate.day >= state.currentDay)

  if (!next) {
    return "Season complete"
  }

  const daysAway = Math.max(0, next.day - state.currentDay)
  return `${next.label} · ${daysAway === 0 ? "today" : `${daysAway} day${daysAway === 1 ? "" : "s"}`}`
}

function formatSigned(value: number): string {
  if (Math.abs(value) < 0.05) {
    return "0.0"
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`
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
