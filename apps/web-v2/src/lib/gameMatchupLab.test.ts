import { describe, expect, it } from "vitest"

import {
  createDefaultGameMatchupLabFixture,
  migrateGameMatchupLabReport,
  runGameMatchupLab,
  serializeGameMatchupLabReport,
} from "./gameMatchupLab"

describe("game matchup lab report compatibility", () => {
  it("serializes current reports as version two", () => {
    const fixture = createDefaultGameMatchupLabFixture("report-version")
    const result = runGameMatchupLab(fixture)
    const report = JSON.parse(
      serializeGameMatchupLabReport(fixture, result)
    ) as { version: number; result: { version: number } }

    expect(report.version).toBe(2)
    expect(report.result.version).toBe(2)
  })

  it("migrates version one reports without lineup segments", () => {
    const fixture = createDefaultGameMatchupLabFixture("legacy-report")
    const result = runGameMatchupLab(fixture)
    const current = JSON.parse(
      serializeGameMatchupLabReport(fixture, result)
    ) as {
      schema: string
      version: number
      fixture: unknown
      result: Record<string, unknown>
    }
    const legacyResult: Record<string, unknown> = {
      ...current.result,
      version: 1,
    }
    const legacy = {
      ...current,
      version: 1,
      result: legacyResult,
    }
    delete legacy.result.lineupSegments

    const migrated = migrateGameMatchupLabReport(legacy)

    expect(migrated.version).toBe(2)
    expect(migrated.result.version).toBe(2)
    expect(migrated.result.lineupSegments).toEqual([])
  })
})
