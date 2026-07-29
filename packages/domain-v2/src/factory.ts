import type { LeagueDocument } from "./types"

export function createFoundationLeague(
  input: {
    id?: string
    name?: string
    now?: string
  } = {},
): LeagueDocument {
  const id = input.id ?? "foundation-fixture"
  const now = input.now ?? "2026-07-29T00:00:00.000Z"

  return {
    schema: {
      name: "foh-league",
      version: 1,
      rulesVersion: 1,
    },
    metadata: {
      id,
      name: input.name ?? "Foundation Fixture",
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      standardPresetId: "foundation",
      resolvedConfig: {
        presetId: "foundation",
        version: 1,
      },
      advancedOverrides: {},
    },
    randomness: {
      mode: "deterministic-lab",
      createdWithEntropy: false,
    },
    state: {
      season: 1,
      phase: "foundation",
      leagueDay: 0,
      userTeamId: null,
      calendar: { kind: "foundation" },
      phaseTasks: [],
    },
    entities: {
      teams: {},
      players: {},
      owners: {},
      staff: {},
      contracts: {},
      draftAssets: {},
      offers: {},
    },
    projections: {
      standings: [],
      payroll: [],
    },
    history: {
      events: [],
      seasonArchives: [],
      records: [],
    },
  }
}
