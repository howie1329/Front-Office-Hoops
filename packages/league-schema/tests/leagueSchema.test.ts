import { describe, expect, it } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"

import {
  CURRENT_SCHEMA_VERSION,
  LeagueDocumentValidationError,
  deserializeLeagueDocument,
  migrateLeagueDocument,
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
      "No migration is available",
    )
  })

  it("rejects malformed JSON", () => {
    expect(() => deserializeLeagueDocument("not-json")).toThrow(
      LeagueDocumentValidationError,
    )
  })
})
