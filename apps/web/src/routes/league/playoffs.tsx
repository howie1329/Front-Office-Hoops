import { createFileRoute } from "@tanstack/react-router"

import type {
  PlayoffRound,
  PlayoffSeries,
  SeasonState,
  Standing,
  TeamWithRoster,
} from "@workspace/shared/types"
import { getCurrentCalendar, sortStandings } from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
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
import { cn } from "@workspace/ui/lib/utils"

import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/playoffs")({
  component: LeaguePlayoffsPage,
})

const LEAGUE_TEAM_COUNT = 30
const PLAYOFF_TEAMS_PER_CONFERENCE = 8
const SIX_TEAM_PLAYOFF_TEAMS = 4

type FieldRow = {
  team: TeamWithRoster
  standing: Standing
  leagueRank: number
  conferenceRank: number | null
  seed: string | null
  status: "in" | "cutoff" | "first-out" | "out"
}

function LeaguePlayoffsPage() {
  const {
    seasonState,
    userTeamId,
    status,
    saveStatus,
    error,
    phase,
    championTeamId,
    canBeginPlayoffs,
    canBeginOffseason,
    beginPlayoffs,
    beginOffseason,
    simulateCurrentPlayoffRound,
    simulatePlayoffs,
    simDay,
  } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  const fieldRows = buildFieldRows(seasonState)
  const userRow = fieldRows.find((row) => row.team.id === userTeamId) ?? null
  const bracket = seasonState.playoffBracket
  const series = bracket?.series ?? []
  const activeRound = getActiveRound(series)
  const activeSeries = activeRound
    ? series.filter((entry) => entry.round === activeRound && !entry.winnerId)
    : []
  const completedSeries = series.filter((entry) => entry.winnerId).length
  const scheduledPlayoffGames = seasonState.schedule.filter(
    (game) => game.seriesId && game.status === "scheduled"
  )
  const nextPlayoffDay = scheduledPlayoffGames
    .map((game) => game.day)
    .sort((a, b) => a - b)[0]
  const championName = championTeamId
    ? teamName(seasonState, championTeamId)
    : null
  const calendar = getCurrentCalendar(seasonState)
  const canSimPlayoffs =
    phase === "playoffs" && scheduledPlayoffGames.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-px">
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-h-0 flex-col gap-4 overflow-hidden p-px">
          <Card className="shrink-0">
            <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0">
                <CardTitle className="text-base">Playoff workspace</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {workspaceSubtitle(
                    seasonState,
                    activeRound,
                    championName,
                    userRow
                  )}
                </p>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                <StatusMetric
                  label="Phase"
                  value={phaseLabel(seasonState.phase)}
                />
                <StatusMetric
                  label="Next"
                  value={
                    canBeginPlayoffs
                      ? "Begin"
                      : nextPlayoffDay
                        ? `Day ${nextPlayoffDay}`
                        : canBeginOffseason
                          ? "Offseason"
                          : "Review"
                  }
                />
                <StatusMetric
                  label="Date"
                  value={`${calendar.date.label} · Day ${seasonState.currentDay}`}
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {canBeginPlayoffs ? (
                  <Button onClick={beginPlayoffs}>Begin playoffs</Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={simDay}
                  disabled={!canSimPlayoffs}
                >
                  Sim playoff day
                </Button>
                <Button
                  variant="secondary"
                  onClick={simulateCurrentPlayoffRound}
                  disabled={!canSimPlayoffs}
                >
                  Sim current round
                </Button>
                <Button
                  variant="secondary"
                  onClick={simulatePlayoffs}
                  disabled={!canSimPlayoffs}
                >
                  Sim all playoffs
                </Button>
                {canBeginOffseason ? (
                  <Button onClick={beginOffseason}>Begin offseason</Button>
                ) : null}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Status: {status}</span>
                <span>Save: {saveStatus}</span>
                <span>
                  Series: {completedSeries}/{series.length || "-"} complete
                </span>
              </div>
              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <BracketWorkspace state={seasonState} userTeamId={userTeamId} />
        </main>

        <aside className="min-h-0 overflow-auto p-px">
          <div className="flex min-h-full flex-col gap-4">
            <ContextPanel
              state={seasonState}
              fieldRows={fieldRows}
              userRow={userRow}
              activeRound={activeRound}
              activeSeriesCount={activeSeries.length}
            />
            <ProjectedFieldCard
              state={seasonState}
              rows={fieldRows}
              userTeamId={userTeamId}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function BracketWorkspace({
  state,
  userTeamId,
}: {
  state: SeasonState
  userTeamId: string | null
}) {
  const series = state.playoffBracket?.series ?? []

  if (series.length === 0) {
    return (
      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>Projected bracket</CardTitle>
          <p className="text-xs text-muted-foreground">
            The bracket will lock when playoffs begin. Use the field panel to
            review current seeds before starting the postseason.
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto">
          <PrePlayoffBracketPreview state={state} userTeamId={userTeamId} />
        </CardContent>
      </Card>
    )
  }

  const rounds = [1, 2, 3, 4]
    .map((round) => ({
      round: round as PlayoffRound,
      entries: series
        .filter((entry) => entry.round === round)
        .sort(
          (a, b) =>
            conferenceSort(a.conferenceId, b.conferenceId) ||
            a.higherSeed - b.higherSeed ||
            a.id.localeCompare(b.id)
        ),
    }))
    .filter((round) => round.entries.length > 0)

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="shrink-0">
        <CardTitle>Bracket</CardTitle>
        <p className="text-xs text-muted-foreground">
          Best-of-{state.teams.length === LEAGUE_TEAM_COUNT ? 7 : 3} series.
          Your team is highlighted.
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div className="-m-px h-full overflow-auto p-px">
          <div
            className="grid min-w-[920px] gap-3"
            style={{
              gridTemplateColumns: `repeat(${rounds.length}, minmax(220px, 1fr))`,
            }}
          >
            {rounds.map((round) => (
              <section
                key={round.round}
                className="flex min-w-0 flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/25 px-3 py-2">
                  <h3 className="text-xs font-medium">
                    {roundLabel(round.round, state.teams.length)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {round.entries.filter((entry) => entry.winnerId).length}/
                    {round.entries.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {round.entries.map((entry) => (
                    <SeriesTile
                      key={entry.id}
                      state={state}
                      series={entry}
                      userTeamId={userTeamId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SeriesTile({
  state,
  series,
  userTeamId,
}: {
  state: SeasonState
  series: PlayoffSeries
  userTeamId: string | null
}) {
  const involvesUser =
    userTeamId === series.higherSeedTeamId ||
    userTeamId === series.lowerSeedTeamId
  const neededWins = state.teams.length === LEAGUE_TEAM_COUNT ? 4 : 2
  const higherWon = series.winnerId === series.higherSeedTeamId
  const lowerWon = series.winnerId === series.lowerSeedTeamId

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3",
        involvesUser && "border-primary/50 bg-muted/40"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {series.conferenceId ? series.conferenceId.toUpperCase() : "League"}
        </span>
        <span className="text-xs text-muted-foreground">
          Best of {neededWins * 2 - 1}
        </span>
      </div>
      <TeamSeriesLine
        seed={series.higherSeed}
        name={teamName(state, series.higherSeedTeamId)}
        abbrev={teamAbbrev(state, series.higherSeedTeamId)}
        wins={series.winsHigher}
        winner={higherWon}
      />
      <TeamSeriesLine
        seed={series.lowerSeed}
        name={teamName(state, series.lowerSeedTeamId)}
        abbrev={teamAbbrev(state, series.lowerSeedTeamId)}
        wins={series.winsLower}
        winner={lowerWon}
      />
    </div>
  )
}

function TeamSeriesLine({
  seed,
  name,
  abbrev,
  wins,
  winner,
}: {
  seed: number
  name: string
  abbrev: string
  wins: number
  winner: boolean
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-2 border-t py-2 text-xs",
        winner && "font-medium"
      )}
    >
      <span className="text-muted-foreground">#{seed}</span>
      <span className="min-w-0 truncate">
        <span className="sm:hidden">{abbrev}</span>
        <span className="hidden sm:inline">{name}</span>
      </span>
      <span className="text-right tabular-nums">{wins}</span>
    </div>
  )
}

function PrePlayoffBracketPreview({
  state,
  userTeamId,
}: {
  state: SeasonState
  userTeamId: string | null
}) {
  const rows = buildFieldRows(state).filter(
    (row) => row.status === "in" || row.status === "cutoff"
  )
  const conferences =
    state.teams.length === LEAGUE_TEAM_COUNT ? ["east", "west"] : ["league"]

  return (
    <div className="grid min-w-[720px] gap-3 lg:grid-cols-2">
      {conferences.map((conference) => {
        const entries =
          conference === "league"
            ? rows
            : rows.filter((row) => row.team.conferenceId === conference)

        return (
          <div key={conference} className="rounded-md border">
            <div className="border-b px-3 py-2 text-xs font-medium capitalize">
              {conference === "league" ? "Playoff field" : conference}
            </div>
            <div className="divide-y">
              {entries.map((row) => (
                <SeedLine key={row.team.id} row={row} userTeamId={userTeamId} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ContextPanel({
  state,
  fieldRows,
  userRow,
  activeRound,
  activeSeriesCount,
}: {
  state: SeasonState
  fieldRows: FieldRow[]
  userRow: FieldRow | null
  activeRound: PlayoffRound | null
  activeSeriesCount: number
}) {
  const leader = fieldRows[0]
  const cutoff = fieldRows.find((row) => row.status === "cutoff")
  const firstOut = fieldRows.find((row) => row.status === "first-out")
  const championId = state.playoffBracket?.championTeamId

  return (
    <Card className="shrink-0">
      <CardHeader>
        <CardTitle>Postseason context</CardTitle>
        <p className="text-xs text-muted-foreground">
          Field status, user-team path, and active round.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ContextMetric
          label="My team"
          value={
            userRow
              ? `${userRow.seed ?? "Out"} · ${userRow.standing.wins}-${userRow.standing.losses}`
              : "-"
          }
        />
        <ContextMetric
          label={state.phase === "playoffs" ? "Active round" : "Projected cut"}
          value={
            state.phase === "playoffs"
              ? activeRound
                ? `${roundLabel(activeRound, state.teams.length)} · ${activeSeriesCount} live`
                : "Complete"
              : cutoff
                ? `${cutoff.team.name} · ${cutoff.standing.wins}-${cutoff.standing.losses}`
                : "-"
          }
        />
        <ContextMetric
          label="League leader"
          value={`${leader.team.name} · ${leader.standing.wins}-${leader.standing.losses}`}
        />
        <ContextMetric
          label={championId ? "Champion" : "First out"}
          value={
            championId
              ? teamName(state, championId)
              : firstOut
                ? `${firstOut.team.name} · ${firstOut.standing.wins}-${firstOut.standing.losses}`
                : "-"
          }
        />
      </CardContent>
    </Card>
  )
}

function ProjectedFieldCard({
  state,
  rows,
  userTeamId,
}: {
  state: SeasonState
  rows: FieldRow[]
  userTeamId: string | null
}) {
  return (
    <Card className="min-h-[320px] flex-1">
      <CardHeader className="shrink-0">
        <CardTitle>
          {state.phase === "regular" ? "Projected field" : "Playoff field"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Seeds, cut line, and first team out from current standings.
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div className="-m-px h-full overflow-auto p-px">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Seed</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">W-L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.team.id}
                  className={cn(
                    row.team.id === userTeamId && "bg-muted/45",
                    row.status === "first-out" && "text-muted-foreground"
                  )}
                >
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex min-w-10 items-center justify-center rounded-md border px-2 py-1 text-xs",
                        row.status === "cutoff" && "border-primary/40",
                        row.status === "out" && "text-muted-foreground"
                      )}
                    >
                      {row.seed ??
                        (row.status === "first-out" ? "1st out" : "Out")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.team.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.team.abbrev}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.standing.wins}-{row.standing.losses}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function SeedLine({
  row,
  userTeamId,
}: {
  row: FieldRow
  userTeamId: string | null
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[54px_minmax(0,1fr)_64px] items-center gap-2 px-3 py-2 text-xs",
        row.team.id === userTeamId && "bg-muted/45"
      )}
    >
      <span className="font-medium">{row.seed}</span>
      <span className="min-w-0 truncate">{row.team.name}</span>
      <span className="text-right tabular-nums">
        {row.standing.wins}-{row.standing.losses}
      </span>
    </div>
  )
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  )
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  )
}

function buildFieldRows(state: SeasonState): FieldRow[] {
  const sorted = sortStandings(state.standings)
  const teamById = new Map(state.teams.map((team) => [team.id, team]))
  const conferenceRanks = new Map<string, number>()

  if (state.teams.length === LEAGUE_TEAM_COUNT) {
    for (const conferenceId of ["east", "west"]) {
      sorted
        .filter(
          (standing) =>
            teamById.get(standing.teamId)?.conferenceId === conferenceId
        )
        .forEach((standing, index) => {
          conferenceRanks.set(standing.teamId, index + 1)
        })
    }
  }

  return sorted
    .map((standing, index) => {
      const team = teamById.get(standing.teamId)
      if (!team) return null

      const leagueRank = index + 1
      const conferenceRank = conferenceRanks.get(standing.teamId) ?? null
      const status = getPlayoffStatus(
        state.teams.length,
        conferenceRank,
        leagueRank
      )
      const seed = getPlayoffSeed(
        team.conferenceId ?? null,
        conferenceRank,
        leagueRank,
        status
      )

      return {
        team,
        standing,
        leagueRank,
        conferenceRank,
        seed,
        status,
      }
    })
    .filter((row): row is FieldRow => row !== null)
}

function getPlayoffStatus(
  teamCount: number,
  conferenceRank: number | null,
  leagueRank: number
): FieldRow["status"] {
  if (teamCount === LEAGUE_TEAM_COUNT) {
    if (!conferenceRank) return "out"
    if (conferenceRank < PLAYOFF_TEAMS_PER_CONFERENCE) return "in"
    if (conferenceRank === PLAYOFF_TEAMS_PER_CONFERENCE) return "cutoff"
    if (conferenceRank === PLAYOFF_TEAMS_PER_CONFERENCE + 1) return "first-out"
    return "out"
  }

  if (leagueRank < SIX_TEAM_PLAYOFF_TEAMS) return "in"
  if (leagueRank === SIX_TEAM_PLAYOFF_TEAMS) return "cutoff"
  if (leagueRank === SIX_TEAM_PLAYOFF_TEAMS + 1) return "first-out"
  return "out"
}

function getPlayoffSeed(
  conferenceId: string | null,
  conferenceRank: number | null,
  leagueRank: number,
  status: FieldRow["status"]
): string | null {
  if (status === "out" || status === "first-out") {
    return null
  }

  if (!conferenceRank) {
    return `#${leagueRank}`
  }
  if (conferenceId === "east") {
    return `E${conferenceRank}`
  }
  if (conferenceId === "west") {
    return `W${conferenceRank}`
  }
  return `#${conferenceRank}`
}

function getActiveRound(series: PlayoffSeries[]): PlayoffRound | null {
  const activeRounds = series
    .filter((entry) => !entry.winnerId)
    .map((entry) => entry.round)

  return activeRounds.length === 0
    ? null
    : (Math.min(...activeRounds) as PlayoffRound)
}

function workspaceSubtitle(
  state: SeasonState,
  activeRound: PlayoffRound | null,
  championName: string | null,
  userRow: FieldRow | null
): string {
  if (championName) {
    return `${championName} won the championship. Review the completed bracket or begin the offseason.`
  }
  if (state.phase === "playoffs" && activeRound) {
    return `${roundLabel(activeRound, state.teams.length)} is active. Simulate one day, this round, or the full postseason.`
  }
  if (state.phase === "regular") {
    return userRow?.seed
      ? `Projected ${userRow.seed} seed for your team. Review the field before beginning playoffs.`
      : "Review the projected field and cut line before beginning playoffs."
  }
  return "Review postseason results and next phase actions."
}

function phaseLabel(phase: SeasonState["phase"]): string {
  if (phase === "playoffs") return "Playoffs"
  if (phase === "complete") return "Complete"
  if (phase === "offseason") return "Offseason"
  return "Regular"
}

function roundLabel(round: PlayoffRound, teamCount: number): string {
  if (teamCount === 6) {
    return round === 1 ? "Semifinals" : "Finals"
  }

  switch (round) {
    case 1:
      return "First round"
    case 2:
      return "Conf semis"
    case 3:
      return "Conf finals"
    case 4:
      return "Finals"
  }
}

function teamName(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.name ?? teamId
}

function teamAbbrev(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.abbrev ?? teamId
}

function conferenceSort(
  a: PlayoffSeries["conferenceId"],
  b: PlayoffSeries["conferenceId"]
): number {
  const order = new Map([
    ["east", 0],
    ["west", 1],
    [undefined, 2],
  ])

  return (order.get(a) ?? 3) - (order.get(b) ?? 3)
}
