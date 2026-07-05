import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"

import { GameLog } from "@/components/league/GameLog"
import { SeasonPhaseCard } from "@/components/league/SeasonPhaseCard"
import { SimControls } from "@/components/league/SimControls"
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
    beginPlayoffs,
    beginOffseason,
    completeReSignings,
    advanceToDraft,
    prepareDraft,
    advanceToFreeAgency,
    completeFreeAgency,
    simulatePlayoffs,
    startNextSeason,
    simDay,
    simWeek,
    simSeason,
  } = useLeagueContext()

  const financials = useTeamFinancials(league, myTeam?.id ?? null)

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
    canBeginPlayoffs,
    canBeginOffseason,
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
  })

  return (
    <div className="flex flex-col gap-4">
      {isMiniLeague ? (
        <Card>
          <CardHeader>
            <CardTitle>6-team save detected</CardTitle>
            <CardDescription>
              This save uses the mini league format. Create a new 30-team league
              from the home page for the full product experience.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <AttentionCard items={urgentItems} phase={phase} />

          <div className="grid gap-4 lg:grid-cols-2">
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

          {phase === "regular" ? (
            <GameLog
              state={seasonState}
              getGameHref={(gameId) => `/league/games/${gameId}`}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SeasonPhaseCard
            state={seasonState}
            championTeamId={championTeamId}
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
            onBeginPlayoffs={beginPlayoffs}
            onBeginOffseason={beginOffseason}
            onCompleteReSignings={completeReSignings}
            onAdvanceToDraft={advanceToDraft}
            onPrepareDraft={prepareDraft}
            onAdvanceToFreeAgency={advanceToFreeAgency}
            onCompleteFreeAgency={completeFreeAgency}
            onStartNextSeason={() => void startNextSeason()}
          />

          <SimControls
            state={seasonState}
            phase={phase}
            status={status}
            saveStatus={saveStatus}
            error={error}
            seed={league?.name ?? ""}
            onSeedChange={() => {}}
            onSimDay={simDay}
            onSimWeek={simWeek}
            onSimSeason={simSeason}
            onSimPlayoffDay={simDay}
            onSimPlayoffs={simulatePlayoffs}
            title="Advance league"
            description={`Advance ${league?.name ?? "your league"} by day, week, or full season.`}
          />

          <RecentResultsCard
            state={seasonState}
            recentGames={dashboard?.recentGames ?? []}
          />
        </div>
      </div>
    </div>
  )
}

function AttentionCard({
  items,
  phase,
}: {
  items: UrgentItem[]
  phase: SeasonPhase
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Command center</CardTitle>
        <CardDescription>
          Urgent front-office work, league gates, and the next useful page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length > 0 ? (
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
        ) : (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            No blockers. Review today, then advance the{" "}
            {phase === "playoffs" ? "postseason" : "league"} when ready.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to="/league/team">Inspect team</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/standings">Full standings</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/schedule">Schedule</Link>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{team?.name ?? "My team"}</CardTitle>
        <CardDescription>
          {team
            ? `${team.abbrev} · ${team.overall} OVR · ${team.players.length} players`
            : "Pick a team to unlock the front-office view."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <DashboardMetric
          label="Record"
          value={
            standing
              ? `${standing.wins}-${standing.losses} (${winPct(
                  standing.wins,
                  standing.losses
                )})`
              : "-"
          }
        />
        <DashboardMetric
          label="League rank"
          value={rank ? `#${rank} of ${state.standings.length}` : "-"}
        />
        <DashboardMetric
          label="Streak"
          value={standing ? formatStreak(standing.streak) : "-"}
        />
        <DashboardMetric
          label="Next game"
          value={
            nextGame
              ? `Day ${nextGame.day}: ${formatScheduledLine(state, nextGame)}`
              : "Season complete"
          }
        />
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
      <CardHeader>
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
            <div key={game.id} className="flex justify-between gap-4">
              <span>{formatScheduledLine(state, game)}</span>
              <span className="text-muted-foreground">Day {game.day}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No scheduled games remain.</p>
        )}
        <Button variant="outline" size="sm" className="mt-1 w-fit" asChild>
          <Link to="/league/schedule">Open schedule</Link>
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
      <CardHeader>
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
      <CardHeader>
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
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
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
  if (rosterOverLimit) {
    items.push({
      label: "Roster over limit",
      description: `Release ${cutsNeeded} player${cutsNeeded === 1 ? "" : "s"} before starting the next season.`,
      tone: "urgent",
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
