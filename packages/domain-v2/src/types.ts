export type JsonRecord = Record<string, unknown>

export type LeaguePhase = "foundation"

export type RandomMode = "normal" | "deterministic-lab"

export type SimulationConfig = {
  presetId: string
  version: number
}

export type GameSimulationPresetId = "standard" | "custom"

export type GameInjuryFrequency = "off" | "rare" | "normal" | "frequent"

export type GameInjurySeverity = "minor" | "mixed"

export type GameSimulationConfig = {
  version: number
  presetId: GameSimulationPresetId
  environment: {
    pace: number
    scoringEnvironment: number
    gameVariance: number
    talentSeparation: number
    homeCourtAdvantage: number
  }
  offense: {
    threePointRate: number
    rimRate: number
    midrangeRate: number
    shotSelectionDiscipline: number
    starUsage: number
    ballMovement: number
    isolationRate: number
    transitionRate: number
    offensiveRebounding: number
  }
  defense: {
    pressure: number
    helpDefense: number
    switching: number
    doubleTeamRate: number
    turnoverPressure: number
    foulDiscipline: number
  }
  rotation: {
    adherence: number
    benchUsage: number
    starterWorkload: number
    fatigueImpact: number
  }
  coaching: {
    influence: number
    paceInfluence: number
    shotSelectionInfluence: number
    defensiveInfluence: number
  }
  injuries: {
    frequency: GameInjuryFrequency
    severity: GameInjurySeverity
    maxGamesOut: number
    inGameInjuries: boolean
  }
  overtime: {
    enabled: boolean
    segmentMinutes: number
    maxSegments: number
  }
}

export type GameTeamRef = {
  id: string
  name: string
}

export type GameRotationInput = {
  starters: string[]
  depthOrder: string[]
  targetMinutes: Record<string, number>
}

export type PlayerAvailability = {
  available: boolean
  gamesRemaining: number
  restriction?: "none" | "minutes-limited"
  minutesLimit?: number
}

export type GameCoachingProfile = {
  pace: number
  offensiveStyle: number
  defensivePressure: number
  shotSelection: number
  rotationDepth: number
}

export type GameMatchupFixture = {
  version: number
  source: {
    kind: "initial-player-universe" | "league-document" | "manual"
    id: string
    version: number
  }
  seed: string
  homeTeamId: string
  awayTeamId: string
  teams: Record<string, GameTeamRef>
  players: Record<string, PlayerEntity>
  rotations: Record<string, GameRotationInput>
  availability: Record<string, PlayerAvailability>
  coaching: Record<string, GameCoachingProfile>
  config: GameSimulationConfig
}

export type GamePeriodKind = "regulation" | "overtime"

export type GamePeriodResult = {
  number: number
  kind: GamePeriodKind
  minutes: number
  teamPoints: Record<string, number>
  teamPossessions: Record<string, number>
}

export type GamePlayerBoxScore = {
  playerId: string
  teamId: string
  starter: boolean
  minutes: number
  opportunities: number
  usageRate: number
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
  role: {
    label: string
    creationShare: number
    scoringShare: number
  }
  availability: PlayerAvailability
}

export type GameTeamBoxScore = {
  teamId: string
  points: number
  possessions: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
  pace: number
  offensiveEfficiency: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
}

export type GameEvent = {
  id: string
  type: "injury"
  teamId: string
  playerId: string
  period: number
  description: string
  gamesRemaining: number
}

export type GameLineupSegment = {
  id: string
  teamId: string
  period: number
  startMinute: number
  endMinute: number
  playerIds: string[]
  reason: "period-start" | "checkpoint" | "foul-trouble" | "injury" | "overtime"
}

export type GameReconciliationCheck = {
  code: string
  label: string
  passed: boolean
  actual: number
  expected: number
  difference: number
}

export type GameReconciliationReport = {
  passed: boolean
  checks: GameReconciliationCheck[]
}

export type GameDiagnostic = DiagnosticEntry & {
  scope: "fixture" | "rotation" | "possession" | "box-score" | "injury"
}

