import { z } from "zod"

import { CURRENT_SCHEMA_VERSION } from "./version"

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)
const jsonRecordSchema = z.record(z.string(), jsonValueSchema)
const ratingSchema = z.number().int().min(0).max(100)
const numericRangeSchema = z
  .strictObject({ min: z.number(), max: z.number() })
  .refine((range) => range.min <= range.max, {
    message: "The minimum must not exceed the maximum.",
  })

const distributionConfigSchema = z.strictObject({
  center: z.number(),
  spread: z.number().nonnegative(),
  shape: z.literal("long-tailed"),
})

const potentialHeadroomConfigSchema = distributionConfigSchema
  .extend({
    maxHeadroom: z.number().int().nonnegative(),
  })
  .refine((config) => config.center <= config.maxHeadroom, {
    message: "Potential headroom center must not exceed its maximum.",
  })

const classificationConfigSchema = z.strictObject({
  minPositionFit: z.number().int().min(0).max(100),
  maxSecondaryPositionGap: z.number().int().min(0).max(100),
  minArchetypeFit: z.number().int().min(0).max(100),
  minSecondaryArchetypeFit: z.number().int().min(0).max(100),
  maxSecondaryArchetypeGap: z.number().int().min(0).max(100),
})

export const playerGenerationConfigSchema = z.strictObject({
  version: z.number().int().positive(),
  age: numericRangeSchema,
  ratingBounds: numericRangeSchema,
  talentDistribution: distributionConfigSchema,
  starTailFrequency: z.strictObject({
    above70: z.number().min(0).max(1),
    above80: z.number().min(0).max(1),
    above90: z.number().min(0).max(1),
  }),
  physical: z.strictObject({
    heightInches: numericRangeSchema,
    weightPounds: numericRangeSchema,
    wingspanInches: numericRangeSchema,
    speed: numericRangeSchema,
    strength: numericRangeSchema,
    vertical: numericRangeSchema,
  }),
  development: z.strictObject({
    potential: potentialHeadroomConfigSchema,
    rating: distributionConfigSchema,
    volatility: distributionConfigSchema,
  }),
  classification: classificationConfigSchema,
  traitFrequency: z.number().min(0).max(1),
  availableTraits: z.array(z.string().min(1)),
  skillCorrelations: z.array(
    z.strictObject({
      first: z.enum([
        "shooting",
        "finishing",
        "passing",
        "handling",
        "rebounding",
        "defense",
        "basketballIQ",
        "stamina",
      ]),
      second: z.enum([
        "shooting",
        "finishing",
        "passing",
        "handling",
        "rebounding",
        "defense",
        "basketballIQ",
        "stamina",
      ]),
      strength: z.number().min(-1).max(1),
    })
  ),
})

const physicalProfileSchema = z.strictObject({
  heightInches: z.number().int().min(48).max(96),
  weightPounds: z.number().int().min(80).max(500),
  wingspanInches: z.number().int().min(48).max(110),
  speed: ratingSchema,
  strength: ratingSchema,
  vertical: ratingSchema,
})

const playerSkillsSchema = z.strictObject({
  shooting: z.number().min(0).max(100),
  finishing: z.number().min(0).max(100),
  passing: z.number().min(0).max(100),
  handling: z.number().min(0).max(100),
  rebounding: z.number().min(0).max(100),
  defense: z.number().min(0).max(100),
  basketballIQ: z.number().min(0).max(100),
  stamina: z.number().min(0).max(100),
})

const playerRoleSchema = z.strictObject({
  primaryPosition: z.enum(["PG", "SG", "SF", "PF", "C"]),
  secondaryPosition: z.enum(["PG", "SG", "SF", "PF", "C"]).nullable(),
  primaryArchetype: z.enum([
    "lead_guard",
    "scoring_guard",
    "defensive_guard",
    "combo_guard",
    "shooting_wing",
    "three_and_d_wing",
    "slashing_wing",
    "point_forward",
    "utility_wing",
    "stretch_big",
    "interior_scorer",
    "rim_protector",
    "rebounding_big",
    "utility_big",
  ]),
  secondaryArchetype: z
    .enum([
      "lead_guard",
      "scoring_guard",
      "defensive_guard",
      "combo_guard",
      "shooting_wing",
      "three_and_d_wing",
      "slashing_wing",
      "point_forward",
      "utility_wing",
      "stretch_big",
      "interior_scorer",
      "rim_protector",
      "rebounding_big",
      "utility_big",
    ])
    .nullable(),
})

export const careerDevelopmentProfileSchema = z
  .strictObject({
    potential: ratingSchema,
    rating: ratingSchema,
    volatility: ratingSchema,
    peakAge: z.number().int().min(18).max(50),
    declineStartAge: z.number().int().min(19).max(50),
  })
  .refine((profile) => profile.declineStartAge > profile.peakAge, {
    message: "Decline must start after the peak age.",
    path: ["declineStartAge"],
  })

const playerProfileSchema = z.strictObject({
  physical: physicalProfileSchema,
  skills: playerSkillsSchema,
  role: playerRoleSchema,
  injuryResistance: ratingSchema,
  development: careerDevelopmentProfileSchema,
  traits: z.array(z.string().min(1)).max(3),
})

