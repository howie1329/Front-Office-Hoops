import type {
  GameCoachingProfile,
  GameMatchupFixture,
  GameResult,
  GameRotationInput,
  GameSimulationConfig,
  PlayerAvailability,
  PlayerEntity,
} from "./types"

export type SeasonRunPresetId = "smoke" | "early" | "half" | "full" | "batch"

export type SeasonPopulationKind = "rostered" | "free-agent" | "draft-prospect"

export type ProductionSampleState =
  "provisional" | "early" | "established" | "full"

export type SeasonInjuryMode = "standard" | "off"

export type UniversalPlayerValueConfig = {
  version: 1
  horizonSeasons: number
  currentFormResponsiveness: number
  sampleConfidence: number
  currentAbilityEmphasis: number
  productionEmphasis: number
  trajectoryEmphasis: number
  upsideEmphasis: number
  durabilityImpact: number
  defenseEmphasis: number
  teamContextNormalization: number
}

export type SeasonProductionConfig = {
  version: 1
  presetId: "standard" | "custom"
  runPreset: SeasonRunPresetId
  gamesPerTeam: number
  schedule: {
    teamCount: number
    homeAwayBalanced: boolean
    scheduleSeed: string
  }
  injuries: {
    mode: SeasonInjuryMode
  }
  development: {
    enabled: false
  }
  playoffs: {
    enabled: false
  }
  value: UniversalPlayerValueConfig
}

export type SeasonScheduleEntry = {
  id: string
  round: number
  leagueDay: number
  homeTeamId: string
  awayTeamId: string
}

export type SeasonFixture = {
  version: 1
  source: {
    kind: "initial-player-universe" | "league-document" | "manual"
    id: string
    version: number
  }
  seed: string
  season: number
  teams: Record<string, { id: string; name: string }>
  players: Record<string, PlayerEntity>
  rosters: Record<string, string[]>
  populations: {
    rostered: string[]
    freeAgents: string[]
    draftProspects: string[]
  }
  schedule: SeasonScheduleEntry[]
  rotations: Record<string, GameRotationInput>
  coaching: Record<string, GameCoachingProfile>
  availability: Record<string, PlayerAvailability>
  gameConfig: GameSimulationConfig
  config: SeasonProductionConfig
}

export type SeasonRunStatus = "completed" | "cancelled" | "failed"

export type PlayerSeasonProduction = {
  playerId: string
  teamId: string | null
  population: SeasonPopulationKind
  gamesScheduled: number
  gamesPlayed: number
  starts: number
  minutes: number
  opportunities: number
  usageRate: number
  points: number
  pointsPerGame: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  trueShootingPercentage: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  reboundsPerGame: number
  assists: number
  assistsPerGame: number
  turnovers: number
  turnoversPerGame: number
  steals: number
  blocks: number
  fouls: number
  availabilityRate: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
  role: string
  sampleState: ProductionSampleState
}

export type TeamSeasonProduction = {
  teamId: string
  gamesPlayed: number
  wins: number
  losses: number
  points: number
  opponentPoints: number
  possessions: number
  opponentPossessions: number
  pace: number
  offensiveEfficiency: number
  defensiveEfficiency: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
}

export type LeagueProductionSummary = {
  gamesCompleted: number
  gamesPerTeam: number
  teamCount: number
  pointsPerGame: number
  possessionsPerTeam: number
  offensiveEfficiency: number
  fieldGoalPercentage: number
  threePointPercentage: number
  freeThrowPercentage: number
  threePointAttemptRate: number
  assistsPerTeam: number
  turnoversPerTeam: number
  reboundsPerTeam: number
  injuries: number
  reconciliationPassRate: number
}

export type PlayerValueConfidence =
  "provisional" | "early" | "established" | "full"

export type UniversalPlayerValue = {
  playerId: string
  evaluationPoint: "preseason" | "checkpoint" | "final"
  checkpointGamesPerTeam: number
  rawValue: number
  currentFormSignal: number
  projectionSignal: number
  confidence: PlayerValueConfidence
  sample: {
    games: number
    minutes: number
    seasons: number
  }
  breakdown: {
    currentAbility: number
    recentProduction: number
    projectedContribution: number
    ageTrajectory: number
    upside: number
    durability: number
    opportunity: number
    roleContext: number
    defensiveContribution: number
  }
  diagnostics: {
    percentile: number
    rank: number
    outlierFlags: string[]
  }
}

export type SeasonCheckpointReport = {
  gamesPerTeam: number
  gamesCompleted: number
  playerProduction: Record<string, PlayerSeasonProduction>
  teamProduction: Record<string, TeamSeasonProduction>
  leagueSummary: LeagueProductionSummary
  values: Record<string, UniversalPlayerValue>
}

export type SeasonRunFailure = {
  scheduleEntry: SeasonScheduleEntry
  fixture: GameMatchupFixture
  result: GameResult
}

export type SeasonRunProgress = {
  gamesCompleted: number
  gamesTotal: number
  gamesPerTeam: number
  checkpointGamesPerTeam: number
  label: string
}

export type SeasonRunResult = {
  status: SeasonRunStatus
  fixture: SeasonFixture
  games: GameResult[]
  checkpoints: SeasonCheckpointReport[]
  finalAvailability: Record<string, PlayerAvailability>
  failures: SeasonRunFailure[]
}
