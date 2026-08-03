import type {
  DiagnosticEntry,
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  LifecycleTarget,
  ValidationIssue,
} from "@workspace/domain-v2"

export type WorkerRequest = {
  requestId: string
  command: LeagueCommand
  league: LeagueDocument
}

export type WorkerProgress = {
  completed: number
  total?: number
  label: string
  datesProcessed?: number
  gamesCompleted?: number
  currentDate?: string
}

export type WorkerProgressMessage = {
  type: "progress"
  requestId: string
  commandId: string
  progress: WorkerProgress
  checkpoint: {
    currentDate: string
    completedGames: number
    league: LeagueDocument
  }
}

export type WorkerResult = {
  requestId: string
  status: "completed" | "rejected" | "failed"
  league?: LeagueDocument
  events: LeagueEvent[]
  diagnostics: DiagnosticEntry[]
  progress?: WorkerProgress
  target?: LifecycleTarget
  reason?: ValidationIssue
}
