import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
  GamePlayerBoxScore,
  LeagueDocument,
  LeagueGameRecord,
  LeagueScheduleEntry,
} from "@workspace/domain-v2"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLeagueShell } from "@/components/league-shell"

export const Route = createFileRoute("/league/")({
  component: DashboardPage,
})

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`))
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

function getNextGames(
  league: LeagueDocument,
  teamId: string,
  limit = 5
): Array<LeagueScheduleEntry> {
  return league.state.calendar.schedule
    .filter(
      (game) =>
        game.status === "scheduled" &&
        game.date >= league.state.calendar.currentDate &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId)
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, limit)
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

type LeaderCategoryId =
  | "points"
  | "assists"
  | "rebounds"
  | "steals"
  | "blocks"
  | "field-goal-percentage"

type LeagueLeaderRow = {
  categoryId: LeaderCategoryId
  playerId: string
  playerName: string
  teamName: string
  value: number
  displayValue: string
}

type PlayerStatLine = {
  player: GamePlayerBoxScore
  games: number
  points: number
  assists: number
  rebounds: number
  steals: number
  blocks: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
}

const LEADER_CATEGORIES: Array<{
  id: LeaderCategoryId
  label: string
  format: (stats: PlayerStatLine) => { value: number; displayValue: string }
}> = [
  {
    id: "points",
    label: "Points",
    format: (stats) => ({
      value: stats.points / stats.games,
      displayValue: (stats.points / stats.games).toFixed(1),
    }),
  },
  {
    id: "assists",
    label: "Assists",
    format: (stats) => ({
      value: stats.assists / stats.games,
      displayValue: (stats.assists / stats.games).toFixed(1),
    }),
  },
  {
    id: "rebounds",
    label: "Rebounds",
    format: (stats) => ({
      value: stats.rebounds / stats.games,
      displayValue: (stats.rebounds / stats.games).toFixed(1),
    }),
  },
  {
    id: "steals",
    label: "Steals",
    format: (stats) => ({
      value: stats.steals / stats.games,
      displayValue: (stats.steals / stats.games).toFixed(1),
    }),
  },
  {
    id: "blocks",
    label: "Blocks",
    format: (stats) => ({
      value: stats.blocks / stats.games,
      displayValue: (stats.blocks / stats.games).toFixed(1),
    }),
  },
  {
    id: "field-goal-percentage",
    label: "FG%",
    format: (stats) => ({
      value:
        stats.fieldGoalsAttempted > 0
          ? (stats.fieldGoalsMade / stats.fieldGoalsAttempted) * 100
          : 0,
      displayValue:
        stats.fieldGoalsAttempted > 0
          ? `${(
              (stats.fieldGoalsMade / stats.fieldGoalsAttempted) *
              100
            ).toFixed(1)}%`
          : "—",
    }),
  },
]

function playerName(league: LeagueDocument, playerId: string): string {
  const player = league.entities.players[playerId]
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
}

function getCompletedGames(league: LeagueDocument): Array<LeagueGameRecord> {
  return league.optionalData?.games ?? []
}

function getPlayerStatLines(league: LeagueDocument): Array<PlayerStatLine> {
  const statsByPlayer = new Map<string, PlayerStatLine>()

  for (const game of getCompletedGames(league)) {
    if (game.result.status !== "completed") continue

    for (const player of Object.values(game.result.players)) {
      const existing = statsByPlayer.get(player.playerId)
      if (existing) {
        existing.games += 1
        existing.points += player.points
        existing.assists += player.assists
        existing.rebounds += player.rebounds
        existing.steals += player.steals
        existing.blocks += player.blocks
        existing.fieldGoalsMade += player.fieldGoalsMade
        existing.fieldGoalsAttempted += player.fieldGoalsAttempted
      } else {
        statsByPlayer.set(player.playerId, {
          player,
          games: 1,
          points: player.points,
          assists: player.assists,
          rebounds: player.rebounds,
          steals: player.steals,
          blocks: player.blocks,
          fieldGoalsMade: player.fieldGoalsMade,
          fieldGoalsAttempted: player.fieldGoalsAttempted,
        })
      }
    }
  }

  return Array.from(statsByPlayer.values())
}

function getLeaderRows(
  league: LeagueDocument,
  teamId?: string,
  limit = 5
): Array<LeagueLeaderRow> {
  const stats = getPlayerStatLines(league)

  return LEADER_CATEGORIES.flatMap((category) => {
    return stats
      .filter(
        (item) =>
          (!teamId || item.player.teamId === teamId) &&
          (category.id !== "field-goal-percentage" ||
            item.fieldGoalsAttempted > 0)
      )
      .map((item) => {
        const formatted = category.format(item)
        return {
          categoryId: category.id,
          playerId: item.player.playerId,
          playerName: playerName(league, item.player.playerId),
          teamName: league.entities.teams[item.player.teamId].name,
          value: formatted.value,
          displayValue: formatted.displayValue,
        }
      })
      .sort((left, right) => {
        if (right.value !== left.value) return right.value - left.value
        return left.playerName.localeCompare(right.playerName)
      })
      .slice(0, limit)
  })
}

type TeamTotals = {
  teamId: string
  games: number
  points: number
  opponentPoints: number
  possessions: number
  opponentPossessions: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  rebounds: number
  assists: number
  turnovers: number
}

function getTeamTotals(league: LeagueDocument): Map<string, TeamTotals> {
  const totals = new Map<string, TeamTotals>()

  for (const teamId of Object.keys(league.entities.teams)) {
    totals.set(teamId, {
      teamId,
      games: 0,
      points: 0,
      opponentPoints: 0,
      possessions: 0,
      opponentPossessions: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      rebounds: 0,
      assists: 0,
      turnovers: 0,
    })
  }

  for (const game of getCompletedGames(league)) {
    if (game.result.status !== "completed") continue

    const result = game.result
    for (const [teamId, stats] of Object.entries(result.teams)) {
      const opponentId =
        teamId === result.homeTeamId ? result.awayTeamId : result.homeTeamId
      const opponentStats = result.teams[opponentId]
      const current = totals.get(teamId)
      if (!current) continue

      current.games += 1
      current.points += stats.points
      current.opponentPoints += opponentStats.points
      current.possessions += stats.possessions
      current.opponentPossessions += opponentStats.possessions
      current.fieldGoalsMade += stats.fieldGoalsMade
      current.fieldGoalsAttempted += stats.fieldGoalsAttempted
      current.rebounds += stats.offensiveRebounds + stats.defensiveRebounds
      current.assists += stats.assists
      current.turnovers += stats.turnovers
    }
  }

  return totals
}

type TeamStatId =
  | "points-per-game"
  | "opponent-points-per-game"
  | "net-rating"
  | "field-goal-percentage"
  | "rebounds-per-game"
  | "assists-per-game"
  | "turnovers-per-game"

type TeamStatRow = {
  id: TeamStatId
  label: string
  value: number | null
  displayValue: string
  rank: number | null
}

const TEAM_STAT_DEFINITIONS: Array<{
  id: TeamStatId
  label: string
  higherIsBetter: boolean
  getValue: (totals: TeamTotals) => number | null
  format: (value: number | null) => string
}> = [
  {
    id: "points-per-game",
    label: "Points per game",
    higherIsBetter: true,
    getValue: (totals) =>
      totals.games > 0 ? totals.points / totals.games : null,
    format: (value) => (value === null ? "—" : value.toFixed(1)),
  },
  {
    id: "opponent-points-per-game",
    label: "Opp. points per game",
    higherIsBetter: false,
    getValue: (totals) =>
      totals.games > 0 ? totals.opponentPoints / totals.games : null,
    format: (value) => (value === null ? "—" : value.toFixed(1)),
  },
  {
    id: "net-rating",
    label: "Net rating",
    higherIsBetter: true,
    getValue: (totals) => {
      if (totals.possessions <= 0 || totals.opponentPossessions <= 0) {
        return null
      }
      return (
        (totals.points / totals.possessions) * 100 -
        (totals.opponentPoints / totals.opponentPossessions) * 100
      )
    },
    format: (value) =>
      value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}`,
  },
  {
    id: "field-goal-percentage",
    label: "Field-goal percentage",
    higherIsBetter: true,
    getValue: (totals) =>
      totals.fieldGoalsAttempted > 0
        ? (totals.fieldGoalsMade / totals.fieldGoalsAttempted) * 100
        : null,
    format: (value) => (value === null ? "—" : `${value.toFixed(1)}%`),
  },
  {
    id: "rebounds-per-game",
    label: "Rebounds per game",
    higherIsBetter: true,
    getValue: (totals) =>
      totals.games > 0 ? totals.rebounds / totals.games : null,
    format: (value) => (value === null ? "—" : value.toFixed(1)),
  },
  {
    id: "assists-per-game",
    label: "Assists per game",
    higherIsBetter: true,
    getValue: (totals) =>
      totals.games > 0 ? totals.assists / totals.games : null,
    format: (value) => (value === null ? "—" : value.toFixed(1)),
  },
  {
    id: "turnovers-per-game",
    label: "Turnovers per game",
    higherIsBetter: false,
    getValue: (totals) =>
      totals.games > 0 ? totals.turnovers / totals.games : null,
    format: (value) => (value === null ? "—" : value.toFixed(1)),
  },
]

