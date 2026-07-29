import { z } from "zod"

const jsonRecordSchema = z.record(z.string(), z.unknown())

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
    }),
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
    version: z.number().int().positive(),
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
      }),
    ),
  }),
  entities: z.object({
    teams: z.record(
      z.string(),
      z.object({ id: z.string().min(1), name: z.string().min(1) }),
    ),
    players: z.record(
      z.string(),
      z.object({ id: z.string().min(1), name: z.string().min(1) }),
    ),
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