export const playerEntitySchema = z.strictObject({
  id: z.string().min(1),
  identity: z.strictObject({
    firstName: z.string().trim().min(1).nullable(),
    lastName: z.string().trim().min(1).nullable(),
  }),
  leagueStatus: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("unassigned") }),
    z.strictObject({ kind: z.literal("rostered"), teamId: z.string().min(1) }),
    z.strictObject({
      kind: z.literal("re-signing"),
      teamId: z.string().min(1),
    }),
    z.strictObject({ kind: z.literal("free-agent") }),
    z.strictObject({
      kind: z.literal("draft-prospect"),
      draftClassId: z.string().min(1),
    }),
    z.strictObject({ kind: z.literal("retired") }),
  ]),
  age: z.number().int().min(18).max(80),
  profile: playerProfileSchema,
})

export const gameSimulationConfigSchema = z.strictObject({
  version: z.number().int().positive(),
  presetId: z.enum(["standard", "custom"]),
  environment: z.strictObject({
    pace: z.number().min(0).max(100),
    scoringEnvironment: z.number().min(0).max(100),
    gameVariance: z.number().min(0).max(100),
    talentSeparation: z.number().min(0).max(100),
    homeCourtAdvantage: z.number().min(0).max(100),
  }),
  offense: z.strictObject({
    threePointRate: z.number().min(0).max(100),
    rimRate: z.number().min(0).max(100),
    midrangeRate: z.number().min(0).max(100),
    shotSelectionDiscipline: z.number().min(0).max(100),
    starUsage: z.number().min(0).max(100),
    ballMovement: z.number().min(0).max(100),
    isolationRate: z.number().min(0).max(100),
    transitionRate: z.number().min(0).max(100),
    offensiveRebounding: z.number().min(0).max(100),
  }),
  defense: z.strictObject({
    pressure: z.number().min(0).max(100),
    helpDefense: z.number().min(0).max(100),
    switching: z.number().min(0).max(100),
    doubleTeamRate: z.number().min(0).max(100),
    turnoverPressure: z.number().min(0).max(100),
    foulDiscipline: z.number().min(0).max(100),
  }),
  rotation: z.strictObject({
    adherence: z.number().min(0).max(100),
    benchUsage: z.number().min(0).max(100),
    starterWorkload: z.number().min(0).max(100),
    fatigueImpact: z.number().min(0).max(100),
  }),
  coaching: z.strictObject({
    influence: z.number().min(0).max(100),
    paceInfluence: z.number().min(0).max(100),
    shotSelectionInfluence: z.number().min(0).max(100),
    defensiveInfluence: z.number().min(0).max(100),
  }),
  injuries: z.strictObject({
    frequency: z.enum(["off", "rare", "normal", "frequent"]),
    severity: z.enum(["minor", "mixed"]),
    maxGamesOut: z.number().int().min(0).max(82),
    inGameInjuries: z.boolean(),
  }),
  overtime: z.strictObject({
    enabled: z.boolean(),
    segmentMinutes: z.number().int().min(1).max(20),
    maxSegments: z.number().int().min(1).max(20),
  }),
})

const gameAvailabilitySchema = z.strictObject({
  available: z.boolean(),
  gamesRemaining: z.number().int().min(0).max(82),
  restriction: z.enum(["none", "minutes-limited"]).optional(),
  minutesLimit: z.number().min(0).max(48).optional(),
})

const gameRotationSchema = z.strictObject({
  starters: z.array(z.string().min(1)),
  depthOrder: z.array(z.string().min(1)),
  targetMinutes: z.record(z.string().min(1), z.number().min(0).max(60)),
})

const gameCoachingProfileSchema = z.strictObject({
  pace: z.number().min(0).max(100),
  offensiveStyle: z.number().min(0).max(100),
  defensivePressure: z.number().min(0).max(100),
  shotSelection: z.number().min(0).max(100),
  rotationDepth: z.number().min(0).max(100),
})

export const gameMatchupFixtureSchema = z.strictObject({
  version: z.number().int().positive(),
  source: z.strictObject({
    kind: z.enum(["initial-player-universe", "league-document", "manual"]),
    id: z.string().min(1),
    version: z.number().int().positive(),
  }),
  seed: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  teams: z.record(
    z.string().min(1),
    z.strictObject({ id: z.string().min(1), name: z.string().min(1) })
  ),
  players: z.record(z.string().min(1), playerEntitySchema),
  rotations: z.record(z.string().min(1), gameRotationSchema),
  availability: z.record(z.string().min(1), gameAvailabilitySchema),
  coaching: z.record(z.string().min(1), gameCoachingProfileSchema),
  config: gameSimulationConfigSchema,
})

const eventSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(["command.completed", "migration.applied"]),
  season: z.number().int().nonnegative(),
  phase: z.literal("foundation"),
  leagueDay: z.number().int().nonnegative(),
  entityRefs: z.array(
    z.strictObject({
      type: z.string().min(1),
      id: z.string().min(1),
    })
  ),
  payload: jsonRecordSchema,
  summary: z.string(),
  importance: z.enum(["routine", "notable", "major"]),
  storyTags: z.array(z.string()),
  source: z.strictObject({
    kind: z.enum(["command", "simulation", "migration"]),
    id: z.string().min(1),
  }),
})

