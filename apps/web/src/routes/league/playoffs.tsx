import { createFileRoute } from "@tanstack/react-router"
import { simulateDay } from "@workspace/sim"

import { PlayoffBracket } from "@/components/league/PlayoffBracket"
import { SeasonPhaseCard } from "@/components/league/SeasonPhaseCard"
import { SimControls } from "@/components/league/SimControls"
import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/playoffs")({
  component: LeaguePlayoffsPage,
})

function LeaguePlayoffsPage() {
  const {
    league,
    seasonState,
    userTeamId,
    status,
    saveStatus,
    error,
    phase,
    championTeamId,
    canBeginPlayoffs,
    canBeginOffseason,
    canPrepareDraft,
    canStartNextSeason,
    rosterOverLimit,
    cutsNeeded,
    beginPlayoffs,
    beginOffseason,
    prepareDraft,
    simulatePlayoffs,
    startNextSeason,
    updateSeasonState,
  } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <SeasonPhaseCard
        state={seasonState}
        championTeamId={championTeamId}
        canBeginPlayoffs={canBeginPlayoffs}
        canBeginOffseason={canBeginOffseason}
        canPrepareDraft={canPrepareDraft}
        canStartNextSeason={canStartNextSeason}
        rosterOverLimit={rosterOverLimit}
        cutsNeeded={cutsNeeded}
        onBeginPlayoffs={beginPlayoffs}
        onBeginOffseason={beginOffseason}
        onPrepareDraft={prepareDraft}
        onStartNextSeason={() => void startNextSeason()}
      />

      <SimControls
        state={seasonState}
        phase={phase}
        status={status}
        saveStatus={saveStatus}
        error={error}
        seed={league?.name ?? ""}
        onSeedChange={() => {}}
        onSimDay={() => updateSeasonState((current) => simulateDay(current))}
        onSimWeek={() => {}}
        onSimSeason={() => {}}
        onSimPlayoffDay={() =>
          updateSeasonState((current) => simulateDay(current))
        }
        onSimPlayoffs={simulatePlayoffs}
        title="Playoff simulation"
      />

      <PlayoffBracket state={seasonState} userTeamId={userTeamId} />
    </div>
  )
}
