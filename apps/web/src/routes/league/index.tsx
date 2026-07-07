import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"

import { playerName } from "@/components/box-score/playerName"
import { GameLog } from "@/components/league/GameLog"
import { SeasonPhaseCard } from "@/components/league/SeasonPhaseCard"
import { AdvanceControls } from "@/components/league/AdvanceControls"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  formatGameLine,
  formatScheduledLine,
  formatStreak,
  teamName,
  winPct,
} from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import type {
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
    return (
      league.pendingTradeOffers?.filter(
        (offer) =>
          offer.status === "pending" &&
          (offer.toTeamId === myTeam.id || offer.fromTeamId === myTeam.id),
      ).length ?? 0
    )
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
    const standingsWindow = getStandingsWindow(seasonState, myStanding)
    const myNextGame = myTeam
      ? (seasonState.schedule
          .filter(
            (game) =>
              game.status === "scheduled" &&
              (game.homeTeamId === myTeam.id || game.awayTeamId === myTeam.id)
          )
          .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))[0] ?? null)
      : null
    const todaysGames = seasonState.schedule
      .filter(
        (game) =>
          game.day === seasonState.currentDay && game.status === "scheduled"
      )
      .slice(0, 5)
    const nextGames = seasonState.schedule
      .filter((game) => game.status === "scheduled")
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .slice(0, 5)
    const recentGames = seasonState.games
      .slice()
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
      .slice(0, 5)

    return {
      myStanding,
      rank,
      standingsWindow,
      myNextGame,
      todaysGames,
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
  const primaryAction = getPrimaryAction(urgentItems, phase)

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

      <div className="-m-px grid min-h-0 flex-1 gap-4 overflow-y-auto p-px xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto xl:p-px">
          <OperationsHeader
            state={seasonState}
            leagueName={league?.name ?? "League"}
            teamName={myTeam?.name ?? null}
            teamAbbrev={myTeam?.abbrev ?? null}
            rank={dashboard?.rank ?? null}
            standing={dashboard?.myStanding ?? null}
            urgentCount={urgentItems.length}
            primaryAction={primaryAction}
          />

          {urgentItems.length > 0 ? (
            <AttentionCard items={urgentItems} />
          ) : null}

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.75fr)]">
            <TeamSnapshotCard
              state={seasonState}
              teamId={myTeam?.id ?? null}
              rank={dashboard?.rank ?? null}
              standing={dashboard?.myStanding ?? null}
              nextGame={dashboard?.myNextGame ?? null}
              payroll={financials?.payroll ?? null}
              capSpace={financials?.capSpace ?? null}
              isOverTax={financials?.isOverTax ?? false}
            />
            <ScheduleSnapshotCard
              state={seasonState}
              todaysGames={dashboard?.todaysGames ?? []}
              nextGames={dashboard?.nextGames ?? []}
            />
          </div>

          <StandingsSnapshotCard
            state={seasonState}
            userTeamId={myTeam?.id ?? null}
            rows={dashboard?.standingsWindow ?? []}
          />

          {phase === "regular" || phase === "preseason" ? (
            <GameLog
              state={seasonState}
              getGameHref={(gameId) => `/league/games/${gameId}`}
            />
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:overflow-y-auto xl:p-px">
          <SeasonPhaseCard
            state={seasonState}
            championTeamId={championTeamId}
            canBeginRegularSeason={canBeginRegularSeason}
            canBeginPlayoffs={canBeginPlayoffs}
            canBeginOffseason={canBeginOffseason}
            canSimAiReSignings={canSimAiReSignings}
            canProceedToDraft={canProceedToDraft}
            canPrepareDraft={canPrepareDraft}
            canProceedToFreeAgency={canProceedToFreeAgency}
            canSimAiFreeAgency={canSimAiFreeAgency}
            canStartNextSeason={canStartNextSeason}
            rosterOverLimit={rosterOverLimit}
            cutsNeeded={cutsNeeded}
            error={error}
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

          <AdvanceControls
            state={seasonState}
            phase={phase}
            status={status}
            saveStatus={saveStatus}
            error={error}
            lastAdvanceResult={lastAdvanceResult}
            onAdvance={advance}
            onSimPlayoffs={simulatePlayoffs}
            title="Advance league"
            description={`Advance ${league?.name ?? "your league"} by day or run bulk simulation through your games.`}
          />

          {phase === "preseason" && league?.developmentReports?.length ? (
            <DevelopmentReportCard
              report={
                league.developmentReports[league.developmentReports.length - 1]!
              }
              seasonState={seasonState}
            />
          ) : null}

          <RecentResultsCard
            state={seasonState}
            recentGames={dashboard?.recentGames ?? []}
          />
        </div>
      </div>
    </div>
  )
}

