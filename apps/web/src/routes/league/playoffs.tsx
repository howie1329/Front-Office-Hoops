import { createFileRoute } from "@tanstack/react-router"

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
    canSimAiReSignings,
    canProceedToDraft,
    canPrepareDraft,
    canProceedToFreeAgency,
    canSimAiFreeAgency,
    canStartNextSeason,
    rosterOverLimit,
    cutsNeeded,
    beginPlayoffs,
    beginOffseason,
    completeReSignings,
    advanceToDraft,
    prepareDraft,
    advanceToFreeAgency,
    completeFreeAgency,
    simulatePlayoffs,
    startNextSeason,
    simDay,
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
        canSimAiReSignings={canSimAiReSignings}
        canProceedToDraft={canProceedToDraft}
        canPrepareDraft={canPrepareDraft}
        canProceedToFreeAgency={canProceedToFreeAgency}
        canSimAiFreeAgency={canSimAiFreeAgency}
        canStartNextSeason={canStartNextSeason}
        rosterOverLimit={rosterOverLimit}
        cutsNeeded={cutsNeeded}
        error={error}
        onBeginPlayoffs={beginPlayoffs}
        onBeginOffseason={beginOffseason}
        onCompleteReSignings={completeReSignings}
        onAdvanceToDraft={advanceToDraft}
        onPrepareDraft={prepareDraft}
        onAdvanceToFreeAgency={advanceToFreeAgency}
        onCompleteFreeAgency={completeFreeAgency}
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
        onSimDay={simDay}
        onSimWeek={() => {}}
        onSimSeason={() => {}}
        onSimPlayoffDay={simDay}
        onSimPlayoffs={simulatePlayoffs}
        title="Playoff simulation"
      />

      <PlayoffBracket state={seasonState} userTeamId={userTeamId} />
    </div>
  )
}
