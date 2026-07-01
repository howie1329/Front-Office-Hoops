import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { createRng, simulateTeamMatchup } from "@workspace/sim"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"
import type { TeamMatchupResult } from "@workspace/shared/types"
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

export const Route = createFileRoute("/sim-lab")({ component: SimLabPage })

function SimLabPage() {
  const [homeTeamId, setHomeTeamId] = useState(SAMPLE_TEAMS[0]!.id)
  const [awayTeamId, setAwayTeamId] = useState(SAMPLE_TEAMS[1]!.id)
  const [seed, setSeed] = useState("demo")
  const [result, setResult] = useState<TeamMatchupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const homeTeam = SAMPLE_TEAMS.find((team) => team.id === homeTeamId)
  const awayTeam = SAMPLE_TEAMS.find((team) => team.id === awayTeamId)

  function handleSimulate() {
    if (!homeTeam || !awayTeam) {
      setError("Select valid home and away teams.")
      return
    }

    if (homeTeam.id === awayTeam.id) {
      setError("Home and away teams must be different.")
      return
    }

    setError(null)
    setResult(
      simulateTeamMatchup(
        { home: homeTeam, away: awayTeam },
        createRng(seed || "demo"),
      ),
    )
  }

  const winner =
    result && homeTeam && awayTeam
      ? result.winnerId === homeTeam.id
        ? homeTeam
        : awayTeam
      : null

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Sim Lab</h1>
          <p className="text-xs text-muted-foreground">
            Team vs team probe for Step 1 simulation.
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
                {SAMPLE_TEAMS.map((team) => (
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
                {SAMPLE_TEAMS.map((team) => (
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

      {result && homeTeam && awayTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              Winner: {winner?.name ?? "Unknown"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="font-medium">
              {homeTeam.abbrev} {result.homeScore} – {result.awayScore}{" "}
              {awayTeam.abbrev}
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[0.7rem] leading-relaxed">
              {JSON.stringify(result.meta, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
