import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import {
  createRng,
  getRosterByTeamId,
  SAMPLE_ROSTERS,
  simulateTeamMatchup,
} from "@workspace/sim"
import type { TeamMatchupResult, TeamWithRoster } from "@workspace/shared/types"
import { BoxScoreTable } from "@/components/box-score/BoxScoreTable"
import { QuarterLineTable } from "@/components/box-score/QuarterLineTable"
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

export const Route = createFileRoute("/sim-lab")({ component: SimLabPage })

function RosterCard({ roster }: { roster: TeamWithRoster }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{roster.name}</CardTitle>
        <CardDescription>
          {roster.abbrev} · {roster.overall} OVR · {roster.pace} pace
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>USG</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.firstName} {player.lastName}
                </TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>{player.ratings.overall}</TableCell>
                <TableCell>{player.ratings.usage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SimLabPage() {
  const [homeTeamId, setHomeTeamId] = useState(SAMPLE_ROSTERS[0]!.id)
  const [awayTeamId, setAwayTeamId] = useState(SAMPLE_ROSTERS[1]!.id)
  const [seed, setSeed] = useState("demo")
  const [result, setResult] = useState<TeamMatchupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const homeRoster = getRosterByTeamId(homeTeamId)
  const awayRoster = getRosterByTeamId(awayTeamId)

  function handleSimulate() {
    if (!homeRoster || !awayRoster) {
      setError("Select valid home and away teams.")
      return
    }

    if (homeRoster.id === awayRoster.id) {
      setError("Home and away teams must be different.")
      return
    }

    setError(null)
    setResult(
      simulateTeamMatchup(
        { home: homeRoster, away: awayRoster },
        createRng(seed || "demo"),
      ),
    )
  }

  const winner =
    result && homeRoster && awayRoster
      ? result.winnerId === homeRoster.id
        ? homeRoster
        : awayRoster
      : null

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Sim Lab</h1>
          <p className="text-xs text-muted-foreground">
            Roster-driven team simulation with box scores.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matchup</CardTitle>
          <CardDescription>
            Pick two teams, set a seed, and simulate a final score.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="home-team">Home team</Label>
            <Select value={homeTeamId} onValueChange={setHomeTeamId}>
              <SelectTrigger id="home-team" className="w-full">
                <SelectValue placeholder="Select home team" />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_ROSTERS.map((team) => (
                  <SelectItem
                    key={team.id}
                    value={team.id}
                    disabled={team.id === awayTeamId}
                  >
                    {team.name} ({team.overall} OVR, {team.pace} pace)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="away-team">Away team</Label>
            <Select value={awayTeamId} onValueChange={setAwayTeamId}>
              <SelectTrigger id="away-team" className="w-full">
                <SelectValue placeholder="Select away team" />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_ROSTERS.map((team) => (
                  <SelectItem
                    key={team.id}
                    value={team.id}
                    disabled={team.id === homeTeamId}
                  >
                    {team.name} ({team.overall} OVR, {team.pace} pace)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="seed">Seed</Label>
            <Input
              id="seed"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="demo"
            />
          </div>

          <Button onClick={handleSimulate}>Simulate</Button>

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      {homeRoster && awayRoster ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <RosterCard roster={homeRoster} />
          <RosterCard roster={awayRoster} />
        </div>
      ) : null}

      {result && homeRoster && awayRoster ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>
                Winner: {winner?.name ?? "Unknown"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <QuarterLineTable
                homeAbbrev={homeRoster.abbrev}
                awayAbbrev={awayRoster.abbrev}
                result={result}
              />
              <p className="font-medium">
                {homeRoster.abbrev} {result.homeScore} – {result.awayScore}{" "}
                {awayRoster.abbrev}
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[0.7rem] leading-relaxed">
                {JSON.stringify(result.meta, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <BoxScoreTable roster={homeRoster} stats={result.homePlayerStats} />
            <BoxScoreTable roster={awayRoster} stats={result.awayPlayerStats} />
          </div>
        </>
      ) : null}
    </div>
  )
}
