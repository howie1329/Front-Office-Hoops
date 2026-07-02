import { createFileRoute } from "@tanstack/react-router"

import { RosterCard } from "@/components/league/RosterCard"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { teamName } from "@/components/league/lib/teamFormat"

export const Route = createFileRoute("/league/team")({
  component: LeagueTeamPage,
})

function LeagueTeamPage() {
  const { myTeam, isOffseason, releasePlayer } = useLeagueContext()

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
      {isOffseason ? (
        <Card>
          <CardHeader>
            <CardTitle>Offseason roster moves</CardTitle>
            <CardDescription>
              Release players to get back to 12 before the next season starts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <RosterCard
        roster={myTeam}
        showRelease={isOffseason}
        onReleasePlayer={releasePlayer}
      />
    </div>
  )
}
