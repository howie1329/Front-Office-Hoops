import type { DiagnosticEntry, ValidationIssue } from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

import type { WorkerResult } from "./protocol"

function rejection(
  request: RuntimeWorkerRequest,
  reason: ValidationIssue,
  diagnostics: DiagnosticEntry[] = []
): WorkerResult {
  return {
    requestId: request.requestId,
    status: "rejected",
    events: [],
    diagnostics,
    reason,
  }
}

function getRequestId(request: unknown): string {
  try {
    return typeof request === "object" &&
      request !== null &&
      "requestId" in request &&
      typeof request.requestId === "string"
      ? request.requestId
      : "unknown-request"
  } catch {
    return "unknown-request"
  }
}

function failure(request: unknown, error: unknown): WorkerResult {
  const message =
    error instanceof Error ? error.message : "Unknown worker error."

  return {
    requestId: getRequestId(request),
    status: "failed",
    events: [],
    diagnostics: [
      {
        code: "worker_command_failed",
        message,
        severity: "error",
      },
    ],
    reason: {
      code: "worker_command_failed",
      message: "The command failed before a new league snapshot was committed.",
    },
  }
}

type RuntimeWorkerRequest = {
  requestId: string
  command: {
    type: string
    commandId: string
  }
  league: unknown
}

function isRuntimeWorkerRequest(
  request: unknown
): request is RuntimeWorkerRequest {
  if (typeof request !== "object" || request === null) {
    return false
  }

  const candidate = request as Record<string, unknown>
  const command = candidate.command

  return (
    typeof candidate.requestId === "string" &&
    candidate.requestId.length > 0 &&
    "league" in candidate &&
    typeof command === "object" &&
    command !== null &&
    typeof (command as Record<string, unknown>).commandId === "string" &&
    ((command as Record<string, unknown>).commandId as string).length > 0 &&
    typeof (command as Record<string, unknown>).type === "string"
  )
}

function isSupportedCommandType(type: string): boolean {
  return type === "NoOp" || type === "AdvanceDay" || type === "SelectUserTeam"
}

function executeValidatedCommand(request: RuntimeWorkerRequest): WorkerResult {
  const validation = validateLeagueDocument(request.league)

  if (!validation.valid) {
    const reason = {
      code: "invalid_league_document",
      message: "The league document failed structural validation.",
      path: validation.issues[0]?.path,
    }

    return rejection(request, reason, [{ ...reason, severity: "error" }])
  }

  switch (request.command.type) {
    case "NoOp":
      return {
        requestId: request.requestId,
        status: "completed",
        league: validation.data,
        events: [],
        diagnostics: [],
      }
    case "AdvanceDay":
      return rejection(request, {
        code: "command_not_implemented",
        message:
          "AdvanceDay is reserved for the lifecycle implementation phase.",
      })
    case "SelectUserTeam": {
      const teamId = (request.command as { teamId?: unknown }).teamId
      if (typeof teamId !== "string" || !teamId) {
        return rejection(request, {
          code: "invalid_team_selection",
          message: "A team must be selected before the league can be entered.",
          path: ["command", "teamId"],
        })
      }

      if (!validation.data.entities.teams[teamId]) {
        return rejection(request, {
          code: "unknown_team_selection",
          message: "The selected team does not exist in this league.",
          path: ["command", "teamId"],
        })
      }

      const now = new Date().toISOString()
      const nextLeague = structuredClone(validation.data)
      nextLeague.state.userTeamId = teamId
      nextLeague.metadata.updatedAt = now
      const event = {
        id: `event:${request.command.commandId}`,
        type: "command.completed" as const,
        season: nextLeague.state.season,
        phase: nextLeague.state.phase,
        leagueDay: nextLeague.state.leagueDay,
        entityRefs: [{ type: "team", id: teamId }],
        payload: { teamId },
        summary: `Selected ${nextLeague.entities.teams[teamId]?.name ?? teamId}.`,
        importance: "major" as const,
        storyTags: ["league-creation", "team-selection"],
        source: {
          kind: "command" as const,
          id: request.command.commandId,
        },
      }
      nextLeague.history.events.push(event)

      return {
        requestId: request.requestId,
        status: "completed",
        league: nextLeague,
        events: [event],
        diagnostics: [],
      }
    }
    default:
      return failure(
        request,
        new Error(`Unsupported worker command type: ${request.command.type}`)
      )
  }
}

export function executeLeagueCommand(request: unknown): WorkerResult {
  try {
    if (!isRuntimeWorkerRequest(request)) {
      return failure(request, new Error("The worker request is malformed."))
    }

    if (!isSupportedCommandType(request.command.type)) {
      return failure(
        request,
        new Error(`Unsupported worker command type: ${request.command.type}`)
      )
    }

    return executeValidatedCommand(request)
  } catch (error) {
    return failure(request, error)
  }
}
