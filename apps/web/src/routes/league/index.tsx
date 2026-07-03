import { createFileRoute } from "@tanstack/react-router"
import { simulateDay, simulateSeason, simulateWeek } from "@workspace/sim"

import { GameLog } from "@/components/league/GameLog"
import { SchedulePanel } from "@/components/league/SchedulePanel"
import { SeasonPhaseCard } from "@/components/league/SeasonPhaseCard"
import { SimControls } from "@/components/league/SimControls"
import { StandingsTable } from "@/components/league/StandingsTable"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/")({
  component: LeagueDashboardPage,
})

function LeagueDashboardPage() {
  const {
    league,
    seasonState,
    status,
    saveStatus,
    error,
    myTeam,
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
    updateSeasonState,
  } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  const isMiniLeague = seasonState.teams.length < LEAGUE_TEAM_COUNT

  function handleSimDay() {
    updateSeasonState((current) => simulateDay(current))
  }

  function handleSimWeek() {
    updateSeasonState((current) => simulateWeek(current))
  }

  function handleSimSeason() {
    updateSeasonState((current) => simulateSeason(current))
  }

  return (
    <div className="flex flex-col gap-4">
      {isMiniLeague ? (
        <Card>
          <CardHeader>
            <CardTitle>6-team save detected</CardTitle>
            <CardDescription>
              This save uses the mini league format. Create a new 30-team league
              from the home page for the full product experience.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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

      {myTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>{myTeam.name}</CardTitle>
            <CardDescription>
              {myTeam.abbrev} · {myTeam.overall} OVR · Day {seasonState.currentDay}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <SimControls
        state={seasonState}
        phase={phase}
        status={status}
        saveStatus={saveStatus}
        error={error}
        seed={league?.name ?? ""}
        onSeedChange={() => {}}
        onSimDay={handleSimDay}
        onSimWeek={handleSimWeek}
        onSimSeason={handleSimSeason}
        onSimPlayoffDay={handleSimDay}
        onSimPlayoffs={simulatePlayoffs}
        title="Simulation"
        description={`Advance ${league?.name ?? "your league"} by day, week, or full season.`}
      />

      {phase === "regular" ? (
        <>
          <StandingsTable state={seasonState} />
          <SchedulePanel state={seasonState} />
          <GameLog
            state={seasonState}
            getGameHref={(gameId) => `/league/games/${gameId}`}
          />
        </>
      ) : null}
    </div>
  )
}
