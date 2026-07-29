import { z } from "zod"

import { CURRENT_SCHEMA_VERSION } from "./version"

const jsonRecordSchema = z.record(z.string(), z.unknown())
const ratingSchema = z.number().int().min(0).max(100)
const numericRangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((range) => range.min <= range.max, {
    message: "The minimum must not exceed the maximum.",
  })

const distributionConfigSchema = z.object({
  center: z.number(),
  spread: z.number().nonnegative(),
  shape: z.literal("long-tailed"),
})

export const playerGenerationConfigSchema = z.object({
  version: z.number().int().positive(),
  age: numericRangeSchema,
  ratingBounds: numericRangeSchema,
  talentDistribution: distributionConfigSchema,
  starTailFrequency: z.object({
    above70: z.number().min(0).max(1),
    above80: z.number().min(0).max(1),
    above90: z.number().min(0).max(1),
  }),
  physical: z.object({
    heightInches: numericRangeSchema,
    weightPounds: numericRangeSchema,
    wingspanInches: numericRangeSchema,
    speed: numericRangeSchema,
    strength: numericRangeSchema,
    vertical: numericRangeSchema,
  }),
  development: z.object({
    potential: distributionConfigSchema,
    rating: distributionConfigSchema,
    volatility: distributionConfigSchema,
  }),
  traitFrequency: z.number().min(0).max(1),
  availableTraits: z.array(z.string().min(1)),
  skillCorrelations: z.array(
    z.object({
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

const physicalProfileSchema = z.object({
  heightInches: z.number().int().min(48).max(96),
  weightPounds: z.number().int().min(80).max(500),
  wingspanInches: z.number().int().min(48).max(110),
  speed: ratingSchema,
  strength: ratingSchema,
  vertical: ratingSchema,
})

const playerSkillsSchema = z.object({
  shooting: ratingSchema,
  finishing: ratingSchema,
  passing: ratingSchema,
  handling: ratingSchema,
  rebounding: ratingSchema,
  defense: ratingSchema,
  basketballIQ: ratingSchema,
  stamina: ratingSchema,
})

const developmentProfileSchema = z.object({
  potential: ratingSchema,
  rating: ratingSchema,
  volatility: ratingSchema,
})

const playerProfileSchema = z.object({
  physical: physicalProfileSchema,
  skills: playerSkillsSchema,
  injuryResistance: ratingSchema,
  development: developmentProfileSchema,
  traits: z.array(z.string().min(1)).max(3),
})

export const playerEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(18).max(50),
  profile: playerProfileSchema,
})

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["command.completed", "migration.applied"]),
  season: z.number().int().nonnegative(),
  phase: z.literal("foundation"),
  leagueDay: z.number().int().nonnegative(),
  entityRefs: z.array(
    z.object({
      type: z.string().min(1),
      id: z.string().min(1),
    })
  ),
  payload: jsonRecordSchema,
  summary: z.string(),
  importance: z.enum(["routine", "notable", "major"]),
  storyTags: z.array(z.string()),
  source: z.object({
    kind: z.enum(["command", "simulation", "migration"]),
    id: z.string().min(1),
  }),
})

export const leagueDocumentSchema = z.object({
  schema: z.object({
    name: z.literal("foh-league"),
    version: z.literal(CURRENT_SCHEMA_VERSION),
    rulesVersion: z.number().int().positive(),
  }),
  metadata: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  }),
  settings: z.object({
    standardPresetId: z.string().min(1),
    resolvedConfig: z.object({
      presetId: z.string().min(1),
      version: z.number().int().positive(),
    }),
    advancedOverrides: jsonRecordSchema,
  }),
  randomness: z.object({
    mode: z.enum(["normal", "deterministic-lab"]),
    createdWithEntropy: z.boolean(),
    debugScopes: z.record(z.string(), z.string()).optional(),
  }),
  state: z.object({
    season: z.number().int().positive(),
    phase: z.literal("foundation"),
    leagueDay: z.number().int().nonnegative(),
    userTeamId: z.string().min(1).nullable(),
    calendar: z.object({ kind: z.literal("foundation") }),
    phaseTasks: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        status: z.enum(["pending", "completed", "blocked"]),
      })
    ),
  }),
  entities: z.object({
    teams: z.record(
      z.string(),
      z.object({ id: z.string().min(1), name: z.string().min(1) })
    ),
    players: z.record(z.string(), playerEntitySchema),
    owners: z.record(z.string(), jsonRecordSchema),
    staff: z.record(z.string(), jsonRecordSchema),
    contracts: z.record(z.string(), jsonRecordSchema),
    draftAssets: z.record(z.string(), jsonRecordSchema),
    offers: z.record(z.string(), jsonRecordSchema),
  }),
  projections: z.object({
    standings: z.array(jsonRecordSchema),
    payroll: z.array(jsonRecordSchema),
  }),
  history: z.object({
    events: z.array(eventSchema),
    seasonArchives: z.array(jsonRecordSchema),
    records: z.array(jsonRecordSchema),
  }),
  optionalData: z
    .object({
      games: z.array(jsonRecordSchema).optional(),
      playerGameLogs: z.array(jsonRecordSchema).optional(),
      labDiagnostics: z.array(jsonRecordSchema).optional(),
      scoutingDiagnostics: z.array(jsonRecordSchema).optional(),
    })
    .optional(),
})

export type LeagueDocumentInput = z.input<typeof leagueDocumentSchema>

export function getLeagueDocumentJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(leagueDocumentSchema) as Record<string, unknown>
}
