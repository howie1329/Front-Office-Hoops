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