export type GameResult = {
  version: number
  seed: string
  status: "completed" | "rejected" | "failed"
  homeTeamId: string
  awayTeamId: string
  winnerTeamId: string | null
  periods: GamePeriodResult[]
  teams: Record<string, GameTeamBoxScore>
  players: Record<string, GamePlayerBoxScore>
  lineupSegments: GameLineupSegment[]
  events: GameEvent[]
  diagnostics: GameDiagnostic[]
  reconciliation: GameReconciliationReport
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

export type PlayerTrait = string

export type PlayerIdentity = {
  firstName: string | null
  lastName: string | null
}

export type PlayerLeagueStatus =
  | { kind: "unassigned" }
  | { kind: "rostered"; teamId: string }
  | { kind: "re-signing"; teamId: string }
  | { kind: "free-agent" }
  | { kind: "draft-prospect"; draftClassId: string }
  | { kind: "retired" }

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C"

export type PlayerArchetype =
  | "lead_guard"
  | "scoring_guard"
  | "defensive_guard"
  | "combo_guard"
  | "shooting_wing"
  | "three_and_d_wing"
  | "slashing_wing"
  | "point_forward"
  | "utility_wing"
  | "stretch_big"
  | "interior_scorer"
  | "rim_protector"
  | "rebounding_big"
  | "utility_big"

export type PhysicalProfile = {
  heightInches: number
  weightPounds: number
  wingspanInches: number
  speed: number
  strength: number
  vertical: number
}

export type PlayerSkills = {
  shooting: number
  finishing: number
  passing: number
  handling: number
  rebounding: number
  defense: number
  basketballIQ: number
  stamina: number
}

export type PlayerSkillKey = keyof PlayerSkills

export type NumericRange = {
  min: number
  max: number
}

export type DistributionConfig = {
  center: number
  spread: number
  shape: "long-tailed"
}

export type PotentialHeadroomConfig = DistributionConfig & {
  maxHeadroom: number
}

export type SkillCorrelation = {
  first: PlayerSkillKey
  second: PlayerSkillKey
  strength: number
}

export type PlayerGenerationConfig = {
  version: number
  age: NumericRange
  ratingBounds: NumericRange
  talentDistribution: DistributionConfig
  starTailFrequency: {
    above70: number
    above80: number
    above90: number
  }
  physical: {
    heightInches: NumericRange
    weightPounds: NumericRange
    wingspanInches: NumericRange
    speed: NumericRange
    strength: NumericRange
    vertical: NumericRange
  }
  development: {
    potential: PotentialHeadroomConfig
    rating: DistributionConfig
    volatility: DistributionConfig
  }
  classification: {
    minPositionFit: number
    maxSecondaryPositionGap: number
    minArchetypeFit: number
    minSecondaryArchetypeFit: number
    maxSecondaryArchetypeGap: number
  }
  traitFrequency: number
  availableTraits: PlayerTrait[]
  skillCorrelations: SkillCorrelation[]
}

export type PlayerPopulationContextKind =
  "lab" | "initial-league" | "draft-class" | "free-agent-pool"

export type PlayerPopulationPresetId =
  "initial-roster" | "initial-free-agents" | "draft-class"

export type PlayerPopulationPreset = {
  version: 1
  id: PlayerPopulationPresetId
  label: string
  defaultCount: number
  contextKind: PlayerPopulationContextKind
  config: PlayerGenerationConfig
}

export type CareerDevelopmentProfile = {
  potential: number
  rating: number
  volatility: number
  peakAge: number
  declineStartAge: number
}

export type DevelopmentProfile = CareerDevelopmentProfile

export type PlayerRoleProfile = {
  primaryPosition: PlayerPosition
  secondaryPosition: PlayerPosition | null
  primaryArchetype: PlayerArchetype
  secondaryArchetype: PlayerArchetype | null
}

export type PlayerProfile = {
  physical: PhysicalProfile
  skills: PlayerSkills
  role: PlayerRoleProfile
  injuryResistance: number
  development: DevelopmentProfile
  traits: PlayerTrait[]
}

export type PlayerEntity = {
  id: string
  identity: PlayerIdentity
  leagueStatus: PlayerLeagueStatus
  age: number
  profile: PlayerProfile
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
