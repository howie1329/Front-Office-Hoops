import type { LeagueDocument, PlayerEntity, PlayerMarketProfile } from "./types"

export function createPlayerContractFixture(
  input: Partial<
    Pick<
      PlayerEntity,
      "id" | "identity" | "leagueStatus" | "age" | "marketPreferences"
    >
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
        growthCurve: "standard",
        declineCurve: "standard",
      },
      traits: ["hard-worker"],
    },
    marketPreferences:
      input.marketPreferences ??
      ({
        salaryPriority: 58,
        securityPriority: 52,
        winningPriority: 50,
        rolePriority: 50,
        playingTimePriority: 50,
        marketSizePriority: 45,
        loyalty: 50,
        patience: 50,
        negotiationBaseline: 72,
      } satisfies PlayerMarketProfile),
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
      structure: { conferences: [], divisions: [] },
      calendar: {
        kind: "foundation",
        currentDate: now.slice(0, 10),
        preseasonStart: now.slice(0, 10),
        regularSeasonStart: now.slice(0, 10),
        regularSeasonEnd: now.slice(0, 10),
        milestones: {
          tradeDeadline: now.slice(0, 10),
          playoffsStart: now.slice(0, 10),
        },
        schedule: [],
      },
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
