import { createFileRoute } from "@tanstack/react-router"
import { getTeamExpiredFreeAgents } from "@workspace/sim"

import { FreeAgencyPanel } from "@/components/league/FreeAgencyPanel"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/re-signing")({
  component: LeagueReSigningPage,
})

function LeagueReSigningPage() {
  const {
    league,
    userTeamId,
    isOffseason,
    offseasonPhase,
    signFreeAgent,
  } = useLeagueContext()

  if (!league || !userTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Re-signing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No team selected. Pick a team to continue.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!isOffseason || offseasonPhase !== "re_signing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Re-signing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Re-signing opens during the offseason before the draft. Advance the
            league to the re-signing phase to negotiate with your expiring players.
          </p>
        </CardContent>
      </Card>
    )
  }

  const reSignFreeAgents = getTeamExpiredFreeAgents(league, userTeamId)

  return (
    <FreeAgencyPanel
      league={league}
      teamId={userTeamId}
      freeAgents={reSignFreeAgents}
      title="Re-signing"
      description="Negotiate with your own expiring players before the draft opens."
      emptyMessage="You do not have any expiring players to re-sign."
      mode="re_sign"
      onSign={signFreeAgent}
    />
  )
}