function getTeamStatRows(
  league: LeagueDocument,
  teamId: string
): Array<TeamStatRow> {
  const totals = getTeamTotals(league)
  const allTotals = Array.from(totals.values()).filter((item) => item.games > 0)
  const current = totals.get(teamId)

  return TEAM_STAT_DEFINITIONS.map((definition) => {
    const value = current ? definition.getValue(current) : null
    const rankedRows = allTotals
      .map((item) => ({
        teamId: item.teamId,
        value: definition.getValue(item),
      }))
      .filter(
        (item): item is { teamId: string; value: number } =>
          typeof item.value === "number" && Number.isFinite(item.value)
      )
      .sort((left, right) =>
        definition.higherIsBetter
          ? right.value - left.value
          : left.value - right.value
      )
    const rankIndex = rankedRows.findIndex((item) => item.teamId === teamId)

    return {
      id: definition.id,
      label: definition.label,
      value,
      displayValue: definition.format(value),
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
    }
  })
}

type PanelHeaderProps = {
  eyebrow: string
  title: string
  actionLabel?: string
  onAction?: () => void
}

function PanelHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
}: PanelHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 truncate text-base font-semibold tracking-[-0.02em]">
          {title}
        </h2>
      </div>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={onAction}
        >
          {actionLabel}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Button>
      ) : null}
    </div>
  )
}

