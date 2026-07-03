import { createFileRoute } from "@tanstack/react-router"
import { getExternalFreeAgents, getTeamExpiredFreeAgents } from "@workspace/sim"

import { CapSheetCard } from "@/components/league/CapSheetCard"
import { FreeAgencyPanel } from "@/components/league/FreeAgencyPanel"
import { RosterCard } from "@/components/league/RosterCard"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/team")({
  component: LeagueTeamPage,
})

function LeagueTeamPage() {
  const {
    league,
    myTeam,
    userTeamId,
    isOffseason,
    offseasonPhase,
    releasePlayer,
    signFreeAgent,
  } = useLeagueContext()

  if (!myTeam || !league || !userTeamId) {
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

  const reSignFreeAgents = getTeamExpiredFreeAgents(league, userTeamId)
  const externalFreeAgents = getExternalFreeAgents(league, userTeamId)

  return (
    <div className="flex flex-col gap-4">
      <CapSheetCard league={league} teamId={userTeamId} />

      {isOffseason ? (
        <Card>
          <CardHeader>
            <CardTitle>Offseason roster moves</CardTitle>
            <CardDescription>
              Release players, re-sign your own free agents, and fill out a 12-man
              roster before the next season.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <RosterCard
        roster={myTeam}
        contracts={league.contracts}
        showRelease={isOffseason}
        onReleasePlayer={releasePlayer}
      />

      {isOffseason && offseasonPhase === "re_signing" ? (
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
      ) : null}

      {isOffseason && offseasonPhase === "free_agency" ? (
        <FreeAgencyPanel
          league={league}
          teamId={userTeamId}
          freeAgents={externalFreeAgents}
          title="Free agency"
          description="Sign external free agents after the draft."
          emptyMessage="No external free agents are currently available."
          mode="external"
          onSign={signFreeAgent}
        />
      ) : null}
    </div>
  )
}
