import { describe, expect, it } from "vitest"

import {
  createFoundationLeague,
  createPlayerContractFixture,
  createStandardPlayerGenerationConfig,
  type GameSimulationConfig,
} from "@workspace/domain-v2"

import {
  CURRENT_SCHEMA_VERSION,
  LeagueDocumentValidationError,
  deserializeLeagueDocument,
  gameSimulationConfigSchema,
  getLeagueDocumentJsonSchema,
  migrateLeagueDocument,
  matchupBatchReportSchema,
  previewLeagueImport,
  playerGenerationConfigSchema,
  playerEntitySchema,
  serializeLeagueDocument,
  validateLeagueDocument,
} from "../src"

function createGameSimulationConfig(): GameSimulationConfig {
  return {
    version: 1,
    presetId: "standard",
    environment: {
      pace: 50,
      scoringEnvironment: 50,
      gameVariance: 50,
      talentSeparation: 50,
      homeCourtAdvantage: 50,
    },
    offense: {
      threePointRate: 50,
      rimRate: 50,
      midrangeRate: 50,
      shotSelectionDiscipline: 50,
      starUsage: 50,
      ballMovement: 50,
      isolationRate: 50,
      transitionRate: 50,
      offensiveRebounding: 50,
    },
    defense: {
      pressure: 50,
      helpDefense: 50,
      switching: 50,
      doubleTeamRate: 50,
      turnoverPressure: 50,
      foulDiscipline: 50,
    },
    rotation: {
      adherence: 50,
      benchUsage: 50,
      starterWorkload: 50,
      fatigueImpact: 50,
    },
    coaching: {
      influence: 50,
      paceInfluence: 50,
      shotSelectionInfluence: 50,
      defensiveInfluence: 50,
    },
    injuries: {
      frequency: "off",
      severity: "minor",
      maxGamesOut: 6,
      inGameInjuries: false,
    },
    overtime: {
      enabled: true,
      segmentMinutes: 5,
      maxSegments: 6,
    },
  }
}

function createSchemaTeam(teamId: string) {
  return {
    teamId,
    points: 0,
    possessions: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    pace: 0,
    offensiveEfficiency: 0,
    shotProfile: {
      rimAttempts: 0,
      midrangeAttempts: 0,
      threePointAttempts: 0,
    },
  }
}

function createSchemaBatchReport() {
  const metric = {
    count: 1,
    mean: 0,
    minimum: 0,
    maximum: 0,
    p10: 0,
    median: 0,
    p90: 0,
  }
  const result = {
    version: 1,
    seed: "schema-seed",
    status: "completed" as const,
    homeTeamId: "home",
    awayTeamId: "away",
    winnerTeamId: null,
    periods: [
      {
        number: 1,
        kind: "regulation" as const,
        minutes: 12,
        teamPoints: { home: 0, away: 0 },
        teamPossessions: { home: 0, away: 0 },
      },
    ],
    teams: {
      home: createSchemaTeam("home"),
      away: createSchemaTeam("away"),
    },
    players: {},
    events: [],
    diagnostics: [],
    reconciliation: { passed: true, checks: [] },
  }

  return {
    schema: "foh-matchup-calibration" as const,
    version: 2 as const,
    baseSeed: "schema-batch",
    count: 1,
    completed: 1,
    failed: 0,
    effectiveConfig: createGameSimulationConfig(),
    metrics: { teamPoints: metric },
    benchmark: {
      profileId: "test-profile-v1",
      label: "Test profile",
      passed: true,
      checks: {
        teamPoints: {
          metric: "teamPoints",
          actual: metric,
          target: { min: 0, max: 1 },
          passed: true,
        },
      },
    },
    results: [result],
    failures: [],
  }
}

