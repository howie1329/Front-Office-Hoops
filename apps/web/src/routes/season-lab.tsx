import { createFileRoute, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import {
  simulateDay,
  simulateSeason,
  simulateWeek,
  sortPlayerSeasonStats,
} from "@workspace/sim"
import type { Game, ScheduleGame, SeasonState } from "@workspace/shared/types"
import { GameDetailCard } from "@/components/box-score/GameDetailCard"
import { playerName } from "@/components/box-score/playerName"
import { useLeague } from "@/hooks/useLeague"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const Route = createFileRoute("/season-lab")({ component: SeasonLabPage })

function teamAbbrev(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.abbrev ?? teamId
}

function teamName(state: SeasonState, teamId: string): string {
  return state.teams.find((team) => team.id === teamId)?.name ?? teamId
}

function getTeamById(state: SeasonState, teamId: string) {
  return state.teams.find((team) => team.id === teamId)
}

function winPct(wins: number, losses: number): string {
  const games = wins + losses
  if (games === 0) {
    return ".000"
  }

  return (wins / games).toFixed(3).replace(/^0/, "")
}

function formatStreak(streak: number): string {
  if (streak > 0) {
    return `W${streak}`
  }
  if (streak < 0) {
    return `L${Math.abs(streak)}`
  }
  return "-"
}

function formatGameLine(state: SeasonState, game: Game): string {
  const home = teamAbbrev(state, game.homeTeamId)
  const away = teamAbbrev(state, game.awayTeamId)
  return `Day ${game.day}: ${away} @ ${home} — ${game.result.awayScore}-${game.result.homeScore}`
}

function formatScheduledLine(state: SeasonState, game: ScheduleGame): string {
  const home = teamAbbrev(state, game.homeTeamId)
  const away = teamAbbrev(state, game.awayTeamId)
  return `${away} @ ${home}`
}

function StandingsTable({ state }: { state: SeasonState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
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
            {state.standings.map((row) => (
              <TableRow key={row.teamId}>
                <TableCell>{teamName(state, row.teamId)}</TableCell>
                <TableCell>{row.wins}</TableCell>
                <TableCell>{row.losses}</TableCell>
                <TableCell>{winPct(row.wins, row.losses)}</TableCell>
                <TableCell>{row.pointsFor}</TableCell>
                <TableCell>{row.pointsAgainst}</TableCell>
                <TableCell>{formatStreak(row.streak)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function PlayerSeasonStatsTable({ state }: { state: SeasonState }) {
  const [teamFilter, setTeamFilter] = useState("all")

  const rows = useMemo(() => {
    const sorted = sortPlayerSeasonStats(state.playerSeasonStats)
    if (teamFilter === "all") {
      return sorted
    }

    return sorted.filter((row) => row.teamId === teamFilter)
  }, [state.playerSeasonStats, teamFilter])

  const allPlayers = state.teams.flatMap((team) => team.players)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player season stats</CardTitle>
        <CardDescription>
          Aggregated from completed games. Sorted by points.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="stats-team-filter">Team filter</Label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger id="stats-team-filter" className="w-full">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {state.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>GP</TableHead>
              <TableHead>GS</TableHead>
              <TableHead>MIN</TableHead>
              <TableHead>PTS</TableHead>
              <TableHead>REB</TableHead>
              <TableHead>AST</TableHead>
              <TableHead>STL</TableHead>
              <TableHead>BLK</TableHead>
              <TableHead>TOV</TableHead>
              <TableHead>FG</TableHead>
              <TableHead>3PT</TableHead>
              <TableHead>FT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{playerName(allPlayers, row.playerId)}</TableCell>
                  <TableCell>{teamAbbrev(state, row.teamId)}</TableCell>
                  <TableCell>{row.gp}</TableCell>
                  <TableCell>{row.gs}</TableCell>
                  <TableCell>{row.min}</TableCell>
                  <TableCell>{row.pts}</TableCell>
                  <TableCell>{row.reb}</TableCell>
                  <TableCell>{row.ast}</TableCell>
                  <TableCell>{row.stl}</TableCell>
                  <TableCell>{row.blk}</TableCell>
                  <TableCell>{row.tov}</TableCell>
                  <TableCell>
                    {row.fgm}-{row.fga}
                  </TableCell>
                  <TableCell>
                    {row.tpm}-{row.tpa}
                  </TableCell>
                  <TableCell>
                    {row.ftm}-{row.fta}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-muted-foreground">
                  No player stats yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SeasonLabPage() {
  const [seed, setSeed] = useState("season-demo")
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const {
    status,
    saveStatus,
    seasonState: state,
    error,
    createNewLeague,
    updateSeasonState,
  } = useLeague()

  async function handleNewSeason() {
    setSelectedGameId(null)
    const baseSeed = seed || "season-demo"
    await createNewLeague(`Season ${baseSeed}`, baseSeed)
  }

  function handleSimDay() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateDay(current))
  }

  function handleSimWeek() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateWeek(current))
  }

  function handleSimSeason() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateSeason(current))
  }

  function handleGameClick(gameId: string) {
    setSelectedGameId((current) => (current === gameId ? null : gameId))
  }

  const todaysGames =
    state?.schedule.filter(
      (game) => game.day === state.currentDay && game.status === "scheduled",
    ) ?? []

  const upcomingGames =
    state?.schedule
      .filter((game) => game.status === "scheduled")
      .sort((a, b) => a.day - b.day)
      .slice(0, 7) ?? []

  const completedGames =
    state?.games
      .slice()
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id)) ?? []

  const selectedGame = state?.games.find((game) => game.id === selectedGameId)
  const selectedHomeTeam =
    selectedGame && state ? getTeamById(state, selectedGame.homeTeamId) : undefined
  const selectedAwayTeam =
    selectedGame && state ? getTeamById(state, selectedGame.awayTeamId) : undefined

  const remainingGames =
    state?.schedule.filter((game) => game.status === "scheduled").length ?? 0

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Season Lab</h1>
          <p className="text-xs text-muted-foreground">
            Six-team double round-robin: schedule, day/week sim, standings, game
            detail, player stats, and local save.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Season controls</CardTitle>
          <CardDescription>
            Generate a 30-game schedule, then simulate by day, week, or full season.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="season-seed">Seed</Label>
            <Input
              id="season-seed"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="season-demo"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleNewSeason()} disabled={status === "loading"}>
              New season
            </Button>
            <Button variant="secondary" onClick={handleSimDay} disabled={!state}>
              Sim day
            </Button>
            <Button variant="secondary" onClick={handleSimWeek} disabled={!state}>
              Sim week
            </Button>
            <Button variant="secondary" onClick={handleSimSeason} disabled={!state}>
              Sim season
            </Button>
          </div>

          {status === "loading" ? (
            <p className="text-xs text-muted-foreground">Loading saved league…</p>
          ) : null}

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}

          {saveStatus === "saving" ? (
            <p className="text-xs text-muted-foreground">Saving…</p>
          ) : saveStatus === "saved" && state ? (
            <p className="text-xs text-muted-foreground">Saved locally</p>
          ) : null}

          {state ? (
            <p className="text-xs text-muted-foreground">
              Current day: {state.currentDay} · Games played: {state.games.length} ·
              Remaining: {remainingGames}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {state ? (
        <>
          <StandingsTable state={state} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Today (Day {state.currentDay})</CardTitle>
                <CardDescription>
                  Scheduled games for the current day pointer.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {todaysGames.length > 0 ? (
                  todaysGames.map((game) => (
                    <p key={game.id}>{formatScheduledLine(state, game)}</p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No games scheduled today.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming</CardTitle>
                <CardDescription>Next scheduled games.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {upcomingGames.length > 0 ? (
                  upcomingGames.map((game) => (
                    <p key={game.id}>
                      Day {game.day}: {formatScheduledLine(state, game)}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">Season complete.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Game log</CardTitle>
                <CardDescription>
                  Click a completed game to view quarters and box scores.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex max-h-96 flex-col gap-1 overflow-y-auto text-sm">
                {completedGames.length > 0 ? (
                  completedGames.map((game) => (
                    <Button
                      key={game.id}
                      variant="ghost"
                      className="h-auto justify-start px-2 py-1.5 text-left font-normal"
                      aria-selected={selectedGameId === game.id}
                      onClick={() => handleGameClick(game.id)}
                    >
                      {formatGameLine(state, game)}
                    </Button>
                  ))
                ) : (
                  <p className="text-muted-foreground">No games played yet.</p>
                )}
              </CardContent>
            </Card>

            {selectedGame && selectedHomeTeam && selectedAwayTeam ? (
              <GameDetailCard
                game={selectedGame}
                homeTeam={selectedHomeTeam}
                awayTeam={selectedAwayTeam}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Game detail</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Select a game from the log to view box scores.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <PlayerSeasonStatsTable state={state} />
        </>
      ) : null}
    </div>
  )
}
