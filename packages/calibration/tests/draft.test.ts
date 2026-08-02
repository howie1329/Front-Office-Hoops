import { describe, expect, it } from "vitest"

import { runDraftDecisionBatch, serializeDraftDecisionBatch } from "../src"

describe("draft decision calibration", () => {
  it("aggregates deterministic draft runs by scout tier and outcome", () => {
    const report = runDraftDecisionBatch({
      baseSeed: "draft-calibration-test",
      count: 1,
      scoutTiers: {
        "team:01": "weak",
        "team:02": "strong",
      },
    })

    expect(report.completed).toBe(1)
    expect(report.metrics.legalRunRate.mean).toBe(1)
    expect(report.metrics.averageScoutAbsoluteError.weak.count).toBeGreaterThan(0)
    expect(report.metrics.averageFirstRoundPeakAbility.count).toBe(30)
    expect(JSON.parse(serializeDraftDecisionBatch(report)).schema).toBe("foh-draft-decision-calibration")
  })
})
