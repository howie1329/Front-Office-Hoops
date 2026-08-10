import { describe, expect, it } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

import {
  createLeague,
  createStandardGameSimulationConfig,
  executeLeagueCommand,
} from "../src"

describe("executeLeagueCommand", () => {
  it("round-trips a no-op command without changing facts", () => {
    const league = createFoundationLeague()
    const result = executeLeagueCommand({
      requestId: "request-1",
      command: { type: "NoOp", commandId: "command-1" },
      league,
    })

    expect(result).toMatchObject({
      requestId: "request-1",
      status: "completed",
      league,
      events: [],
    })
  })

  it("rejects lifecycle commands outside the regular-season phase", () => {
    const result = executeLeagueCommand({
      requestId: "request-2",
      command: { type: "AdvanceDay", commandId: "command-2" },
      league: createFoundationLeague(),
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("phase_command_blocked")
  })

  it("advances the current calendar day through the game simulation", () => {
    const league = createLeague({
      id: "league-advance-day",
      name: "Advance Day League",
      seed: "advance-day-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document

    const result = executeLeagueCommand({
      requestId: "request-advance-day",
      command: { type: "AdvanceDay", commandId: "command-advance-day" },
      league,
    })

    expect(result.status).toBe("completed")
    expect(result.league).toBeDefined()
    expect(result.progress?.completed).toBeGreaterThan(0)
    expect(result.league?.state.calendar.currentDate).toBe("2026-10-22")
    expect(result.league?.state.leagueDay).toBe(1)
    expect(result.league?.optionalData?.games).toHaveLength(
      result.progress?.completed ?? 0
    )
    expect(
      result.league?.history.events.some(
        (event) => event.type === "game.completed"
      )
    ).toBe(true)
    expect(validateLeagueDocument(result.league)).toMatchObject({ valid: true })
  })

  it("uses the saved custom game config during lifecycle simulation", () => {
    const gameConfig = createStandardGameSimulationConfig()
    gameConfig.presetId = "custom"
    gameConfig.injuries.frequency = "off"
    gameConfig.injuries.inGameInjuries = false
    gameConfig.overtime.enabled = false

    const league = createLeague({
      id: "league-custom-runtime-settings",
      name: "Custom Runtime Settings League",
      seed: "custom-runtime-settings-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
      gameConfig,
    }).document

    const result = executeLeagueCommand({
      requestId: "request-custom-runtime-settings",
      command: {
        type: "AdvanceDay",
        commandId: "command-custom-runtime-settings",
      },
      league,
    })

    expect(result.status).toBe("completed")
    expect(result.league?.settings.gameConfig).toEqual(gameConfig)
    expect(
      result.events.some((event) => event.type === "injury.recorded")
    ).toBe(false)
    expect(validateLeagueDocument(result.league)).toMatchObject({ valid: true })
  })

  it("advances a calendar date even when no games are scheduled", () => {
    const league = createLeague({
      id: "league-empty-date",
      name: "Empty Date League",
      seed: "empty-date-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const gapLeague = structuredClone(league)
    gapLeague.state.calendar.schedule = gapLeague.state.calendar.schedule.map(
      (entry) =>
        entry.kind === "regular-season" && entry.date === "2026-10-21"
          ? { ...entry, date: "2026-10-22" }
          : entry
    )

    const result = executeLeagueCommand({
      requestId: "request-empty-date",
      command: { type: "AdvanceDay", commandId: "command-empty-date" },
      league: gapLeague,
    })

    expect(result.status).toBe("completed")
    expect(result.progress).toMatchObject({ completed: 0, total: 0 })
    expect(result.league?.state.calendar.currentDate).toBe("2026-10-22")
  })

  it("records the selected team on a generated league", () => {
    const league = createLeague({
      id: "league-selection",
      name: "Selection League",
      seed: "selection-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document

    const result = executeLeagueCommand({
      requestId: "request-selection",
      command: {
        type: "SelectUserTeam",
        commandId: "command-selection",
        teamId: "team:01",
      },
      league,
    })

    expect(result).toMatchObject({
      status: "completed",
      league: {
        state: { userTeamId: "team:01" },
      },
    })
    expect(result.events[0]).toMatchObject({
      type: "command.completed",
      entityRefs: [{ type: "team", id: "team:01" }],
    })
  })

  it("persists a valid team rotation", () => {
    const league = createLeague({
      id: "league-rotation",
      name: "Rotation League",
      seed: "rotation-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const teamId = "team:01"
    const currentRotation = league.state.rotations?.[teamId]
    expect(currentRotation).toBeDefined()

    const rotation = structuredClone(currentRotation!)
    const firstBenchPlayer = rotation.depthOrder.find(
      (playerId) => !rotation.starters.includes(playerId)
    )!
    rotation.targetMinutes[firstBenchPlayer] = 18
    rotation.targetMinutes[rotation.starters[0]!] = 30

    const result = executeLeagueCommand({
      requestId: "request-rotation",
      command: {
        type: "SetRotation",
        commandId: "command-rotation",
        teamId,
        rotation,
      },
      league,
    })

    expect(result.status).toBe("completed")
    expect(result.league?.state.rotations?.[teamId]).toEqual(rotation)
    expect(result.events[0]).toMatchObject({
      type: "command.completed",
      entityRefs: [{ type: "team", id: teamId }],
    })
    expect(validateLeagueDocument(result.league)).toMatchObject({
      valid: true,
    })
  })

  it("rejects a rotation with an invalid starter count", () => {
    const league = createLeague({
      id: "league-invalid-rotation",
      name: "Invalid Rotation League",
      seed: "invalid-rotation-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const rotation = structuredClone(league.state.rotations?.["team:01"]!)
    rotation.starters.pop()

    const result = executeLeagueCommand({
      requestId: "request-invalid-rotation",
      command: {
        type: "SetRotation",
        commandId: "command-invalid-rotation",
        teamId: "team:01",
        rotation,
      },
      league,
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("invalid_starter_count")
  })

  it("simulates the selected team's next game through the shared runner", () => {
    const league = createLeague({
      id: "league-next-game",
      name: "Next Game League",
      seed: "selection-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const selected = executeLeagueCommand({
      requestId: "request-next-game-select",
      command: {
        type: "SelectUserTeam",
        commandId: "command-next-game-select",
        teamId: "team:01",
      },
      league,
    })
    expect(selected.status).toBe("completed")

    const result = executeLeagueCommand({
      requestId: "request-next-game",
      command: {
        type: "SimulateToNextGame",
        commandId: "command-next-game",
      },
      league: selected.league!,
    })

    expect(result.status).toBe("completed")
    expect(result.target).toMatchObject({
      kind: "next-game",
      teamId: "team:01",
    })
    expect(result.progress?.datesProcessed).toBeGreaterThan(0)
    expect(result.progress?.gamesCompleted).toBeGreaterThan(0)
    expect(result.league?.optionalData?.games).toHaveLength(
      result.progress?.gamesCompleted ?? 0
    )
    expect(result.league?.projections.currentSeason?.gamesCompleted).toBe(
      result.progress?.gamesCompleted
    )
    expect(result.league?.state.calendar.currentDate).toBe("2026-10-22")
    expect(validateLeagueDocument(result.league)).toMatchObject({ valid: true })
  })

  it("rejects selected-team rotation edits outside the 240-minute contract", () => {
    const league = createLeague({
      id: "league-rotation-contract",
      name: "Rotation Contract League",
      seed: "rotation-contract-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const selected = executeLeagueCommand({
      requestId: "request-rotation-contract-select",
      command: {
        type: "SelectUserTeam",
        commandId: "command-rotation-contract-select",
        teamId: "team:01",
      },
      league,
    })
    const rotation = structuredClone(
      selected.league?.state.rotations?.["team:01"]!
    )
    rotation.targetMinutes[rotation.starters[0]!] += 1

    const result = executeLeagueCommand({
      requestId: "request-rotation-contract",
      command: {
        type: "SetRotation",
        commandId: "command-rotation-contract",
        teamId: "team:01",
        rotation,
      },
      league: selected.league!,
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("invalid_rotation_minutes_total")
  })

  it("simulates selected dates without overshooting and emits recovery checkpoints", () => {
    const league = createLeague({
      id: "league-target-date",
      name: "Target Date League",
      seed: "selection-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const checkpoints: Array<{
      currentDate: string
      completedGames: number
    }> = []

    const result = executeLeagueCommand(
      {
        requestId: "request-target-date",
        command: {
          type: "SimulateToDate",
          commandId: "command-target-date",
          targetDate: "2026-10-22",
        },
        league,
      },
      {
        onProgress: (message) => {
          checkpoints.push({
            currentDate: message.checkpoint.currentDate,
            completedGames: message.checkpoint.completedGames,
          })
        },
      }
    )

    expect(result.status).toBe("completed")
    expect(result.target).toEqual({ kind: "date", date: "2026-10-22" })
    expect(result.league?.state.calendar.currentDate).toBe("2026-10-23")
    expect(checkpoints).toHaveLength(2)
    expect(checkpoints.at(-1)?.currentDate).toBe("2026-10-23")
    expect(result.progress?.datesProcessed).toBe(2)
    expect(validateLeagueDocument(result.league)).toMatchObject({ valid: true })
  })

  it("rejects malformed league documents", () => {
    const result = executeLeagueCommand({
      requestId: "request-3",
      command: { type: "NoOp", commandId: "command-3" },
      league: {} as never,
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("invalid_league_document")
    expect(result.diagnostics[0]).toMatchObject({
      code: result.reason?.code,
      message: result.reason?.message,
      path: result.reason?.path,
      severity: "error",
    })
  })

  it("returns structured failures for malformed requests and unknown commands", () => {
    const malformed = executeLeagueCommand(null)
    const unknownCommand = executeLeagueCommand({
      requestId: "request-unknown",
      command: { type: "Unexpected", commandId: "command-unknown" },
      league: createFoundationLeague(),
    })

    expect(malformed).toMatchObject({
      requestId: "unknown-request",
      status: "failed",
    })
    expect(unknownCommand).toMatchObject({
      requestId: "request-unknown",
      status: "failed",
    })
    expect(unknownCommand.diagnostics[0]?.message).toContain(
      "Unsupported worker command type"
    )
  })

  it("returns a structured failure when command execution throws", () => {
    const request = {
      requestId: "request-4",
      get command(): never {
        throw new Error("simulated interruption")
      },
      league: createFoundationLeague(),
    }

    const result = executeLeagueCommand(request as never)

    expect(result).toMatchObject({
      requestId: "request-4",
      status: "failed",
      reason: {
        code: "worker_command_failed",
      },
    })
    expect(result.league).toBeUndefined()
    expect(result.diagnostics[0]?.message).toBe("simulated interruption")
  })
})
