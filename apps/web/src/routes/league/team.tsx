import { createFileRoute, Link } from "@tanstack/react-router"

import { RosterCard } from "@/components/league/RosterCard"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { Button } from "@workspace/ui/components/button"
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
  const { myTeam } = useLeagueContext()

  if (!myTeam) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to="/league/stats">View player stats</Link>
        </Button>
      </div>
      <RosterCard roster={myTeam} />
    </div>
  )
}
