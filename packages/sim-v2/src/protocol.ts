import type {
  DiagnosticEntry,
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  ValidationIssue,
} from "@workspace/domain-v2"

export type WorkerRequest = {
  requestId: string
  command: LeagueCommand
  league: LeagueDocument
}

export type WorkerResult = {
  requestId: string
  status: "completed" | "rejected" | "failed"
  league?: LeagueDocument
  events: LeagueEvent[]
  diagnostics: DiagnosticEntry[]
  progress?: {
    completed: number
    total?: number
    label: string
  }
  reason?: ValidationIssue
}
