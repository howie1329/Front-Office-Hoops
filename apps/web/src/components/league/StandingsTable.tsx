import { useMemo, useState } from "react"

import {
  LEAGUE_TEAM_COUNT,
  PLAYOFF_TEAMS_PER_CONFERENCE,
  SIX_TEAM_PLAYOFF_TEAMS,
} from "@workspace/shared/constants"
import type { SeasonState, Standing } from "@workspace/shared/types"
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
import { cn } from "@workspace/ui/lib/utils"

import { formatStreak, teamName, winPct } from "./lib/teamFormat"

type StandingsTableProps = {
  state: SeasonState
  userTeamId?: string | null
}

type SortKey =
  | "rank"
  | "team"
  | "wins"
  | "losses"
  | "pct"
  | "diff"
  | "pointsFor"
  | "pointsAgainst"
  | "streak"

type SortDirection = "asc" | "desc"
type FilterKey = "all" | "playoffs" | "neighborhood" | "east" | "west"

type StandingRow = {
  standing: Standing
  teamName: string
  abbrev: string
  conferenceId: string | null
  rank: number
  conferenceRank: number | null
  playoffSeed: string | null
  playoffStatus: "in" | "cutoff" | "first-out" | "out"
  wins: number
  losses: number
  pct: number
  diff: number
  pointsFor: number
  pointsAgainst: number
  streak: number
}

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "playoffs", label: "Playoff field" },
  { key: "neighborhood", label: "My neighborhood" },
  { key: "east", label: "East" },
  { key: "west", label: "West" },
]

export function StandingsTable({
  state,
  userTeamId = null,
}: StandingsTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "rank",
    direction: "asc",
  })

  const rows = useMemo(() => buildStandingRows(state), [state])
  const userRow = userTeamId
    ? (rows.find((row) => row.standing.teamId === userTeamId) ?? null)
    : null
  const summary = useMemo(
    () => buildSummary(rows, userRow, state.teams.length),
    [rows, state.teams.length, userRow]
  )
  const visibleRows = useMemo(
    () => sortRows(filterRows(rows, filter, userRow), sort),
    [filter, rows, sort, userRow]
  )

  function updateSort(key: SortKey) {
    setSort((current) => {
      if (current.key !== key) {
        return { key, direction: defaultSortDirection(key) }
      }

      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      }
    })
  }

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <StandingsSummary
        state={state}
        userRow={userRow}
        summary={summary}
        playoffSlots={getPlayoffSlots(state.teams.length)}
      />

      <Card className="min-h-0 flex-1">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>League standings</CardTitle>
              <CardDescription>
                Sort the board, isolate the playoff field, or focus on teams
                around your current rank.
              </CardDescription>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {visibleRows.length} of {rows.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex shrink-0 flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={filter === option.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <SortableHead
                    label="Rank"
                    sortKey="rank"
                    sort={sort}
                    onSort={updateSort}
                  />
                  <SortableHead
                    label="Team"
                    sortKey="team"
                    sort={sort}
                    onSort={updateSort}
                  />
                  <TableHead>Seed</TableHead>
                  <SortableHead
                    label="W"
                    sortKey="wins"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="L"
                    sortKey="losses"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="PCT"
                    sortKey="pct"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="+/-"
                    sortKey="diff"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="PF"
                    sortKey="pointsFor"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="PA"
                    sortKey="pointsAgainst"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                  <SortableHead
                    label="STRK"
                    sortKey="streak"
                    sort={sort}
                    onSort={updateSort}
                    align="right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow
                    key={row.standing.teamId}
                    className={cn(
                      row.standing.teamId === userTeamId
                        ? "bg-muted/70 hover:bg-muted/80"
                        : "",
                      row.playoffStatus === "first-out"
                        ? "border-t-2 border-t-foreground/20"
                        : ""
                    )}
                  >
                    <TableCell className="font-medium tabular-nums">
                      {row.rank}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-48 flex-col">
                        <span className="font-medium">{row.teamName}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.abbrev}
                          {row.standing.teamId === userTeamId
                            ? " · My team"
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlayoffBadge row={row} />
                    </TableCell>
                    <NumberCell value={row.wins} />
                    <NumberCell value={row.losses} />
                    <NumberCell value={winPct(row.wins, row.losses)} />
                    <NumberCell value={formatDiff(row.diff)} />
                    <NumberCell value={row.pointsFor} />
                    <NumberCell value={row.pointsAgainst} />
                    <NumberCell value={formatStreak(row.streak)} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StandingsSummary({
  state,
  userRow,
  summary,
  playoffSlots,
}: {
  state: SeasonState
  userRow: StandingRow | null
  summary: ReturnType<typeof buildSummary>
  playoffSlots: number
}) {
  return (
    <section className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-medium">Standings</h1>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              Season {state.season}
            </span>
            <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
              {playoffSlots} playoff spots
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            League table, playoff position, and current form.
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5 xl:min-w-[680px]">
          <SummaryMetric
            label="My team"
            value={
              userRow
                ? `#${userRow.rank} · ${userRow.wins}-${userRow.losses}`
                : "-"
            }
          />
          <SummaryMetric
            label="Playoff status"
            value={userRow ? playoffSummaryLabel(userRow, summary.cutoff) : "-"}
            tone={
              userRow && userRow.playoffStatus === "out" ? "muted" : undefined
            }
          />
          <SummaryMetric
            label="League leader"
            value={`${summary.leader.teamName} · ${summary.leader.wins}-${summary.leader.losses}`}
          />
          <SummaryMetric
            label="Hottest"
            value={`${summary.hottest.teamName} · ${formatStreak(
              summary.hottest.streak
            )}`}
          />
          <SummaryMetric
            label="Cut line"
            value={summary.cutoff ? cutoffLabel(summary.cutoff) : "-"}
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
  tone?: "muted"
}) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-medium",
          tone === "muted" ? "text-muted-foreground" : ""
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sort.key === sortKey

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
          align === "right" ? "justify-end" : ""
        )}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="w-2 text-[0.625rem] text-muted-foreground">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </TableHead>
  )
}

