import { createFileRoute } from "@tanstack/react-router"

import { PlayerSeasonStatsTable } from "@/components/league/PlayerSeasonStatsTable"
import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/stats")({
  component: LeagueStatsPage,
})

function LeagueStatsPage() {
  const { seasonState, myTeam } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  return (
    <PlayerSeasonStatsTable
      state={seasonState}
      defaultTeamFilter={myTeam?.id ?? "all"}
    />
  )
}
