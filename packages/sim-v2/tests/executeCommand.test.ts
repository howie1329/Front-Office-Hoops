import { describe, expect, it } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"

import { executeLeagueCommand } from "../src"

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

  it("rejects malformed league documents", () => {
    const result = executeLeagueCommand({
      requestId: "request-3",
      command: { type: "NoOp", commandId: "command-3" },
      league: {} as never,
    })

    expect(result.status).toBe("rejected")
    expect(result.reason?.code).toBe("invalid_league_document")
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