function PlayoffBadge({ row }: { row: StandingRow }) {
  if (!row.playoffSeed) {
    return (
      <span className="text-xs text-muted-foreground">
        {row.playoffStatus === "first-out" ? "First out" : "Out"}
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-sm border bg-muted/30 px-1.5 py-0.5 text-xs font-medium">
      {row.playoffSeed}
      {row.playoffStatus === "cutoff" ? " · Cut line" : ""}
    </span>
  )
}

function NumberCell({ value }: { value: string | number }) {
  return <TableCell className="text-right tabular-nums">{value}</TableCell>
}

function buildStandingRows(state: SeasonState): StandingRow[] {
  const leagueRows = state.standings.map((standing, index) =>
    buildStandingRow(state, standing, index + 1)
  )
  const conferenceRanks = new Map<string, number>()

  for (const conferenceId of ["east", "west"]) {
    state.standings
      .filter(
        (standing) =>
          state.teams.find((team) => team.id === standing.teamId)
            ?.conferenceId === conferenceId
      )
      .forEach((standing, index) => {
        conferenceRanks.set(standing.teamId, index + 1)
      })
  }

  return leagueRows.map((row) => {
    const conferenceRank = conferenceRanks.get(row.standing.teamId) ?? null
    const playoffStatus = getPlayoffStatus(
      state.teams.length,
      conferenceRank,
      row.rank
    )
    const playoffSeed = getPlayoffSeed(
      row.conferenceId,
      conferenceRank,
      row.rank,
      playoffStatus
    )

    return {
      ...row,
      conferenceRank,
      playoffStatus,
      playoffSeed,
    }
  })
}

function buildStandingRow(
  state: SeasonState,
  standing: Standing,
  rank: number
): StandingRow {
  const team = state.teams.find((entry) => entry.id === standing.teamId)

  return {
    standing,
    teamName: teamName(state, standing.teamId),
    abbrev: team?.abbrev ?? standing.teamId,
    conferenceId: team?.conferenceId ?? null,
    rank,
    conferenceRank: null,
    playoffSeed: null,
    playoffStatus: "out",
    wins: standing.wins,
    losses: standing.losses,
    pct:
      standing.wins + standing.losses === 0
        ? 0
        : standing.wins / (standing.wins + standing.losses),
    diff: standing.pointsFor - standing.pointsAgainst,
    pointsFor: standing.pointsFor,
    pointsAgainst: standing.pointsAgainst,
    streak: standing.streak,
  }
}

function buildSummary(
  rows: StandingRow[],
  userRow: StandingRow | null,
  teamCount: number
) {
  const leader = rows[0] ?? emptySummaryRow
  const hottest =
    [...rows].sort((a, b) => b.streak - a.streak || a.rank - b.rank)[0] ??
    leader
  const cutoff = findCutoffRow(rows, userRow, teamCount)

  return { leader, hottest, cutoff }
}

function filterRows(
  rows: StandingRow[],
  filter: FilterKey,
  userRow: StandingRow | null
): StandingRow[] {
  if (filter === "playoffs") {
    return rows.filter(
      (row) => row.playoffStatus === "in" || row.playoffStatus === "cutoff"
    )
  }

  if (filter === "neighborhood") {
    if (!userRow) {
      return rows.slice(0, 10)
    }
    return rows.filter((row) => Math.abs(row.rank - userRow.rank) <= 4)
  }

  if (filter === "east" || filter === "west") {
    return rows.filter((row) => row.conferenceId === filter)
  }

  return rows
}

function sortRows(
  rows: StandingRow[],
  sort: { key: SortKey; direction: SortDirection }
): StandingRow[] {
  return [...rows].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1

    if (sort.key === "team") {
      return a.teamName.localeCompare(b.teamName) * direction
    }

    const aValue = valueForSort(a, sort.key)
    const bValue = valueForSort(b, sort.key)

    if (aValue === bValue) {
      return a.rank - b.rank
    }

    return (aValue > bValue ? 1 : -1) * direction
  })
}