const gamePeriodSchema = z.strictObject({
  number: z.number().int().positive(),
  kind: z.enum(["regulation", "overtime"]),
  minutes: z.number().positive(),
  teamPoints: z.record(z.string().min(1), z.number().int().nonnegative()),
  teamPossessions: z.record(z.string().min(1), z.number().int().nonnegative()),
})

const gamePlayerBoxScoreSchema = z.strictObject({
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  starter: z.boolean(),
  minutes: z.number().nonnegative(),
  opportunities: z.number().int().nonnegative(),
  usageRate: z.number().nonnegative(),
  points: z.number().int().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  threePointersMade: z.number().int().nonnegative(),
  threePointersAttempted: z.number().int().nonnegative(),
  freeThrowsMade: z.number().int().nonnegative(),
  freeThrowsAttempted: z.number().int().nonnegative(),
  offensiveRebounds: z.number().int().nonnegative(),
  defensiveRebounds: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  turnovers: z.number().int().nonnegative(),
  steals: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  fouls: z.number().int().nonnegative(),
  shotProfile: z.strictObject({
    rimAttempts: z.number().int().nonnegative(),
    midrangeAttempts: z.number().int().nonnegative(),
    threePointAttempts: z.number().int().nonnegative(),
  }),
  role: z.strictObject({
    label: z.string().min(1),
    creationShare: z.number().nonnegative(),
    scoringShare: z.number().nonnegative(),
  }),
  availability: gameAvailabilitySchema,
})

const gameTeamBoxScoreSchema = z.strictObject({
  teamId: z.string().min(1),
  points: z.number().int().nonnegative(),
  possessions: z.number().int().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  threePointersMade: z.number().int().nonnegative(),
  threePointersAttempted: z.number().int().nonnegative(),
  freeThrowsMade: z.number().int().nonnegative(),
  freeThrowsAttempted: z.number().int().nonnegative(),
  offensiveRebounds: z.number().int().nonnegative(),
  defensiveRebounds: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  turnovers: z.number().int().nonnegative(),
  steals: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  fouls: z.number().int().nonnegative(),
  pace: z.number().nonnegative(),
  offensiveEfficiency: z.number().nonnegative(),
  shotProfile: z.strictObject({
    rimAttempts: z.number().int().nonnegative(),
    midrangeAttempts: z.number().int().nonnegative(),
    threePointAttempts: z.number().int().nonnegative(),
  }),
})

const gameEventSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("injury"),
  teamId: z.string().min(1),
  playerId: z.string().min(1),
  period: z.number().int().positive(),
  description: z.string().min(1),
  gamesRemaining: z.number().int().positive(),
})

const gameLineupSegmentSchema = z.strictObject({
  id: z.string().min(1),
  teamId: z.string().min(1),
  period: z.number().int().positive(),
  startMinute: z.number().nonnegative(),
  endMinute: z.number().nonnegative(),
  playerIds: z.array(z.string().min(1)).length(5),
  reason: z.enum([
    "period-start",
    "checkpoint",
    "foul-trouble",
    "injury",
    "overtime",
  ]),
})

const gameDiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  scope: z.enum(["fixture", "rotation", "possession", "box-score", "injury"]),
})

const gameReconciliationCheckSchema = z.strictObject({
  code: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
  actual: z.number(),
  expected: z.number(),
  difference: z.number(),
})

export const gameResultSchema = z.strictObject({
  version: z.number().int().positive(),
  seed: z.string().min(1),
  status: z.enum(["completed", "rejected", "failed"]),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  winnerTeamId: z.string().min(1).nullable(),
  periods: z.array(gamePeriodSchema),
  teams: z.record(z.string().min(1), gameTeamBoxScoreSchema),
  players: z.record(z.string().min(1), gamePlayerBoxScoreSchema),
  lineupSegments: z.array(gameLineupSegmentSchema),
  events: z.array(gameEventSchema),
  diagnostics: z.array(gameDiagnosticSchema),
  reconciliation: z.strictObject({
    passed: z.boolean(),
    checks: z.array(gameReconciliationCheckSchema),
  }),
})

export const gameResultEnvelopeSchema = z.strictObject({
  schema: z.literal("foh-game-result"),
  result: gameResultSchema,
})

const matchupCalibrationMetricSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  mean: z.number(),
  minimum: z.number(),
  maximum: z.number(),
  p10: z.number(),
  median: z.number(),
  p90: z.number(),
})

const matchupCalibrationTargetSchema = z
  .strictObject({
    min: z.number(),
    max: z.number(),
  })
  .refine((target) => target.min <= target.max, {
    message: "Calibration target minimum must not exceed its maximum.",
  })

const matchupCalibrationBenchmarkCheckSchema = z.strictObject({
  metric: z.string().min(1),
  actual: matchupCalibrationMetricSchema,
  target: matchupCalibrationTargetSchema,
  passed: z.boolean(),
})

