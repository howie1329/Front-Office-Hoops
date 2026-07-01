import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router"

import { teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/pick-team")({
  component: LeaguePickTeamPage,
})

function LeaguePickTeamPage() {
  const navigate = useNavigate()
  const { status, seasonState, userTeamId, setUserTeamId, error } =
    useLeagueContext()

  if (status === "empty") {
    return <Navigate to="/league/create" />
  }

  if (userTeamId) {
    return <Navigate to="/league" />
  }

  if (!seasonState) {
    return null
  }

  const teams = seasonState.teams
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handlePickTeam(teamId: string) {
    await setUserTeamId(teamId)
    void navigate({ to: "/league" })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Pick your team</h1>
          <p className="text-xs text-muted-foreground">
            Choose the franchise you will run as GM.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>30 teams</CardTitle>
          <CardDescription>
            Conference and division assignments are set. Pick any team to begin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Button
              key={team.id}
              variant="outline"
              className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
              onClick={() => void handlePickTeam(team.id)}
            >
              <span className="font-medium">{teamName(seasonState, team.id)}</span>
              <span className="text-xs text-muted-foreground">
                {team.abbrev} · {team.overall} OVR
                {team.conferenceId ? ` · ${team.conferenceId}` : ""}
                {team.divisionId ? ` · ${team.divisionId}` : ""}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