function valueForSort(row: StandingRow, sortKey: SortKey): number {
  if (sortKey === "rank") return row.rank
  if (sortKey === "wins") return row.wins
  if (sortKey === "losses") return row.losses
  if (sortKey === "pct") return row.pct
  if (sortKey === "diff") return row.diff
  if (sortKey === "pointsFor") return row.pointsFor
  if (sortKey === "pointsAgainst") return row.pointsAgainst
  return row.streak
}

function defaultSortDirection(sortKey: SortKey): SortDirection {
  return sortKey === "rank" ||
    sortKey === "losses" ||
    sortKey === "pointsAgainst"
    ? "asc"
    : "desc"
}

function getPlayoffSlots(teamCount: number): number {
  if (teamCount === LEAGUE_TEAM_COUNT) {
    return PLAYOFF_TEAMS_PER_CONFERENCE * 2
  }
  return SIX_TEAM_PLAYOFF_TEAMS
}

function getPlayoffStatus(
  teamCount: number,
  conferenceRank: number | null,
  leagueRank: number
): StandingRow["playoffStatus"] {
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
  playoffStatus: StandingRow["playoffStatus"]
): string | null {
  if (playoffStatus === "out" || playoffStatus === "first-out") {
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

function findCutoffRow(
  rows: StandingRow[],
  userRow: StandingRow | null,
  teamCount: number
): StandingRow | null {
  if (teamCount !== LEAGUE_TEAM_COUNT || !userRow?.conferenceId) {
    const cutoff = rows.find((row) => row.playoffStatus === "cutoff")
    if (cutoff) {
      return cutoff
    }

    return rows[getPlayoffSlots(teamCount) - 1] ?? null
  }

  return (
    rows.find(
      (row) =>
        row.conferenceId === userRow.conferenceId &&
        row.playoffStatus === "cutoff"
    ) ?? null
  )
}

function playoffSummaryLabel(
  userRow: StandingRow,
  cutoff: StandingRow | null
): string {
  if (userRow.playoffSeed) {
    return `${userRow.playoffSeed} seed`
  }

  if (!cutoff) {
    return "Outside field"
  }

  const gamesBack =
    (cutoff.wins - userRow.wins + (userRow.losses - cutoff.losses)) / 2
  const label = Math.max(0, gamesBack).toFixed(1).replace(/\.0$/, "")
  return `${label} GB`
}

function cutoffLabel(row: StandingRow): string {
  return `${row.teamName} · ${row.wins}-${row.losses}`
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`
  }
  return String(diff)
}

const emptySummaryRow: StandingRow = {
  standing: {
    teamId: "-",
    season: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    streak: 0,
  },
  teamName: "-",
  abbrev: "-",
  conferenceId: null,
  rank: 0,
  conferenceRank: null,
  playoffSeed: null,
  playoffStatus: "out",
  wins: 0,
  losses: 0,
  pct: 0,
  diff: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  streak: 0,
}