const matchupCalibrationBenchmarkSchema = z.strictObject({
  profileId: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
  checks: z.record(z.string().min(1), matchupCalibrationBenchmarkCheckSchema),
})

export const matchupBatchReportSchema = z.strictObject({
  schema: z.literal("foh-matchup-calibration"),
  version: z.literal(2),
  baseSeed: z.string().min(1),
  count: z.number().int().positive(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  effectiveConfig: gameSimulationConfigSchema,
  metrics: z.record(z.string().min(1), matchupCalibrationMetricSchema),
  benchmark: matchupCalibrationBenchmarkSchema.nullable(),
  results: z.array(gameResultSchema),
  failures: z.array(
    z.strictObject({
      seed: z.string().min(1),
      fixture: gameMatchupFixtureSchema,
      result: gameResultSchema,
    })
  ),
})

const universalPlayerValueConfigSchema = z.strictObject({
  version: z.literal(1),
  horizonSeasons: z.number().int().min(1).max(5),
  currentFormResponsiveness: z.number().min(0).max(100),
  sampleConfidence: z.number().min(0).max(100),
  currentAbilityEmphasis: z.number().min(0).max(100),
  productionEmphasis: z.number().min(0).max(100),
  trajectoryEmphasis: z.number().min(0).max(100),
  upsideEmphasis: z.number().min(0).max(100),
  durabilityImpact: z.number().min(0).max(100),
  defenseEmphasis: z.number().min(0).max(100),
  teamContextNormalization: z.number().min(0).max(100),
})

export const seasonProductionConfigSchema = z.strictObject({
  version: z.literal(1),
  presetId: z.enum(["standard", "custom"]),
  runPreset: z.enum(["smoke", "early", "half", "full", "batch"]),
  gamesPerTeam: z.number().int().min(1).max(82),
  schedule: z.strictObject({
    teamCount: z.number().int().min(2).max(30),
    homeAwayBalanced: z.boolean(),
    scheduleSeed: z.string().min(1),
  }),
  injuries: z.strictObject({ mode: z.enum(["standard", "off"]) }),
  development: z.strictObject({ enabled: z.literal(false) }),
  playoffs: z.strictObject({ enabled: z.literal(false) }),
  value: universalPlayerValueConfigSchema,
})

export const seasonScheduleEntrySchema = z.strictObject({
  id: z.string().min(1),
  round: z.number().int().positive(),
  leagueDay: z.number().int().positive(),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
})

export const seasonFixtureSchema = z.strictObject({
  version: z.literal(1),
  source: z.strictObject({
    kind: z.enum(["initial-player-universe", "league-document", "manual"]),
    id: z.string().min(1),
    version: z.number().int().positive(),
  }),
  seed: z.string().min(1),
  season: z.number().int().positive(),
  teams: z.record(
    z.string().min(1),
    z.strictObject({ id: z.string().min(1), name: z.string().min(1) })
  ),
  players: z.record(z.string().min(1), playerEntitySchema),
  rosters: z.record(z.string().min(1), z.array(z.string().min(1))),
  populations: z.strictObject({
    rostered: z.array(z.string().min(1)),
    freeAgents: z.array(z.string().min(1)),
    draftProspects: z.array(z.string().min(1)),
  }),
  schedule: z.array(seasonScheduleEntrySchema),
  rotations: z.record(z.string().min(1), gameRotationSchema),
  coaching: z.record(z.string().min(1), gameCoachingProfileSchema),
  availability: z.record(z.string().min(1), gameAvailabilitySchema),
  gameConfig: gameSimulationConfigSchema,
  config: seasonProductionConfigSchema,
})

const playerSeasonProductionSchema = z.strictObject({
  playerId: z.string().min(1),
  teamId: z.string().min(1).nullable(),
  population: z.enum(["rostered", "free-agent", "draft-prospect"]),
  gamesScheduled: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  starts: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  opportunities: z.number().int().nonnegative(),
  usageRate: z.number().nonnegative(),
  points: z.number().int().nonnegative(),
  pointsPerGame: z.number().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  threePointersMade: z.number().int().nonnegative(),
  threePointersAttempted: z.number().int().nonnegative(),
  freeThrowsMade: z.number().int().nonnegative(),
  freeThrowsAttempted: z.number().int().nonnegative(),
  trueShootingPercentage: z.number().nonnegative(),
  offensiveRebounds: z.number().int().nonnegative(),
  defensiveRebounds: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  reboundsPerGame: z.number().nonnegative(),
  assists: z.number().int().nonnegative(),
  assistsPerGame: z.number().nonnegative(),
  turnovers: z.number().int().nonnegative(),
  turnoversPerGame: z.number().nonnegative(),
  steals: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  fouls: z.number().int().nonnegative(),
  availabilityRate: z.number().nonnegative(),
  shotProfile: z.strictObject({
    rimAttempts: z.number().int().nonnegative(),
    midrangeAttempts: z.number().int().nonnegative(),
    threePointAttempts: z.number().int().nonnegative(),
  }),
  role: z.string().min(1),
  sampleState: z.enum(["provisional", "early", "established", "full"]),
})

const teamSeasonProductionSchema = z.strictObject({
  teamId: z.string().min(1),
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  opponentPoints: z.number().int().nonnegative(),
  possessions: z.number().int().nonnegative(),
  opponentPossessions: z.number().int().nonnegative(),
  pace: z.number().nonnegative(),
  offensiveEfficiency: z.number().nonnegative(),
  defensiveEfficiency: z.number().nonnegative(),
  fieldGoalsMade: z.number().int().nonnegative(),
  fieldGoalsAttempted: z.number().int().nonnegative(),
  threePointersMade: z.number().int().nonnegative(),
  threePointersAttempted: z.number().int().nonnegative(),
  freeThrowsMade: z.number().int().nonnegative(),
  freeThrowsAttempted: z.number().int().nonnegative(),
  rebounds: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  turnovers: z.number().int().nonnegative(),
  steals: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  fouls: z.number().int().nonnegative(),
})

const leagueProductionSummarySchema = z.strictObject({
  gamesCompleted: z.number().int().nonnegative(),
  gamesPerTeam: z.number().int().nonnegative(),
  teamCount: z.number().int().positive(),
  pointsPerGame: z.number().nonnegative(),
  possessionsPerTeam: z.number().nonnegative(),
  offensiveEfficiency: z.number().nonnegative(),
  fieldGoalPercentage: z.number().nonnegative(),
  threePointPercentage: z.number().nonnegative(),
  freeThrowPercentage: z.number().nonnegative(),
  threePointAttemptRate: z.number().nonnegative(),
  assistsPerTeam: z.number().nonnegative(),
  turnoversPerTeam: z.number().nonnegative(),
  reboundsPerTeam: z.number().nonnegative(),
  injuries: z.number().int().nonnegative(),
  reconciliationPassRate: z.number().nonnegative(),
})

const universalPlayerValueSchema = z.strictObject({
  playerId: z.string().min(1),
  evaluationPoint: z.enum(["preseason", "checkpoint", "final"]),
  checkpointGamesPerTeam: z.number().int().nonnegative(),
  rawValue: z.number(),
  currentFormSignal: z.number(),
  projectionSignal: z.number(),
  confidence: z.enum(["provisional", "early", "established", "full"]),
  sample: z.strictObject({
    games: z.number().int().nonnegative(),
    minutes: z.number().nonnegative(),
    seasons: z.number().int().nonnegative(),
  }),
  breakdown: z.strictObject({
    currentAbility: z.number(),
    recentProduction: z.number(),
    projectedContribution: z.number(),
    ageTrajectory: z.number(),
    upside: z.number(),
    durability: z.number(),
    opportunity: z.number().default(0),
    roleContext: z.number(),
    defensiveContribution: z.number(),
  }),
  diagnostics: z.strictObject({
    percentile: z.number().nonnegative(),
    rank: z.number().int().nonnegative(),
    outlierFlags: z.array(z.string()),
  }),
})

export const seasonCheckpointReportSchema = z.strictObject({
  gamesPerTeam: z.number().int().nonnegative(),
  gamesCompleted: z.number().int().nonnegative(),
  playerProduction: z.record(z.string().min(1), playerSeasonProductionSchema),
  teamProduction: z.record(z.string().min(1), teamSeasonProductionSchema),
  leagueSummary: leagueProductionSummarySchema,
  values: z.record(z.string().min(1), universalPlayerValueSchema),
})

const seasonRunFailureSchema = z.strictObject({
  scheduleEntry: seasonScheduleEntrySchema,
  fixture: gameMatchupFixtureSchema,
  result: gameResultSchema,
})

export const seasonRunResultSchema = z.strictObject({
  status: z.enum(["completed", "cancelled", "failed"]),
  fixture: seasonFixtureSchema,
  games: z.array(gameResultSchema),
  checkpoints: z.array(seasonCheckpointReportSchema),
  finalAvailability: z.record(z.string().min(1), gameAvailabilitySchema),
  failures: z.array(seasonRunFailureSchema),
})

const seasonBatchMetricSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  mean: z.number(),
  minimum: z.number(),
  maximum: z.number(),
})

