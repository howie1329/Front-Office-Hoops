import { createFileRoute } from "@tanstack/react-router"

import { StandingsTable } from "@/components/league/StandingsTable"
import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/standings")({
  component: LeagueStandingsPage,
})

function LeagueStandingsPage() {
  const { seasonState, myTeam } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  return <StandingsTable state={seasonState} userTeamId={myTeam?.id ?? null} />
}
