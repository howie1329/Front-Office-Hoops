import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { Calendar01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
  GamePlayerBoxScore,
  LeagueDocument,
  LeagueGameRecord,
  LeagueScheduleEntry,
} from "@workspace/domain-v2"
import { getPlayerCurrentAbility } from "@workspace/sim-v2"

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

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
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
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 5)
}

type LeaderCategoryId =
  | "points"
  | "assists"
  | "rebounds"
  | "steals"
  | "blocks"
  | "field-goal-percentage"

type LeagueLeaderRow = {
  category: string
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
          ? `${((stats.fieldGoalsMade / stats.fieldGoalsAttempted) * 100).toFixed(1)}%`
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

function getLeagueLeaders(league: LeagueDocument): Array<LeagueLeaderRow> {
  const statsByPlayer = new Map<string, PlayerStatLine>()

  for (const game of getCompletedGames(league)) {
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

  return LEADER_CATEGORIES.flatMap((category) => {
    const rows = Array.from(statsByPlayer.values())
      .filter(
        (stats) =>
          category.id !== "field-goal-percentage" ||
          stats.fieldGoalsAttempted > 0
      )
      .map((stats) => {
        const formatted = category.format(stats)
        return {
          category: category.label,
          categoryId: category.id,
          playerId: stats.player.playerId,
          playerName: playerName(league, stats.player.playerId),
          teamName: league.entities.teams[stats.player.teamId].name,
          value: formatted.value,
          displayValue: formatted.displayValue,
        }
      })
      .sort((left, right) => {
        if (right.value !== left.value) return right.value - left.value
        return left.playerName.localeCompare(right.playerName)
      })
      .slice(0, 5)

    return rows
  })
}

function getRecentGameRows(league: LeagueDocument): Array<LeagueGameRecord> {
  return [...getCompletedGames(league)]
    .sort((left, right) => {
      if (right.date !== left.date) return right.date.localeCompare(left.date)
      return right.scheduleId.localeCompare(left.scheduleId)
    })
    .slice(0, 8)
}

function RosterWatchPanel({
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
      className="flex min-h-0 flex-col border-y border-border"
    >
      <div className="flex items-end justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
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
      <div className="min-h-0 overflow-auto">
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
      </div>
    </section>
  )
}

function StandingsPanel({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
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
      <div className="grid gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            League view
          </p>
          <h2
            id="standings-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Standings
          </h2>
        </div>
        <Tabs
          value={selectedConferenceId}
          onValueChange={setSelectedConferenceId}
          className="gap-0"
        >
          <TabsList variant="line" className="w-full justify-start sm:w-fit">
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
        <span className="text-xs text-muted-foreground">
          {selectedRows.length} teams
        </span>
      </div>
      <div className="min-h-0 overflow-auto">
        <Table>
          <TableCaption className="sr-only">
            Current league standings.
          </TableCaption>
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
            {selectedRows.map((row, index) => {
              const { conference } = getDivisionAndConference(
                league,
                row.team.id
              )
              return (
                <TableRow
                  key={row.team.id}
                  data-state={row.team.id === teamId ? "selected" : undefined}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.team.name}</TableCell>
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
      </div>
    </section>
  )
}

function UpcomingSchedulePanel({
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
      className="flex min-h-0 flex-col border-y border-border"
    >
      <div className="flex items-end justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Team calendar
          </p>
          <h2
            id="upcoming-schedule-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Upcoming schedule
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">Next five</span>
      </div>
      <div className="min-h-0 overflow-auto">
        <Table>
          <TableCaption className="sr-only">
            The selected team's next five scheduled games.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>H/A</TableHead>
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
      </div>
    </section>
  )
}

function LeagueLeadersPanel({ league }: { league: LeagueDocument }) {
  const rows = getLeagueLeaders(league)
  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<LeaderCategoryId>("points")
  const selectedRows = rows.filter(
    (row) => row.categoryId === selectedCategoryId
  )
  const selectedCategory = LEADER_CATEGORIES.find(
    (category) => category.id === selectedCategoryId
  )

  return (
    <section
      aria-labelledby="league-leaders-heading"
      className="flex min-h-0 flex-col border-y border-border"
    >
      <div className="grid gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            League view
          </p>
          <h2
            id="league-leaders-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            League leaders
          </h2>
        </div>
        <Tabs
          value={selectedCategoryId}
          onValueChange={(value) =>
            setSelectedCategoryId(value as LeaderCategoryId)
          }
          className="gap-0"
        >
          <TabsList
            variant="line"
            className="grid w-full grid-cols-3 sm:grid-cols-6"
          >
            {LEADER_CATEGORIES.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          Top five · {selectedCategory?.label ?? "Category"}
        </span>
      </div>
      <div className="min-h-0 overflow-auto">
        {selectedRows.length > 0 ? (
          <Table>
            <TableCaption className="sr-only">
              Top five league leaders for{" "}
              {selectedCategory?.label ?? "this category"}.
            </TableCaption>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedRows.map((row, index) => {
                return (
                  <TableRow key={`${row.categoryId}:${row.playerId}`}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {index + 1}
                    </TableCell>
                    <TableCell>{row.playerName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.teamName}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.displayValue}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            League leaders will appear after games are completed.
          </div>
        )}
      </div>
    </section>
  )
}

function RecentActivityPanel({ league }: { league: LeagueDocument }) {
  const games = getRecentGameRows(league)

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="flex min-h-0 flex-col border-y border-border"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            League log
          </p>
          <h2
            id="recent-activity-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Recent activity
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Latest completed games
        </span>
      </div>
      <div className="min-h-0 overflow-auto">
        {games.length > 0 ? (
          <Table>
            <TableCaption className="sr-only">
              Latest completed league games.
            </TableCaption>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Matchup</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.map((game) => {
                const homeTeam = league.entities.teams[game.result.homeTeamId]
                const awayTeam = league.entities.teams[game.result.awayTeamId]
                const homePoints =
                  game.result.teams[game.result.homeTeamId].points
                const awayPoints =
                  game.result.teams[game.result.awayTeamId].points
                return (
                  <TableRow key={game.scheduleId}>
                    <TableCell className="font-medium">
                      {formatDate(game.date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {awayTeam.name} at {homeTeam.name}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {awayPoints}–{homePoints}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            Completed games and league activity will appear here.
          </div>
        )}
      </div>
    </section>
  )
}

function KeyDatesPanel({ league }: { league: LeagueDocument }) {
  const milestones = [
    {
      label: "Trade deadline",
      date: league.state.calendar.milestones.tradeDeadline,
    },
    {
      label: "Regular season ends",
      date: league.state.calendar.regularSeasonEnd,
    },
    {
      label: "Playoffs begin",
      date: league.state.calendar.milestones.playoffsStart,
    },
  ].filter((milestone) => milestone.date >= league.state.calendar.currentDate)

  return (
    <section
      aria-labelledby="key-dates-heading"
      className="border-y border-border"
    >
      <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            Calendar
          </p>
          <h2
            id="key-dates-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Key dates
          </h2>
        </div>
        <HugeiconsIcon
          icon={Calendar01Icon}
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="text-muted-foreground"
        />
      </div>
      <div className="grid divide-y divide-border">
        {milestones.length > 0 ? (
          milestones.map((milestone) => (
            <div
              key={milestone.label}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5"
            >
              <span className="text-muted-foreground">{milestone.label}</span>
              <span className="font-medium tabular-nums">
                {formatDate(milestone.date)}
              </span>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
            No upcoming milestones are on the calendar.
          </p>
        )}
      </div>
    </section>
  )
}

function DashboardPage() {
  const { league, teamId } = useLeagueShell()

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6 lg:px-8 xl:overflow-hidden">
      <div className="grid min-h-0 gap-3 xl:flex-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_minmax(10rem,0.32fr)]">
          <StandingsPanel league={league} teamId={teamId} />
          <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(13rem,0.75fr)]">
            <RecentActivityPanel league={league} />
            <KeyDatesPanel league={league} />
          </div>
        </div>
        <div className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_minmax(10rem,0.32fr)]">
          <LeagueLeadersPanel league={league} />
          <div className="grid min-h-0 gap-3 lg:grid-cols-2">
            <UpcomingSchedulePanel league={league} teamId={teamId} />
            <RosterWatchPanel league={league} teamId={teamId} />
          </div>
        </div>
      </div>
    </div>
  )
}
