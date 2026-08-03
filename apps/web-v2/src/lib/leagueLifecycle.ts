import * as React from "react"

import type {
  GameRotationInput,
  LeagueCommand,
  LeagueDocument,
} from "@workspace/domain-v2"
import type { V2LeagueRepository } from "@workspace/db-v2"
import type {
  WorkerProgressMessage,
  WorkerRequest,
  WorkerResult,
} from "@workspace/sim-v2"
import { getLifecycleActionState } from "@workspace/sim-v2"

import { runLeagueCommand } from "./leagueWorker"
import type { RunLeagueCommandOptions } from "./leagueWorker"

export async function runAndCommitLeagueCommand(
  request: WorkerRequest,
  repository: V2LeagueRepository,
  options?: RunLeagueCommandOptions
): Promise<WorkerResult> {
  let checkpointWrite = Promise.resolve()
  const result = await runLeagueCommand(request, {
    ...options,
    onProgress: (message: WorkerProgressMessage) => {
      checkpointWrite = checkpointWrite
        .then(() =>
          repository.saveCheckpoint({
            id: `${request.league.metadata.id}:${request.command.commandId}`,
            leagueId: request.league.metadata.id,
            commandId: request.command.commandId,
            currentDate: message.checkpoint.currentDate,
            completedGames: message.checkpoint.completedGames,
            createdAt: new Date().toISOString(),
            league: message.checkpoint.league,
          })
        )
        .catch(() => undefined)
      options?.onProgress?.(message)
    },
  })
  if (result.status === "completed" && result.league) {
    await checkpointWrite
    await repository.save(result.league)
    await repository.removeCheckpoint(
      request.league.metadata.id,
      request.command.commandId
    )
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
  const [simulationProgress, setSimulationProgress] =
    React.useState<WorkerResult["progress"]>(undefined)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const runCommand = React.useCallback(
    async (command: LeagueCommand): Promise<boolean> => {
      if (!league || isSimulating) return false

      setIsSimulating(true)
      setSimulationError(null)
      setSimulationProgress(undefined)
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const result = await runAndCommitLeagueCommand(
          {
            requestId: `request:${crypto.randomUUID()}`,
            command,
            league,
          },
          repository,
          {
            signal: abortController.signal,
            onProgress: (message) => setSimulationProgress(message.progress),
          }
        )

        if (result.status !== "completed" || !result.league) {
          setSimulationError(
            result.reason?.message ??
              "The league command could not be completed."
          )
          return false
        }

        setSimulationProgress(result.progress)
        setLeague(result.league)
        return true
      } catch (caughtError) {
        setSimulationError(
          caughtError instanceof DOMException &&
            caughtError.name === "AbortError"
            ? "Simulation cancelled. The last committed league snapshot is unchanged."
            : caughtError instanceof Error
              ? caughtError.message
              : "The league command could not be completed."
        )
        return false
      } finally {
        abortControllerRef.current = null
        setIsSimulating(false)
      }
    },
    [isSimulating, league, repository, setLeague]
  )

  const cancelSimulation = React.useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleAdvanceDay = React.useCallback(async () => {
    if (!league || isSimulating) return

    const action = getLifecycleActionState(league, "advance-day")
    if (!action.enabled) return

    await runCommand({
      type: "AdvanceDay",
      commandId: `command:advance-day:${crypto.randomUUID()}`,
    })
  }, [isSimulating, league, runCommand])

  const handleSimulateToNextGame = React.useCallback(async () => {
    if (!league || isSimulating) return false
    if (!getLifecycleActionState(league, "next-game").enabled) return false
    return runCommand({
      type: "SimulateToNextGame",
      commandId: `command:simulate-next-game:${crypto.randomUUID()}`,
    })
  }, [isSimulating, league, runCommand])

  const handleSimulateToNextKeyDate = React.useCallback(async () => {
    if (!league || isSimulating) return false
    if (!getLifecycleActionState(league, "next-key-date").enabled) return false
    return runCommand({
      type: "SimulateToNextKeyDate",
      commandId: `command:simulate-next-key-date:${crypto.randomUUID()}`,
    })
  }, [isSimulating, league, runCommand])

  const handleSimulateToDate = React.useCallback(
    async (targetDate: string) => {
      if (!league || isSimulating || !targetDate) return false
      if (targetDate < league.state.calendar.currentDate) return false
      if (targetDate > league.state.calendar.regularSeasonEnd) return false
      return runCommand({
        type: "SimulateToDate",
        commandId: `command:simulate-to-date:${crypto.randomUUID()}`,
        targetDate,
      })
    },
    [isSimulating, league, runCommand]
  )

  const handleSimulateToDeadline = React.useCallback(async () => {
    if (!league || isSimulating) return false
    if (!getLifecycleActionState(league, "simulate-to-deadline").enabled)
      return false
    return runCommand({
      type: "SimulateToDeadline",
      commandId: `command:simulate-deadline:${crypto.randomUUID()}`,
    })
  }, [isSimulating, league, runCommand])

  const handleSimulateToRegularSeasonEnd = React.useCallback(async () => {
    if (!league || isSimulating) return false
    if (!getLifecycleActionState(league, "simulate-to-season-end").enabled)
      return false
    return runCommand({
      type: "SimulateToRegularSeasonEnd",
      commandId: `command:simulate-season-end:${crypto.randomUUID()}`,
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
    handleSimulateToDeadline,
    handleSimulateToDate,
    handleSimulateToNextGame,
    handleSimulateToNextKeyDate,
    handleSimulateToRegularSeasonEnd,
    handleReleasePlayer,
    handleSetRotation,
    cancelSimulation,
    isSimulating,
    simulationError,
    simulationProgress,
  }
}
