import { describe, expect, it } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"

import { createLeague, executeLeagueCommand } from "../src"

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

  it("rejects commands that are outside the foundation slice", () => {
    const result = executeLeagueCommand({
      requestId: "request-2",
      command: { type: "AdvanceDay", commandId: "command-2" },
      league: createFoundationLeague(),
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("command_not_implemented")
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
