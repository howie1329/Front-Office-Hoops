export type JsonRecord = Record<string, unknown>

export type LeaguePhase = "foundation"

export type RandomMode = "normal" | "deterministic-lab"

export type SimulationConfig = {
  presetId: string
  version: number
}

export type PhaseTaskState = {
  id: string
  label: string
  status: "pending" | "completed" | "blocked"
}

export type TeamEntity = {
  id: string
  name: string
}

export type PlayerEntity = {
  id: string
  name: string
}

export type LeagueEventType = "command.completed" | "migration.applied"

export type LeagueEvent = {
  id: string
  type: LeagueEventType
  season: number
  phase: LeaguePhase
  leagueDay: number
  entityRefs: Array<{ type: string; id: string }>
  payload: JsonRecord
  summary: string
  importance: "routine" | "notable" | "major"
  storyTags: string[]
  source: {
    kind: "command" | "simulation" | "migration"
    id: string
  }
}

export type LeagueDocument = {
  schema: {
    name: "foh-league"
    version: number
    rulesVersion: number
  }
  metadata: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
  settings: {
    standardPresetId: string
    resolvedConfig: SimulationConfig
    advancedOverrides: JsonRecord
  }
  randomness: {
    mode: RandomMode
    createdWithEntropy: boolean
    debugScopes?: Record<string, string>
  }
  state: {
    season: number
    phase: LeaguePhase
    leagueDay: number
    userTeamId: string | null
    calendar: {
      kind: "foundation"
    }
    phaseTasks: PhaseTaskState[]
  }
  entities: {
    teams: Record<string, TeamEntity>
    players: Record<string, PlayerEntity>
    owners: Record<string, JsonRecord>
    staff: Record<string, JsonRecord>
    contracts: Record<string, JsonRecord>
    draftAssets: Record<string, JsonRecord>
    offers: Record<string, JsonRecord>
  }
  projections: {
    standings: JsonRecord[]
    payroll: JsonRecord[]
  }
  history: {
    events: LeagueEvent[]
    seasonArchives: JsonRecord[]
    records: JsonRecord[]
  }
  optionalData?: {
    games?: JsonRecord[]
    playerGameLogs?: JsonRecord[]
    labDiagnostics?: JsonRecord[]
    scoutingDiagnostics?: JsonRecord[]
  }
}

export type LeagueCommand =
  | {
      type: "NoOp"
      commandId: string
    }
  | {
      type: "AdvanceDay"
      commandId: string
    }

export type ValidationIssue = {
  code: string
  message: string
  path?: Array<string | number>
}

export type DiagnosticEntry = {
  code: string
  message: string
  severity: "info" | "warning" | "error"
  path?: Array<string | number>
}
