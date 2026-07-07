import { createFileRoute } from "@tanstack/react-router"

import { TeamCalendar } from "@/components/league/TeamCalendar"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/calendar")({
  component: LeagueCalendarPage,
})

function LeagueCalendarPage() {
  const { seasonState, myTeam } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  if (!myTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team calendar</CardTitle>
          <CardDescription>
            Pick a team to view your schedule heatmap and trip timeline.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <TeamCalendar state={seasonState} teamId={myTeam.id} />
}