export const seasonBatchReportSchema = z.strictObject({
  schema: z.literal("foh-season-production-calibration"),
  version: z.literal(1),
  baseSeed: z.string().min(1),
  count: z.number().int().positive(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.boolean(),
  reports: z.array(seasonRunResultSchema),
  metrics: z.record(z.string().min(1), seasonBatchMetricSchema),
})

export const productionValueLabReportSchema = z.strictObject({
  schema: z.literal("foh-production-value-lab"),
  version: z.literal(1),
  baseSeed: z.string().min(1),
  fixture: seasonFixtureSchema,
  result: seasonRunResultSchema,
})

const gameNumericSettingPathSchema = z.enum([
  "environment.pace",
  "environment.scoringEnvironment",
  "environment.gameVariance",
  "environment.talentSeparation",
  "environment.homeCourtAdvantage",
  "offense.threePointRate",
  "offense.rimRate",
  "offense.midrangeRate",
  "offense.shotSelectionDiscipline",
  "offense.starUsage",
  "offense.ballMovement",
  "offense.isolationRate",
  "offense.transitionRate",
  "offense.offensiveRebounding",
  "defense.pressure",
  "defense.helpDefense",
  "defense.turnoverPressure",
  "defense.switching",
  "defense.doubleTeamRate",
  "defense.foulDiscipline",
  "rotation.adherence",
  "rotation.benchUsage",
  "rotation.starterWorkload",
  "rotation.fatigueImpact",
  "coaching.influence",
  "coaching.paceInfluence",
  "coaching.shotSelectionInfluence",
  "coaching.defensiveInfluence",
  "injuries.maxGamesOut",
])

const sliderSensitivityMetricSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  mean: z.number(),
  minimum: z.number(),
  maximum: z.number(),
  p10: z.number(),
  median: z.number(),
  p90: z.number(),
})

