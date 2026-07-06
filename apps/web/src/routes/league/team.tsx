import { createFileRoute } from "@tanstack/react-router"
import { getExternalFreeAgents, getTeamExpiredFreeAgents } from "@workspace/sim"
import type {
  ScheduleGame,
  SeasonState,
  Standing,
  TeamWithRoster,
} from "@workspace/shared/types"

import { CapSheetCard } from "@/components/league/CapSheetCard"
import { FreeAgencyPanel } from "@/components/league/FreeAgencyPanel"
import { RosterCard } from "@/components/league/RosterCard"
import { formatScheduledLine, winPct } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/team")({
  component: LeagueTeamPage,
})

function LeagueTeamPage() {
  const {
    league,
    myTeam,
    userTeamId,
    seasonState,
    phase,
    isOffseason,
    offseasonPhase,
    rosterOverLimit,
    cutsNeeded,
    releasePlayer,
    signFreeAgent,
  } = useLeagueContext()
  const financials = useTeamFinancials(league, userTeamId)

  if (!myTeam || !league || !userTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No team selected. Pick a team to continue.
          </p>
        </CardContent>
      </Card>
    )
  }

  const reSignFreeAgents = getTeamExpiredFreeAgents(league, userTeamId)
  const externalFreeAgents = getExternalFreeAgents(league, userTeamId)
  const summary = buildTeamSummary({
    seasonState,
    team: myTeam,
    teamId: userTeamId,
    payroll: financials?.payroll ?? null,
    capSpace: financials?.capSpace ?? null,
  })

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <TeamOperationsSummary
        summary={summary}
        phase={phase}
        rosterOverLimit={rosterOverLimit}
        cutsNeeded={cutsNeeded}
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="min-h-0 min-w-0">
          <RosterCard
            roster={myTeam}
            contracts={league.contracts}
            showRelease={isOffseason}
            onReleasePlayer={releasePlayer}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-px">
          <CapSheetCard league={league} teamId={userTeamId} />

          {isOffseason ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Offseason roster moves</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Release players, re-sign your own free agents, and fill out a
                12-man roster before the next season.
              </CardContent>
            </Card>
          ) : null}

          {isOffseason && offseasonPhase === "re_signing" ? (
            <FreeAgencyPanel
              league={league}
              teamId={userTeamId}
              freeAgents={reSignFreeAgents}
              title="Re-signing"
              description="Negotiate with your own expiring players before the draft opens."
              emptyMessage="You do not have any expiring players to re-sign."
              mode="re_sign"
              onSign={signFreeAgent}
            />
          ) : null}

          {isOffseason && offseasonPhase === "free_agency" ? (
            <FreeAgencyPanel
              league={league}
              teamId={userTeamId}
              freeAgents={externalFreeAgents}
              title="Free agency"
              description="Sign external free agents after the draft."
              emptyMessage="No external free agents are currently available."
              mode="external"
              onSign={signFreeAgent}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

type TeamSummary = {
  name: string
  abbrev: string
  overall: number
  record: string
  rank: string
  nextGame: string
  rosterCount: number
  payroll: string
  capSpace: string
  capSpaceTone: "default" | "destructive"
}

function TeamOperationsSummary({
  summary,
  phase,
  rosterOverLimit,
  cutsNeeded,
}: {
  summary: TeamSummary
  phase: SeasonState["phase"]
  rosterOverLimit: boolean
  cutsNeeded: number
}) {
  return (
    <section className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-medium">{summary.name}</h1>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {summary.abbrev}
            </span>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {phaseLabel(phase)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Roster decisions, cap position, and next game context.
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[680px]">
          <SummaryMetric label="Record" value={summary.record} />
          <SummaryMetric label="Rank" value={summary.rank} />
          <SummaryMetric label="Next" value={summary.nextGame} />
          <SummaryMetric
            label="Roster"
            value={
              rosterOverLimit
                ? `${summary.rosterCount} · cut ${cutsNeeded}`
                : `${summary.rosterCount} players`
            }
            tone={rosterOverLimit ? "destructive" : undefined}
          />
          <SummaryMetric label="Overall" value={String(summary.overall)} />
          <SummaryMetric label="Payroll" value={summary.payroll} />
          <SummaryMetric
            label="Cap space"
            value={summary.capSpace}
            tone={
              summary.capSpaceTone === "destructive" ? "destructive" : undefined
            }
          />
        </div>
      </div>
    </section>
  )
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "destructive"
}) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p
        className={
          tone === "destructive"
            ? "mt-0.5 truncate font-medium text-destructive"
            : "mt-0.5 truncate font-medium"
        }
      >
        {value}
      </p>
    </div>
  )
}

function buildTeamSummary({
  seasonState,
  team,
  teamId,
  payroll,
  capSpace,
}: {
  seasonState: SeasonState | null
  team: TeamWithRoster
  teamId: string
  payroll: number | null
  capSpace: number | null
}): TeamSummary {
  const standing = seasonState?.standings.find((row) => row.teamId === teamId)
  const rank = getTeamRank(seasonState, standing)
  const nextGame = getNextTeamGame(seasonState, teamId)

  return {
    name: team.name,
    abbrev: team.abbrev,
    overall: team.overall,
    record: standing
      ? `${standing.wins}-${standing.losses} (${winPct(
          standing.wins,
          standing.losses
        )})`
      : "-",
    rank: rank ? `#${rank}` : "-",
    nextGame:
      seasonState && nextGame
        ? `Day ${nextGame.day} · ${formatScheduledLine(seasonState, nextGame)}`
        : "Season complete",
    rosterCount: team.players.length,
    payroll: payroll === null ? "-" : formatMoney(payroll),
    capSpace: capSpace === null ? "-" : formatMoney(capSpace),
    capSpaceTone: capSpace !== null && capSpace < 0 ? "destructive" : "default",
  }
}

function getTeamRank(
  seasonState: SeasonState | null,
  standing: Standing | undefined
): number | null {
  if (!seasonState || !standing) {
    return null
  }

  const rank = seasonState.standings.findIndex(
    (row) => row.teamId === standing.teamId
  )
  return rank >= 0 ? rank + 1 : null
}

function getNextTeamGame(
  seasonState: SeasonState | null,
  teamId: string
): ScheduleGame | null {
  if (!seasonState) {
    return null
  }

  return (
    seasonState.schedule
      .filter(
        (game) =>
          game.status === "scheduled" &&
          (game.homeTeamId === teamId || game.awayTeamId === teamId)
      )
      .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
      .at(0) ?? null
  )
}

function phaseLabel(phase: SeasonState["phase"]): string {
  if (phase === "playoffs") return "Playoffs"
  if (phase === "complete") return "Season complete"
  if (phase === "offseason") return "Offseason"
  return "Regular season"
}
