import type { LeagueDocument, PlayerEntity } from "./types"

export function createPlayerContractFixture(
  input: Partial<
    Pick<PlayerEntity, "id" | "identity" | "leagueStatus" | "age">
  > = {}
): PlayerEntity {
  return {
    id: input.id ?? "player-fixture",
    identity: input.identity ?? {
      firstName: "Alex",
      lastName: "Example",
    },
    leagueStatus: input.leagueStatus ?? { kind: "unassigned" },
    age: input.age ?? 24,
    profile: {
      physical: {
        heightInches: 78,
        weightPounds: 220,
        wingspanInches: 82,
        speed: 72,
        strength: 68,
        vertical: 75,
      },
      skills: {
        shooting: 74,
        finishing: 70,
        passing: 66,
        handling: 64,
        rebounding: 58,
        defense: 61,
        basketballIQ: 73,
        stamina: 80,
      },
      role: {
        primaryPosition: "SF",
        secondaryPosition: "SG",
        primaryArchetype: "three_and_d_wing",
        secondaryArchetype: "shooting_wing",
      },
      injuryResistance: 77,
      development: {
        potential: 82,
        rating: 62,
        volatility: 25,
        peakAge: 27,
        declineStartAge: 32,
      },
      traits: ["hard-worker"],
    },
  }
}

export function createFoundationLeague(
  input: {
    id?: string
    name?: string
    now?: string
  } = {}
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