const sliderSensitivityDirectionSchema = z.enum([
  "increase",
  "decrease",
  "spread-increase",
  "distance-decrease",
  "observe",
])

const sliderSensitivityClassificationSchema = z.enum([
  "wired",
  "no-op",
  "conditional",
  "saturated",
  "unknown",
])

const sliderSensitivityArmSchema = z.strictObject({
  label: z.enum([
    "minimum",
    "lower-quartile",
    "baseline",
    "upper-quartile",
    "maximum",
  ]),
  value: z.number(),
  effectiveConfig: gameSimulationConfigSchema,
  metrics: z.record(z.string().min(1), sliderSensitivityMetricSchema),
})

const sliderSensitivityMetricDeltaSchema = z.strictObject({
  metric: z.string().min(1),
  baseline: sliderSensitivityMetricSchema,
  low: sliderSensitivityMetricSchema,
  high: sliderSensitivityMetricSchema,
  lowSignal: z.number(),
  highSignal: z.number(),
  delta: z.number(),
  diagnosticFloor: z.number().nonnegative(),
  directionalPass: z.boolean(),
})

const sliderSensitivityScenarioSchema = z
  .strictObject({
    scenario: z.string().min(1),
    arms: z.array(sliderSensitivityArmSchema).min(2),
    pairedCount: z.number().int().nonnegative(),
    pairedChangedCount: z.number().int().nonnegative(),
    primary: sliderSensitivityMetricDeltaSchema,
    classification: sliderSensitivityClassificationSchema,
    diagnostic: z.string().min(1),
  })
  .refine((scenario) => scenario.pairedChangedCount <= scenario.pairedCount, {
    message: "Changed paired games cannot exceed paired games.",
  })

const sliderSensitivityResultSchema = z.strictObject({
  path: gameNumericSettingPathSchema,
  label: z.string().min(1),
  primaryMetric: z.string().min(1),
  direction: sliderSensitivityDirectionSchema,
  classification: sliderSensitivityClassificationSchema,
  scenarios: z.array(sliderSensitivityScenarioSchema).min(1),
  diagnostic: z.string().min(1),
})

export const sliderSensitivityReportSchema = z.strictObject({
  schema: z.literal("foh-slider-sensitivity"),
  version: z.literal(1),
  baseSeed: z.string().min(1),
  count: z.number().int().positive(),
  baselineConfig: gameSimulationConfigSchema,
  results: z.array(sliderSensitivityResultSchema).min(1),
})

const careerPhaseSchema = z.enum(["growth", "plateau", "decline"])
const careerSkillKeySchema = z.enum([
  "shooting",
  "finishing",
  "passing",
  "handling",
  "rebounding",
  "defense",
  "basketballIQ",
  "stamina",
])

export const careerAnnualContextSchema = z.strictObject({
  season: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  gamesScheduled: z.number().int().positive(),
  injuryDevelopmentPenalty: z.number().min(0).max(1),
  coachingDevelopmentEmphasis: z.number().min(0).max(100),
})

export const careerAvailabilitySummarySchema = z.strictObject({
  gamesScheduled: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  availabilityRate: z.number().min(0).max(1),
  injuryDevelopmentPenalty: z.number().min(0).max(1),
  injuryAffected: z.boolean(),
})

export const careerDevelopmentEventSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum([
    "phase-change",
    "skill-development",
    "plateau-noise",
    "injury-effect",
    "availability",
  ]),
  season: z.number().int().nonnegative(),
  playerId: z.string().min(1),
  phase: careerPhaseSchema,
  skill: careerSkillKeySchema.nullable(),
  delta: z.number(),
  summary: z.string().min(1),
})

export const careerTransitionResultSchema = z.strictObject({
  player: playerEntitySchema,
  phase: careerPhaseSchema,
  skillDeltas: z.strictObject({
    shooting: z.number(),
    finishing: z.number(),
    passing: z.number(),
    handling: z.number(),
    rebounding: z.number(),
    defense: z.number(),
    basketballIQ: z.number(),
    stamina: z.number(),
  }),
  events: z.array(careerDevelopmentEventSchema),
  availability: careerAvailabilitySummarySchema,
})

