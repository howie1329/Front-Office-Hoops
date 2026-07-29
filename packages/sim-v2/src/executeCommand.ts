import type { DiagnosticEntry, ValidationIssue } from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

import type { WorkerRequest, WorkerResult } from "./protocol"

function rejection(
  request: WorkerRequest,
  reason: ValidationIssue,
  diagnostics: DiagnosticEntry[] = [],
): WorkerResult {
  return {
    requestId: request.requestId,
    status: "rejected",
    events: [],
    diagnostics,
    reason,
  }
}

function failure(request: WorkerRequest, error: unknown): WorkerResult {
  const message = error instanceof Error ? error.message : "Unknown worker error."

  return {
    requestId: request.requestId,
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

function executeValidatedCommand(request: WorkerRequest): WorkerResult {
  const validation = validateLeagueDocument(request.league)

  if (!validation.valid) {
    return rejection(request, {
      code: "invalid_league_document",
      message: "The league document failed structural validation.",
      path: validation.issues[0]?.path,
    })
  }

  switch (request.command.type) {
    case "NoOp":
      return {
        requestId: request.requestId,
        status: "completed",
        league: request.league,
        events: [],
        diagnostics: [],
      }
    case "AdvanceDay":
      return rejection(request, {
        code: "command_not_implemented",
        message: "AdvanceDay is reserved for the lifecycle implementation phase.",
      })
  }
}

export function executeLeagueCommand(request: WorkerRequest): WorkerResult {
  try {
    return executeValidatedCommand(request)
  } catch (error) {
    return failure(request, error)
  }
}
