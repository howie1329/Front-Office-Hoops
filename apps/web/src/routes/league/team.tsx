import { createFileRoute } from "@tanstack/react-router"

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
    releasePlayer,
    signFreeAgent,
    freeAgentPool,
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

  return (
    <div className="flex flex-col gap-4">
      <CapSheetCard league={league} teamId={userTeamId} />

      {isOffseason ? (
        <Card>
          <CardHeader>
            <CardTitle>Offseason roster moves</CardTitle>
            <CardDescription>
              Release players or sign free agents to reach a 12-man roster before
              the next season.
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

      {isOffseason ? (
        <FreeAgencyPanel
          league={league}
          teamId={userTeamId}
          freeAgents={freeAgentPool}
          onSign={signFreeAgent}
        />
      ) : null}
    </div>
  )
}
