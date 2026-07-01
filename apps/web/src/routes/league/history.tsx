import { createFileRoute } from "@tanstack/react-router"

import { SeasonHistoryTable } from "@/components/league/SeasonHistoryTable"
import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/history")({
  component: LeagueHistoryPage,
})

function LeagueHistoryPage() {
  const { seasonState, seasonHistory } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  return (
    <SeasonHistoryTable history={seasonHistory} teams={seasonState.teams} />
  )
}