const retirementFactorSchema = z.strictObject({
  key: z.enum([
    "age",
    "health",
    "injury-history",
    "current-ability",
    "role",
    "opportunity",
    "contract-opportunity",
  ]),
  label: z.string().min(1),
  contribution: z.number(),
  explanation: z.string().min(1),
})

export const retirementEvaluationSchema = z.strictObject({
  eligible: z.boolean(),
  retired: z.boolean(),
  probability: z.number().min(0).max(1),
  factors: z.array(retirementFactorSchema),
})

export const careerRetirementContextSchema = z.strictObject({
  season: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative().optional(),
  gamesScheduled: z.number().int().positive().optional(),
  minutes: z.number().nonnegative().optional(),
  injuryHistory: z.number().min(0).max(1).optional(),
  health: z.number().min(0).max(100).optional(),
  opportunity: z.number().min(0).max(100).optional(),
  contractOpportunity: z.number().min(0).max(100).optional(),
})

const careerContextPresetSchema = z.enum(["healthy", "normal", "injured"])
const careerMinutesPresetSchema = z.enum(["zero", "low", "typical", "high"])
const careerCoachingPresetSchema = z.enum(["weak", "standard", "strong"])
const careerDevelopmentPresetSchema = z.enum([
  "standard",
  "high-potential",
  "low-potential",
  "high-volatility",
])

export const careerCohortOptionsSchema = z.strictObject({
  seed: z.string().min(1),
  startingAge: z.number().int().min(18).max(40),
  sampleSize: z.number().int().positive().max(100000),
  runYears: z.number().int().positive().max(30),
  minutesContext: careerMinutesPresetSchema,
  coachingContext: careerCoachingPresetSchema,
  injuryContext: careerContextPresetSchema,
  developmentContext: careerDevelopmentPresetSchema,
  season: z.number().int().nonnegative().optional(),
})

export const careerIndividualOptionsSchema = careerCohortOptionsSchema.omit({
  sampleSize: true,
})

export const careerSnapshotSchema = z.strictObject({
  season: z.number().int().nonnegative(),
  age: z.number().int().min(18).max(80),
  player: playerEntitySchema,
  currentAbility: ratingSchema,
  potentialForecast: ratingSchema,
  peakAge: z.number().int().min(18).max(50),
  declineStartAge: z.number().int().min(19).max(50),
  phase: careerPhaseSchema,
  events: z.array(careerDevelopmentEventSchema),
  availability: careerAvailabilitySummarySchema,
  retirement: retirementEvaluationSchema,
})

export const careerTimelineSchema = z.strictObject({
  playerId: z.string().min(1),
  seed: z.string().min(1),
  startingAge: z.number().int().min(18).max(40),
  snapshots: z.array(careerSnapshotSchema).min(1),
  finalPlayer: playerEntitySchema,
  retired: z.boolean(),
  retirementAge: z.number().int().min(18).max(80).nullable(),
  peakAbility: ratingSchema,
  realizedPeakAge: z.number().int().min(18).max(50),
  plateauLength: z.number().int().nonnegative(),
})

const careerSkillsSchema = z.strictObject({
  shooting: z.number().min(0).max(100),
  finishing: z.number().min(0).max(100),
  passing: z.number().min(0).max(100),
  handling: z.number().min(0).max(100),
  rebounding: z.number().min(0).max(100),
  defense: z.number().min(0).max(100),
  basketballIQ: z.number().min(0).max(100),
  stamina: z.number().min(0).max(100),
})

const careerSkillTrajectorySchema = z.strictObject({
  season: z.number().int().nonnegative(),
  age: z.number().int().min(18).max(80),
  activePlayers: z.number().int().nonnegative(),
  average: careerSkillsSchema,
  p10: careerSkillsSchema,
  median: careerSkillsSchema,
  p90: careerSkillsSchema,
  currentAbility: z.strictObject({
    average: z.number().min(0).max(100),
    p10: z.number().min(0).max(100),
    median: z.number().min(0).max(100),
    p90: z.number().min(0).max(100),
  }),
})

export const careerBenchmarkResultSchema = z.strictObject({
  profileId: z.string().min(1),
  label: z.string().min(1),
  passed: z.boolean(),
  checks: z.record(
    z.string().min(1),
    z.strictObject({
      metric: z.string().min(1),
      actual: z.number(),
      target: z.strictObject({ min: z.number(), max: z.number() }),
      passed: z.boolean(),
    })
  ),
})

export const careerCohortSummarySchema = z.strictObject({
  playerCount: z.number().int().nonnegative(),
  startingAge: z.number().int().min(18).max(40),
  runYears: z.number().int().positive().max(30),
  skillTrajectories: z.array(careerSkillTrajectorySchema),
  averagePeakAge: z.number(),
  averageDeclineStartAge: z.number(),
  averagePlateauLength: z.number().nonnegative(),
  growthToPeak: z.number(),
  declineRate: z.number(),
  breakoutRate: z.number().min(0).max(1),
  bustRate: z.number().min(0).max(1),
  lateBloomerRate: z.number().min(0).max(1),
  availabilityRate: z.number().min(0).max(1),
  injuryAffectedSeasons: z.number().int().nonnegative(),
  retirementRate: z.number().min(0).max(1),
  retirementAgeDistribution: z.array(
    z.strictObject({
      age: z.number().int().min(18).max(80),
      count: z.number().int().nonnegative(),
      rate: z.number().min(0).max(1),
    })
  ),
  potentialForecastVsRealizedPeak: z.strictObject({
    averageForecast: z.number().min(0).max(100),
    averageRealizedPeak: z.number().min(0).max(100),
    correlation: z.number().min(-1).max(1),
  }),
  failedSeeds: z.array(z.string().min(1)),
  outlierTimelines: z.array(careerTimelineSchema),
})