function OperationsHeader({
  state,
  leagueName,
  teamName,
  teamAbbrev,
  rank,
  standing,
  urgentCount,
  primaryAction,
}: {
  state: SeasonState
  leagueName: string
  teamName: string | null
  teamAbbrev: string | null
  rank: number | null
  standing: Standing | null
  urgentCount: number
  primaryAction: string
}) {
  return (
    <section className="rounded-lg border bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-medium">{leagueName}</h1>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              Season {state.season}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {teamName
              ? `${teamName}${teamAbbrev ? ` · ${teamAbbrev}` : ""}`
              : "Pick a team to start operating the league office."}
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-4 lg:min-w-[520px]">
          <HeaderStat
            label="Record"
            value={standing ? `${standing.wins}-${standing.losses}` : "-"}
          />
          <HeaderStat label="Rank" value={rank ? `#${rank}` : "-"} />
          <HeaderStat
            label="Open items"
            value={urgentCount === 0 ? "Clear" : String(urgentCount)}
            tone={urgentCount > 0 ? "urgent" : undefined}
          />
          <HeaderStat label="Next" value={primaryAction} />
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

function AttentionCard({ items }: { items: UrgentItem[] }) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Command center</CardTitle>
        <CardDescription>
          Resolve blockers before advancing the league.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-md border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {item.tone === "urgent" ? (
                  <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-destructive">
                    Action
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to="/league/team">Inspect team</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/standings">Full standings</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/calendar">Calendar</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/trades">Trades</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TeamSnapshotCard({
  state,
  teamId,
  rank,
  standing,
  nextGame,
  payroll,
  capSpace,
  isOverTax,
}: {
  state: SeasonState
  teamId: string | null
  rank: number | null
  standing: Standing | null
  nextGame: ScheduleGame | null
  payroll: number | null
  capSpace: number | null
  isOverTax: boolean
}) {
  const team = teamId ? state.teams.find((entry) => entry.id === teamId) : null
  const record = standing
    ? `${standing.wins}-${standing.losses} (${winPct(
        standing.wins,
        standing.losses
      )})`
    : "-"

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{team?.name ?? "My team"}</CardTitle>
        <CardDescription>
          {team
            ? `${team.abbrev} · ${team.overall} OVR · ${team.players.length} players`
            : "Pick a team to unlock the front-office view."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <CompactMetric label="Record" value={record} />
          <CompactMetric
            label="Rank"
            value={rank ? `#${rank}/${state.standings.length}` : "-"}
          />
          <CompactMetric
            label="Streak"
            value={standing ? formatStreak(standing.streak) : "-"}
          />
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Next game</p>
          <p className="mt-0.5 text-sm font-medium">
            {nextGame
              ? `Day ${nextGame.day}: ${formatScheduledLine(state, nextGame)}`
              : "Season complete"}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <DashboardMetric
            label="Payroll"
            value={payroll === null ? "-" : formatMoney(payroll)}
          />
          <DashboardMetric
            label="Cap space"
            value={capSpace === null ? "-" : formatMoney(capSpace)}
            valueClassName={
              capSpace !== null && capSpace < 0 ? "text-destructive" : ""
            }
          />
        </div>
        {isOverTax ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Projected over the luxury tax line.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ScheduleSnapshotCard({
  state,
  todaysGames,
  nextGames,
}: {
  state: SeasonState
  todaysGames: ScheduleGame[]
  nextGames: ScheduleGame[]
}) {
  const games = todaysGames.length > 0 ? todaysGames : nextGames

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          {todaysGames.length > 0
            ? `Today · Day ${state.currentDay}`
            : "Next up"}
        </CardTitle>
        <CardDescription>
          {todaysGames.length > 0
            ? "Scheduled games at the current day pointer."
            : "Next scheduled league games."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {games.length > 0 ? (
          games.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2"
            >
              <span className="font-medium">
                {formatScheduledLine(state, game)}
              </span>
              <span className="text-xs text-muted-foreground">
                Day {game.day}
              </span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No scheduled games remain.</p>
        )}
        <Button variant="outline" size="sm" className="mt-1 w-fit" asChild>
          <Link to="/league/calendar">Open calendar</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function StandingsSnapshotCard({
  state,
  userTeamId,
  rows,
}: {
  state: SeasonState
  userTeamId: string | null
  rows: Standing[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Standings neighborhood</CardTitle>
        <CardDescription>
          The teams around your current league position.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>W</TableHead>
              <TableHead>L</TableHead>
              <TableHead>PCT</TableHead>
              <TableHead>PF</TableHead>
              <TableHead>PA</TableHead>
              <TableHead>STRK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rank =
                state.standings.findIndex(
                  (entry) => entry.teamId === row.teamId
                ) + 1
              const isUserTeam = row.teamId === userTeamId

              return (
                <TableRow
                  key={row.teamId}
                  className={isUserTeam ? "bg-muted/60 hover:bg-muted/70" : ""}
                >
                  <TableCell>{rank}</TableCell>
                  <TableCell className="font-medium">
                    {teamName(state, row.teamId)}
                  </TableCell>
                  <TableCell>{row.wins}</TableCell>
                  <TableCell>{row.losses}</TableCell>
                  <TableCell>{winPct(row.wins, row.losses)}</TableCell>
                  <TableCell>{row.pointsFor}</TableCell>
                  <TableCell>{row.pointsAgainst}</TableCell>
                  <TableCell>{formatStreak(row.streak)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/league/standings">View full table</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentResultsCard({
  state,
  recentGames,
}: {
  state: SeasonState
  recentGames: SeasonState["games"]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Recent results</CardTitle>
        <CardDescription>
          Latest completed games around the league.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {recentGames.length > 0 ? (
          recentGames.map((game) => (
            <Button
              key={game.id}
              variant="ghost"
              className="h-auto justify-start px-2 py-1.5 text-left font-normal"
              asChild
            >
              <Link to="/league/games/$gameId" params={{ gameId: game.id }}>
                {formatGameLine(state, game)}
              </Link>
            </Button>
          ))
        ) : (
          <p className="text-muted-foreground">No games played yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  )
}

function DashboardMetric({
  label,
  value,
  valueClassName = "",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  )
}

function getPrimaryAction(items: UrgentItem[], phase: SeasonPhase): string {
  if (items.length > 0) {
    return items[0]?.label ?? "Review"
  }
  if (phase === "preseason") {
    return "Preseason"
  }
  if (phase === "playoffs") {
    return "Sim playoffs"
  }
  if (phase === "offseason") {
    return "Offseason"
  }
  if (phase === "complete") {
    return "Review history"
  }
  return "Advance"
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

function getStandingsWindow(
  state: SeasonState,
  myStanding: Standing | null
): Standing[] {
  if (!myStanding) {
    return state.standings.slice(0, 6)
  }

  const index = state.standings.findIndex(
    (row) => row.teamId === myStanding.teamId
  )
  const start = Math.max(0, index - 2)
  const end = Math.min(state.standings.length, start + 5)
  const adjustedStart = Math.max(0, end - 5)

  return state.standings.slice(adjustedStart, end)
}

function DevelopmentReportCard({
  report,
  seasonState,
}: {
  report: PreseasonDevelopmentReport
  seasonState: SeasonState
}) {
  const allPlayers = seasonState.teams.flatMap((team) => team.players)

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Development report</CardTitle>
        <CardDescription>
          Season {report.season} preseason — biggest risers and fallers league-wide.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 text-sm">
        <div>
          <p className="font-medium">Top risers</p>
          {report.topRisers.length === 0 ? (
            <p className="text-muted-foreground">No major risers this year.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {report.topRisers.slice(0, 5).map((entry) => (
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
          <p className="font-medium">Top fallers</p>
          {report.topFallers.length === 0 ? (
            <p className="text-muted-foreground">No major fallers this year.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {report.topFallers.slice(0, 5).map((entry) => (
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
      </CardContent>
    </Card>
  )
}
