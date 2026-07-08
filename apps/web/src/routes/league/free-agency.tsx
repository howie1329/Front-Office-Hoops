import { createFileRoute } from "@tanstack/react-router"
import { getExternalFreeAgents } from "@workspace/sim"

import { FreeAgencyPanel } from "@/components/league/FreeAgencyPanel"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/free-agency")({
  component: LeagueFreeAgencyPage,
})

function LeagueFreeAgencyPage() {
  const {
    league,
    userTeamId,
    isOffseason,
    offseasonPhase,
    submitPlayerContractOffer,
    advanceFreeAgencyMarketDay,
  } = useLeagueContext()

  if (!league || !userTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Free agency</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No team selected. Pick a team to continue.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!isOffseason || offseasonPhase !== "free_agency") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Free agency</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            External free agency opens after the draft. Advance the league to the
            free agency phase to sign available players.
          </p>
        </CardContent>
      </Card>
    )
  }

  const externalFreeAgents = getExternalFreeAgents(league, userTeamId)

  return (
    <FreeAgencyPanel
      league={league}
      teamId={userTeamId}
      freeAgents={externalFreeAgents}
      title="Free agency"
      description="Sign external free agents after the draft."
      emptyMessage="No external free agents are currently available."
      mode="external"
      onOffer={submitPlayerContractOffer}
      onAdvanceMarketDay={advanceFreeAgencyMarketDay}
    />
  )
}
