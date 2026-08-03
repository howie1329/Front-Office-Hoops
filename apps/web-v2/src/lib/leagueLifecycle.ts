import * as React from "react"

import type {
  GameRotationInput,
  LeagueCommand,
  LeagueDocument,
} from "@workspace/domain-v2"
import type { V2LeagueRepository } from "@workspace/db-v2"
import type { WorkerRequest, WorkerResult } from "@workspace/sim-v2"
import { getLifecycleActionState } from "@workspace/sim-v2"

import { runLeagueCommand } from "./leagueWorker"
import type { RunLeagueCommandOptions } from "./leagueWorker"

export async function runAndCommitLeagueCommand(
  request: WorkerRequest,
  repository: V2LeagueRepository,
  options?: RunLeagueCommandOptions
): Promise<WorkerResult> {
  const result = await runLeagueCommand(request, options)
  if (result.status === "completed" && result.league) {
    await repository.save(result.league)
  }
  return result
}

export function useLeagueSimulation({
  league,
  repository,
  setLeague,
}: {
  league: LeagueDocument | null
  repository: V2LeagueRepository
  setLeague: React.Dispatch<React.SetStateAction<LeagueDocument | null>>
}) {
  const [isSimulating, setIsSimulating] = React.useState(false)
  const [simulationError, setSimulationError] = React.useState<string | null>(
    null
  )

  const runCommand = React.useCallback(
    async (command: LeagueCommand): Promise<boolean> => {
      if (!league || isSimulating) return false

      setIsSimulating(true)
      setSimulationError(null)

      try {
        const result = await runAndCommitLeagueCommand(
          {
            requestId: `request:${crypto.randomUUID()}`,
            command,
            league,
          },
          repository
        )

        if (result.status !== "completed" || !result.league) {
          setSimulationError(
            result.reason?.message ??
              "The league command could not be completed."
          )
          return false
        }

        setLeague(result.league)
        return true
      } catch (caughtError) {
        setSimulationError(
          caughtError instanceof Error
            ? caughtError.message
            : "The league command could not be completed."
        )
        return false
      } finally {
        setIsSimulating(false)
      }
    },
    [isSimulating, league, repository, setLeague]
  )

  const handleAdvanceDay = React.useCallback(async () => {
    if (!league || isSimulating) return

    const action = getLifecycleActionState(league, "advance-day")
    if (!action.enabled) return

    await runCommand({
      type: "AdvanceDay",
      commandId: `command:advance-day:${crypto.randomUUID()}`,
    })
  }, [isSimulating, league, runCommand])

  const handleReleasePlayer = React.useCallback(
    (teamId: string, playerId: string) =>
      runCommand({
        type: "ReleasePlayer",
        commandId: `command:release-player:${crypto.randomUUID()}`,
        teamId,
        playerId,
      }),
    [runCommand]
  )

  const handleSetRotation = React.useCallback(
    (teamId: string, rotation: GameRotationInput) =>
      runCommand({
        type: "SetRotation",
        commandId: `command:set-rotation:${crypto.randomUUID()}`,
        teamId,
        rotation,
      }),
    [runCommand]
  )

  return {
    handleAdvanceDay,
    handleReleasePlayer,
    handleSetRotation,
    isSimulating,
    simulationError,
  }
}
