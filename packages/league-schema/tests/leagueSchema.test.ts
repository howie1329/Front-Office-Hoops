import { describe, expect, it } from "vitest"

import {
  createFoundationLeague,
  createPlayerContractFixture,
  createStandardPlayerGenerationConfig,
} from "@workspace/domain-v2"

import {
  CURRENT_SCHEMA_VERSION,
  LeagueDocumentValidationError,
  deserializeLeagueDocument,
  getLeagueDocumentJsonSchema,
  migrateLeagueDocument,
  previewLeagueImport,
  playerGenerationConfigSchema,
  playerEntitySchema,
  serializeLeagueDocument,
  validateLeagueDocument,
} from "../src"

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
