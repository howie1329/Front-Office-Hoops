import { createFileRoute } from "@tanstack/react-router"
import { deriveTeamDefense, deriveTeamOffense } from "@workspace/sim"

import {
  formatCapSpaceMetric,
  TeamMetricsStrip,
} from "@/components/league/TeamMetricsStrip"
import { MyTeamRosterTable } from "@/components/league/MyTeamRosterTable"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
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
  const {
    league,
    myTeam,
    userTeamId,
    seasonState,
    rosterOverLimit,
    cutsNeeded,
    releasePlayer,
    extendContract,
  } = useLeagueContext()
  const financials = useTeamFinancials(league, userTeamId)

  if (!myTeam || !league || !userTeamId || !seasonState) {
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

  const capSpace = formatCapSpaceMetric(financials?.capSpace ?? null)

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <TeamMetricsStrip
        overall={myTeam.overall}
        offense={deriveTeamOffense(myTeam.players)}
        defense={deriveTeamDefense(myTeam.players)}
        payroll={
          financials?.payroll === undefined || financials?.payroll === null
            ? "-"
            : formatMoney(financials.payroll)
        }
        capSpace={capSpace.label}
        capSpaceTone={capSpace.tone}
        rosterCount={myTeam.players.length}
        rosterOverLimit={rosterOverLimit}
        cutsNeeded={cutsNeeded}
      />

      <div className="min-h-0 flex-1">
        <MyTeamRosterTable
          league={league}
          teamId={userTeamId}
          roster={myTeam}
          contracts={league.contracts}
          playerSeasonStats={seasonState.playerSeasonStats}
          teamScoutingLevel={financials?.teamFinance?.scoutingLevel}
          currentDay={seasonState.currentDay}
          onReleasePlayer={releasePlayer}
          onExtendContract={extendContract}
        />
      </div>
    </div>
  )
}
