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
  return type === "NoOp" || type === "AdvanceDay"
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
