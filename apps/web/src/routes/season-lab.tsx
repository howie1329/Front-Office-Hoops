import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import {
  simulateDay,
  simulateSeason,
  simulateWeek,
} from "@workspace/sim"
import { GameDetailCard } from "@/components/box-score/GameDetailCard"
import { GameLog } from "@/components/league/GameLog"
import { PlayerSeasonStatsTable } from "@/components/league/PlayerSeasonStatsTable"
import { SchedulePanel } from "@/components/league/SchedulePanel"
import { SimControls } from "@/components/league/SimControls"
import { StandingsTable } from "@/components/league/StandingsTable"
import { getTeamById } from "@/components/league/lib/teamFormat"
import { useLeague } from "@/hooks/useLeague"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/season-lab")({ component: SeasonLabPage })

function SeasonLabPage() {
  const [seed, setSeed] = useState("season-demo")
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const {
    status,
    saveStatus,
    seasonState: state,
    error,
    createNewLeague,
    updateSeasonState,
  } = useLeague()

  async function handleNewSeason() {
    setSelectedGameId(null)
    const baseSeed = seed || "season-demo"
    await createNewLeague(`Season ${baseSeed}`, baseSeed)
  }

  function handleSimDay() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateDay(current))
  }

  function handleSimWeek() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateWeek(current))
  }

  function handleSimSeason() {
    if (!state) {
      return
    }

    updateSeasonState((current) => simulateSeason(current))
  }

  function handleGameClick(gameId: string) {
    setSelectedGameId((current) => (current === gameId ? null : gameId))
  }

  const selectedGame = state?.games.find((game) => game.id === selectedGameId)
  const selectedHomeTeam =
    selectedGame && state ? getTeamById(state, selectedGame.homeTeamId) : undefined
  const selectedAwayTeam =
    selectedGame && state ? getTeamById(state, selectedGame.awayTeamId) : undefined

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Season Lab</h1>
          <p className="text-xs text-muted-foreground">
            Six-team double round-robin: schedule, day/week sim, standings, game
            detail, player stats, and local save.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <SimControls
        state={state}
        status={status}
        saveStatus={saveStatus}
        error={error}
        seed={seed}
        onSeedChange={setSeed}
        onNewSeason={() => void handleNewSeason()}
        onSimDay={handleSimDay}
        onSimWeek={handleSimWeek}
        onSimSeason={handleSimSeason}
        showNewSeason
        description="Generate a 30-game schedule, then simulate by day, week, or full season."
      />

      {state ? (
        <>
          <StandingsTable state={state} />
          <SchedulePanel state={state} showFullScheduleToggle />
          <div className="grid gap-4 lg:grid-cols-2">
            <GameLog
              state={state}
              selectedGameId={selectedGameId}
              onGameClick={handleGameClick}
            />

            {selectedGame && selectedHomeTeam && selectedAwayTeam ? (
              <GameDetailCard
                game={selectedGame}
                homeTeam={selectedHomeTeam}
                awayTeam={selectedAwayTeam}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Game detail</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Select a game from the log to view box scores.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <PlayerSeasonStatsTable state={state} />
        </>
      ) : null}
    </div>
  )
}
