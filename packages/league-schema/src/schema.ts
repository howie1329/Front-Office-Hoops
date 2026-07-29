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
  shooting: ratingSchema,
  finishing: ratingSchema,
  passing: ratingSchema,
  handling: ratingSchema,
  rebounding: ratingSchema,
  defense: ratingSchema,
  basketballIQ: ratingSchema,
  stamina: ratingSchema,
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

const developmentProfileSchema = z.strictObject({
  potential: ratingSchema,
  rating: ratingSchema,
  volatility: ratingSchema,
})

const playerProfileSchema = z.strictObject({
  physical: physicalProfileSchema,
  skills: playerSkillsSchema,
  role: playerRoleSchema,
  injuryResistance: ratingSchema,
  development: developmentProfileSchema,
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
  ]),
  age: z.number().int().min(18).max(50),
  profile: playerProfileSchema,
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