export const failedCareerFixtureSchema = z.strictObject({
  seed: z.string().min(1),
  message: z.string().min(1),
  playerId: z.string().min(1).optional(),
})

export const careerCohortReportSchema = z.strictObject({
  schema: z.literal("foh-career-cohort-lab"),
  version: z.literal(1),
  options: careerCohortOptionsSchema,
  completed: z.number().int().nonnegative(),
  cancelled: z.boolean(),
  summary: careerCohortSummarySchema,
  timelines: z.array(careerTimelineSchema).optional(),
  benchmark: careerBenchmarkResultSchema.nullable(),
  failedFixtures: z.array(failedCareerFixtureSchema),
})

export const careerIndividualReportSchema = z.strictObject({
  schema: z.literal("foh-career-individual-lab"),
  version: z.literal(1),
  options: careerIndividualOptionsSchema,
  timeline: careerTimelineSchema,
  failedFixtures: z.array(failedCareerFixtureSchema),
})

const leagueDocumentShape = z.strictObject({
  schema: z.strictObject({
    name: z.literal("foh-league"),
    version: z.literal(CURRENT_SCHEMA_VERSION),
    rulesVersion: z.number().int().positive(),
  }),
  metadata: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  }),
  settings: z.strictObject({
    standardPresetId: z.string().min(1),
    resolvedConfig: z.strictObject({
      presetId: z.string().min(1),
      version: z.number().int().positive(),
    }),
    advancedOverrides: jsonRecordSchema,
  }),
  randomness: z.strictObject({
    mode: z.enum(["normal", "deterministic-lab"]),
    createdWithEntropy: z.boolean(),
    debugScopes: z.record(z.string(), z.string()).optional(),
  }),
  state: z.strictObject({
    season: z.number().int().positive(),
    phase: z.literal("foundation"),
    leagueDay: z.number().int().nonnegative(),
    userTeamId: z.string().min(1).nullable(),
    calendar: z.strictObject({ kind: z.literal("foundation") }),
    phaseTasks: z.array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        status: z.enum(["pending", "completed", "blocked"]),
      })
    ),
  }),
  entities: z.strictObject({
    teams: z.record(
      z.string(),
      z.strictObject({ id: z.string().min(1), name: z.string().min(1) })
    ),
    players: z.record(z.string(), playerEntitySchema),
    owners: z.record(z.string(), jsonRecordSchema),
    staff: z.record(z.string(), jsonRecordSchema),
    contracts: z.record(z.string(), jsonRecordSchema),
    draftAssets: z.record(z.string(), jsonRecordSchema),
    offers: z.record(z.string(), jsonRecordSchema),
  }),
  projections: z.strictObject({
    standings: z.array(jsonRecordSchema),
    payroll: z.array(jsonRecordSchema),
  }),
  history: z.strictObject({
    events: z.array(eventSchema),
    seasonArchives: z.array(jsonRecordSchema),
    records: z.array(jsonRecordSchema),
  }),
  optionalData: z
    .strictObject({
      games: z.array(jsonRecordSchema).optional(),
      playerGameLogs: z.array(jsonRecordSchema).optional(),
      labDiagnostics: z.array(jsonRecordSchema).optional(),
      scoutingDiagnostics: z.array(jsonRecordSchema).optional(),
    })
    .optional(),
})

export const leagueDocumentSchema = leagueDocumentShape.superRefine(
  (league, context) => {
    for (const [teamKey, team] of Object.entries(league.entities.teams)) {
      if (teamKey !== team.id) {
        context.addIssue({
          code: "custom",
          message: "The team record key must match the team ID.",
          path: ["entities", "teams", teamKey, "id"],
        })
      }
    }

    for (const [playerKey, player] of Object.entries(league.entities.players)) {
      if (playerKey !== player.id) {
        context.addIssue({
          code: "custom",
          message: "The player record key must match the player ID.",
          path: ["entities", "players", playerKey, "id"],
        })
      }

      const status = player.leagueStatus
      if (
        (status.kind === "rostered" || status.kind === "re-signing") &&
        !league.entities.teams[status.teamId]
      ) {
        context.addIssue({
          code: "custom",
          message: "The player league status references a missing team.",
          path: ["entities", "players", playerKey, "leagueStatus", "teamId"],
        })
      }
    }
  }
)

export type LeagueDocumentInput = z.input<typeof leagueDocumentSchema>

export function getLeagueDocumentJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(leagueDocumentSchema) as Record<string, unknown>
}
