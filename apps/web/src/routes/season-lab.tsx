import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import {
  createInitialSeason,
  createRng,
  SAMPLE_ROSTERS,
  simulateDay,
  simulateSeason,
  simulateWeek,
} from "@workspace/sim"
import type { Game, ScheduleGame, SeasonState } from "@workspace/shared/types"
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

function SeasonLabPage() {
  const [seed, setSeed] = useState("season-demo")
  const [state, setState] = useState<SeasonState | null>(null)

  function handleNewSeason() {
    setState(
      createInitialSeason(
        SAMPLE_ROSTERS,
        seed || "season-demo",
        createRng(`schedule:${seed || "season-demo"}`),
      ),
    )
  }

  function handleSimDay() {
    if (!state) {
      return
    }

    setState(simulateDay(state))
  }

  function handleSimWeek() {
    if (!state) {
      return
    }

    setState(simulateWeek(state))
  }

  function handleSimSeason() {
    if (!state) {
      return
    }

    setState(simulateSeason(state))
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

  const recentGames =
    state?.games
      .slice()
      .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
      .slice(0, 5) ?? []

  const remainingGames =
    state?.schedule.filter((game) => game.status === "scheduled").length ?? 0

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Season Lab</h1>
          <p className="text-xs text-muted-foreground">
            Six-team double round-robin: schedule, day/week sim, standings.
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
            <Button onClick={handleNewSeason}>New season</Button>
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

          <Card>
            <CardHeader>
              <CardTitle>Recent results</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {recentGames.length > 0 ? (
                recentGames.map((game) => (
                  <p key={game.id}>{formatGameLine(state, game)}</p>
                ))
              ) : (
                <p className="text-muted-foreground">No games played yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