function StandingsTable({
  rows,
  league,
  teamId,
  useGlobalRank = false,
}: {
  rows: ReturnType<typeof getStandingRows>
  league: LeagueDocument
  teamId: string
  useGlobalRank?: boolean
}) {
  return (
    <Table>
      <TableCaption className="sr-only">Current league standings.</TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Conference</TableHead>
          <TableHead className="text-right">W</TableHead>
          <TableHead className="text-right">L</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const { conference } = getDivisionAndConference(league, row.team.id)
          return (
            <TableRow
              key={row.team.id}
              data-state={row.team.id === teamId ? "selected" : undefined}
            >
              <TableCell className="text-muted-foreground tabular-nums">
                {useGlobalRank ? row.rank : index + 1}
              </TableCell>
              <TableCell className="max-w-0 truncate font-medium">
                {row.team.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {conference?.name.replace(" Conference", "") ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.wins}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {row.losses}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function StandingsPanel({
  league,
  teamId,
  onViewAll,
}: {
  league: LeagueDocument
  teamId: string
  onViewAll: () => void
}) {
  const rows = getStandingRows(league)
  const conferences = league.state.structure?.conferences ?? []
  const [selectedConferenceId, setSelectedConferenceId] = React.useState(
    conferences[0]?.id ?? "all"
  )
  const selectedRows = rows.filter((row) => {
    if (selectedConferenceId === "all") return true
    return (
      getDivisionAndConference(league, row.team.id).conference?.id ===
      selectedConferenceId
    )
  })

  return (
    <section
      aria-labelledby="standings-heading"
      className="flex min-h-0 flex-col border-y border-border"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            League view
          </p>
          <h2
            id="standings-heading"
            className="mt-1 text-base font-semibold tracking-[-0.02em]"
          >
            Standings
          </h2>
        </div>
        <div className="flex min-w-0 items-end gap-2">
          <Tabs
            value={selectedConferenceId}
            onValueChange={setSelectedConferenceId}
            className="min-w-0"
          >
            <TabsList
              variant="line"
              className="w-max max-w-full justify-start overflow-x-auto"
            >
              {conferences.length > 0 ? (
                conferences.map((conference) => (
                  <TabsTrigger key={conference.id} value={conference.id}>
                    {conference.name.replace(" Conference", "")}
                  </TabsTrigger>
                ))
              ) : (
                <TabsTrigger value="all">All teams</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={onViewAll}
          >
            View all
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={13}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <StandingsTable rows={selectedRows} league={league} teamId={teamId} />
      </div>
    </section>
  )
}

function LeadersTable({
  rows,
  showTeam,
}: {
  rows: Array<LeagueLeaderRow>
  showTeam: boolean
}) {
  return (
    <Table>
      <TableCaption className="sr-only">Player leaders.</TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>Player</TableHead>
          {showTeam ? <TableHead>Team</TableHead> : null}
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.categoryId}:${row.playerId}`}>
            <TableCell className="text-muted-foreground tabular-nums">
              {index + 1}
            </TableCell>
            <TableCell className="max-w-0 truncate font-medium">
              {row.playerName}
            </TableCell>
            {showTeam ? (
              <TableCell className="max-w-0 truncate text-muted-foreground">
                {row.teamName}
              </TableCell>
            ) : null}
            <TableCell className="text-right font-medium tabular-nums">
              {row.displayValue}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LeadersPanel({
  league,
  teamId,
  scope,
  onViewAll,
}: {
  league: LeagueDocument
  teamId: string
  scope: "league" | "team"
  onViewAll: () => void
}) {
  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<LeaderCategoryId>("points")
  const rows = getLeaderRows(league, scope === "team" ? teamId : undefined, 5)
  const selectedRows = rows.filter(
    (row) => row.categoryId === selectedCategoryId
  )
  const selectedCategory = LEADER_CATEGORIES.find(
    (category) => category.id === selectedCategoryId
  )

  return (
    <section
      aria-labelledby={`${scope}-leaders-heading`}
      className="flex min-h-0 flex-col border-y border-border"
    >
      <PanelHeader
        eyebrow={scope === "league" ? "League view" : "Your team"}
        title={scope === "league" ? "League leaders" : "Team leaders"}
        actionLabel="View all"
        onAction={onViewAll}
      />
      <div className="border-b border-border px-4 py-2 sm:px-5">
        <Tabs
          value={selectedCategoryId}
          onValueChange={(value) =>
            setSelectedCategoryId(value as LeaderCategoryId)
          }
        >
          <TabsList
            variant="line"
            className="w-full justify-start overflow-x-auto"
          >
            {LEADER_CATEGORIES.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="shrink-0"
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {selectedRows.length > 0 ? (
          <LeadersTable rows={selectedRows} showTeam={scope === "league"} />
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            {scope === "league"
              ? "League leaders will appear after games are completed."
              : "Team leaders will appear after your team plays."}
          </p>
        )}
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        Top five · {selectedCategory?.label ?? "Category"}
      </p>
    </section>
  )
}

function TeamStatsTable({ rows }: { rows: Array<TeamStatRow> }) {
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2.5 text-sm sm:px-5"
        >
          <span className="min-w-0 truncate">{row.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.rank ? `#${row.rank}` : "—"}
          </span>
          <span className="min-w-14 text-right font-semibold tabular-nums">
            {row.displayValue}
          </span>
        </div>
      ))}
    </div>
  )
}

function TeamStatsPanel({
  league,
  teamId,
  onViewAll,
}: {
  league: LeagueDocument
  teamId: string
  onViewAll: () => void
}) {
  const rows = getTeamStatRows(league, teamId)

  return (
    <section
      aria-labelledby="team-stats-heading"
      className="flex min-h-0 flex-col border-y border-border"
    >
      <PanelHeader
        eyebrow="Your team"
        title="Team stats"
        actionLabel="View all"
        onAction={onViewAll}
      />
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        <span>Current season</span>
        <span>Rank · value</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length > 0 ? (
          <TeamStatsTable rows={rows} />
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            Team statistics will appear after games are completed.
          </p>
        )}
      </div>
    </section>
  )
}

function ScheduleTable({
  league,
  games,
  teamId,
}: {
  league: LeagueDocument
  games: Array<LeagueScheduleEntry>
  teamId: string
}) {
  return (
    <Table>
      <TableCaption className="sr-only">Upcoming team schedule.</TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead className="text-right">H/A</TableHead>
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
              <TableCell className="max-w-0 truncate">
                {opponent.name}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {opponent.home ? "Home" : "Away"}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function UpcomingSchedulePanel({
  league,
  teamId,
  onViewAll,
}: {
  league: LeagueDocument
  teamId: string
  onViewAll: () => void
}) {
  const games = getNextGames(league, teamId)

  return (
    <section
      aria-labelledby="upcoming-schedule-heading"
      className="flex min-h-0 flex-col border-y border-border"
    >
      <PanelHeader
        eyebrow="Team calendar"
        title="Upcoming schedule"
        actionLabel="View all"
        onAction={onViewAll}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {games.length > 0 ? (
          <ScheduleTable league={league} games={games} teamId={teamId} />
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            No scheduled games are waiting on the current calendar.
          </p>
        )}
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        Next five games
      </p>
    </section>
  )
}

type DashboardSheet =
  | "standings"
  | "league-leaders"
  | "team-leaders"
  | "team-stats"
  | "schedule"
  | null

function DashboardDetailSheet({
  sheet,
  league,
  teamId,
  onOpenChange,
}: {
  sheet: DashboardSheet
  league: LeagueDocument
  teamId: string
  onOpenChange: (open: boolean) => void
}) {
  const selectedCategoryId: LeaderCategoryId = "points"
  const sheetDetails = {
    standings: {
      title: "Full standings",
      description: "All teams in the current league table.",
    },
    "league-leaders": {
      title: "League leaders",
      description: "Top players by the selected default category.",
    },
    "team-leaders": {
      title: "Team leaders",
      description:
        "Top players on your roster by the selected default category.",
    },
    "team-stats": {
      title: "Team statistical profile",
      description: "Current-season rank and value across the league.",
    },
    schedule: {
      title: "Full upcoming schedule",
      description: "The next scheduled games for your team.",
    },
  } as const

  return (
    <Sheet open={Boolean(sheet)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden sm:max-w-xl">
        {sheet ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <SheetTitle className="text-base font-semibold">
                {sheetDetails[sheet].title}
              </SheetTitle>
              <SheetDescription>
                {sheetDetails[sheet].description}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-auto">
              {sheet === "standings" ? (
                <StandingsTable
                  rows={getStandingRows(league)}
                  league={league}
                  teamId={teamId}
                  useGlobalRank
                />
              ) : null}
              {sheet === "league-leaders" ? (
                <LeadersTable
                  rows={getLeaderRows(league, undefined, 20).filter(
                    (row) => row.categoryId === selectedCategoryId
                  )}
                  showTeam
                />
              ) : null}
              {sheet === "team-leaders" ? (
                <LeadersTable
                  rows={getLeaderRows(league, teamId, 20).filter(
                    (row) => row.categoryId === selectedCategoryId
                  )}
                  showTeam={false}
                />
              ) : null}
              {sheet === "team-stats" ? (
                <TeamStatsTable rows={getTeamStatRows(league, teamId)} />
              ) : null}
              {sheet === "schedule" ? (
                <ScheduleTable
                  league={league}
                  games={getNextGames(league, teamId, 30)}
                  teamId={teamId}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DashboardPage() {
  const { league, teamId } = useLeagueShell()
  const [sheet, setSheet] = React.useState<DashboardSheet>(null)

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden lg:px-8">
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.92fr)]">
        <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,1.34fr)_minmax(0,0.96fr)]">
          <StandingsPanel
            league={league}
            teamId={teamId}
            onViewAll={() => setSheet("standings")}
          />
          <div className="grid min-h-0 gap-3 md:grid-cols-2">
            <LeadersPanel
              league={league}
              teamId={teamId}
              scope="league"
              onViewAll={() => setSheet("league-leaders")}
            />
            <LeadersPanel
              league={league}
              teamId={teamId}
              scope="team"
              onViewAll={() => setSheet("team-leaders")}
            />
          </div>
        </div>
        <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,0.96fr)_minmax(0,1.34fr)]">
          <TeamStatsPanel
            league={league}
            teamId={teamId}
            onViewAll={() => setSheet("team-stats")}
          />
          <UpcomingSchedulePanel
            league={league}
            teamId={teamId}
            onViewAll={() => setSheet("schedule")}
          />
        </div>
      </div>
      <DashboardDetailSheet
        sheet={sheet}
        league={league}
        teamId={teamId}
        onOpenChange={(open) => {
          if (!open) setSheet(null)
        }}
      />
    </div>
  )
}