describe("league schema", () => {
  it("accepts and round-trips the foundation fixture", () => {
    const fixture = createFoundationLeague()
    const serialized = serializeLeagueDocument(fixture)
    const loaded = deserializeLeagueDocument(serialized)

    expect(loaded).toEqual(fixture)
    expect(validateLeagueDocument(loaded).valid).toBe(true)
  })

  it("rejects invalid documents with actionable issues", () => {
    const result = validateLeagueDocument({})

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })

  it("rejects non-JSON values in open document payloads", () => {
    const fixture = createFoundationLeague()
    ;(
      fixture.settings.advancedOverrides as Record<string, unknown>
    ).invalidValue = 1n

    expect(validateLeagueDocument(fixture).valid).toBe(false)
  })

  it("rejects unknown fields when importing fixed document structures", () => {
    const fixture = createFoundationLeague()
    const documents = [
      { ...fixture, unknownRootField: true },
      {
        ...fixture,
        metadata: { ...fixture.metadata, unknownMetadataField: true },
      },
    ]

    for (const document of documents) {
      expect(() => deserializeLeagueDocument(JSON.stringify(document))).toThrow(
        LeagueDocumentValidationError
      )
    }
  })

  it("rejects unsupported schema versions", () => {
    const fixture = createFoundationLeague()
    const futureDocument = {
      ...fixture,
      schema: { ...fixture.schema, version: CURRENT_SCHEMA_VERSION + 1 },
    }

    expect(() => migrateLeagueDocument(futureDocument)).toThrow(
      "No migration is available"
    )
  })

  it("rejects malformed JSON", () => {
    expect(() => deserializeLeagueDocument("not-json")).toThrow(
      LeagueDocumentValidationError
    )
  })

  it("exports a JSON Schema document", () => {
    const jsonSchema = getLeagueDocumentJsonSchema()

    expect(jsonSchema).toMatchObject({
      $schema: expect.any(String),
      type: "object",
    })
  })

  it("previews valid and invalid imports without persisting them", () => {
    const valid = previewLeagueImport(
      serializeLeagueDocument(createFoundationLeague())
    )
    const invalid = previewLeagueImport('{"schema":{"version":99}}')

    expect(valid).toMatchObject({
      status: "ready",
      documentId: "foundation-fixture",
      schemaVersion: 1,
    })
    expect(invalid).toMatchObject({
      status: "unsupported",
      schemaVersion: 99,
    })
  })

  it("validates version-2 matchup calibration reports", () => {
    const report = createSchemaBatchReport()

    expect(
      gameSimulationConfigSchema.safeParse(report.effectiveConfig).success
    ).toBe(true)
    expect(matchupBatchReportSchema.safeParse(report).success).toBe(true)
  })

  it("rejects malformed version-2 calibration report contracts", () => {
    const report = createSchemaBatchReport()
    const missingConfig: Record<string, unknown> = { ...report }
    delete missingConfig.effectiveConfig

    expect(matchupBatchReportSchema.safeParse(missingConfig).success).toBe(
      false
    )
    expect(
      matchupBatchReportSchema.safeParse({
        ...report,
        version: 1,
      }).success
    ).toBe(false)
    expect(
      matchupBatchReportSchema.safeParse({
        ...report,
        metrics: {
          teamPoints: {
            ...report.metrics.teamPoints,
            mean: "invalid",
          },
        },
      }).success
    ).toBe(false)
    expect(
      matchupBatchReportSchema.safeParse({
        ...report,
        benchmark: {
          ...report.benchmark,
          checks: {
            teamPoints: {
              ...report.benchmark!.checks.teamPoints,
              target: { min: 2, max: 1 },
            },
          },
        },
      }).success
    ).toBe(false)
  })

  it("validates the player profile contract inside a league document", () => {
    const fixture = createFoundationLeague()
    fixture.entities.players["player-fixture"] = createPlayerContractFixture()

    expect(validateLeagueDocument(fixture).valid).toBe(true)
    const invalidRole = validateLeagueDocument({
      ...fixture,
      entities: {
        ...fixture.entities,
        players: {
          "player-fixture": {
            ...fixture.entities.players["player-fixture"]!,
            profile: {
              ...fixture.entities.players["player-fixture"]!.profile,
              role: {
                ...fixture.entities.players["player-fixture"]!.profile.role,
                primaryPosition: "INVALID",
              },
            },
          },
        },
      },
    })

    expect(invalidRole.valid).toBe(false)
    const tooManyTraits = validateLeagueDocument({
      ...fixture,
      entities: {
        ...fixture.entities,
        players: {
          "player-fixture": {
            ...fixture.entities.players["player-fixture"],
            profile: {
              ...fixture.entities.players["player-fixture"]!.profile,
              traits: ["one", "two", "three", "four"],
            },
          },
        },
      },
    })

    expect(tooManyTraits.valid).toBe(false)

    const invalid = validateLeagueDocument({
      ...fixture,
      entities: {
        ...fixture.entities,
        players: {
          "player-fixture": {
            ...fixture.entities.players["player-fixture"],
            profile: {
              ...fixture.entities.players["player-fixture"]!.profile,
              injuryResistance: 101,
            },
          },
        },
      },
    })

    expect(invalid.valid).toBe(false)

    const missingPotential = validateLeagueDocument({
      ...fixture,
      entities: {
        ...fixture.entities,
        players: {
          "player-fixture": {
            ...fixture.entities.players["player-fixture"],
            profile: {
              ...fixture.entities.players["player-fixture"]!.profile,
              development: {
                rating: 62,
                volatility: 25,
              },
            },
          },
        },
      },
    })

    expect(missingPotential.valid).toBe(false)

    for (const potential of [-1, 101]) {
      const invalidPotential = validateLeagueDocument({
        ...fixture,
        entities: {
          ...fixture.entities,
          players: {
            "player-fixture": {
              ...fixture.entities.players["player-fixture"],
              profile: {
                ...fixture.entities.players["player-fixture"]!.profile,
                development: {
                  ...fixture.entities.players["player-fixture"]!.profile
                    .development,
                  potential,
                },
              },
            },
          },
        },
      })

      expect(invalidPotential.valid).toBe(false)
    }
  })

  it("validates structured nullable player identities", () => {
    const player = createPlayerContractFixture()

    expect(
      playerEntitySchema.safeParse({
        ...player,
        identity: { firstName: null, lastName: null },
      }).success
    ).toBe(true)

    for (const identity of [
      { firstName: "", lastName: "Player" },
      { firstName: "   ", lastName: null },
      { firstName: "Test" },
      "Test Player",
    ]) {
      expect(
        playerEntitySchema.safeParse({
          ...player,
          identity,
        }).success
      ).toBe(false)
    }

    const league = createFoundationLeague()
    league.entities.players[player.id] = player
    expect(deserializeLeagueDocument(serializeLeagueDocument(league))).toEqual(
      league
    )
  })

  it("validates player league statuses and referenced teams", () => {
    const fixture = createFoundationLeague()
    fixture.entities.teams["team-1"] = { id: "team-1", name: "Team 1" }
    const player = createPlayerContractFixture()

    for (const leagueStatus of [
      { kind: "unassigned" },
      { kind: "rostered", teamId: "team-1" },
      { kind: "re-signing", teamId: "team-1" },
      { kind: "free-agent" },
      { kind: "draft-prospect", draftClassId: "draft-1" },
    ]) {
      expect(
        playerEntitySchema.safeParse({
          ...player,
          leagueStatus,
        }).success
      ).toBe(true)
    }

    for (const leagueStatus of [
      { kind: "rostered", teamId: "" },
      { kind: "re-signing" },
      { kind: "free-agent", teamId: "team-1" },
      { kind: "draft-prospect", draftClassId: "" },
      { kind: "unknown" },
    ]) {
      expect(
        playerEntitySchema.safeParse({
          ...player,
          leagueStatus,
        }).success
      ).toBe(false)
    }

    fixture.entities.players[player.id] = {
      ...player,
      leagueStatus: { kind: "rostered", teamId: "missing-team" },
    }
    expect(validateLeagueDocument(fixture).valid).toBe(false)

    fixture.entities.players[player.id] = {
      ...player,
      leagueStatus: { kind: "re-signing", teamId: "team-1" },
    }
    expect(validateLeagueDocument(fixture).valid).toBe(true)
  })

  it("validates the standard player generation config", () => {
    const config = createStandardPlayerGenerationConfig()

    expect(playerGenerationConfigSchema.safeParse(config).success).toBe(true)
    expect(
      playerGenerationConfigSchema.safeParse({
        ...config,
        starTailFrequency: { ...config.starTailFrequency, above90: 2 },
      }).success
    ).toBe(false)
    expect(
      playerGenerationConfigSchema.safeParse({
        ...config,
        development: {
          ...config.development,
          potential: {
            ...config.development.potential,
            center: 26,
            maxHeadroom: 25,
          },
        },
      }).success
    ).toBe(false)
    expect(
      playerGenerationConfigSchema.safeParse({
        ...config,
        development: {
          ...config.development,
          potential: {
            ...config.development.potential,
            maxHeadroom: -1,
          },
        },
      }).success
    ).toBe(false)
  })
})
