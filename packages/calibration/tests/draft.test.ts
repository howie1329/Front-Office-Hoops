import { describe, expect, it } from "vitest"

import {
  runDraftDecisionBatch,
  runDraftDecisionMatchedArms,
  serializeDraftDecisionBatch,
} from "../src"

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
    expect(report.metrics.averageBaseBoardRankOfPick.count).toBe(30)
    expect(report.metrics.tieBreakUsedRate.mean).toBeGreaterThanOrEqual(0)
    expect(JSON.parse(serializeDraftDecisionBatch(report)).schema).toBe("foh-draft-decision-calibration")
  })

  it("compares matched board-model arms on the same class and draft order", () => {
    const report = runDraftDecisionMatchedArms({
      seed: "draft-matched-test",
      arms: [
        { id: "balanced", teamModes: { "team:01": "balanced" } },
        { id: "rebuilding", teamModes: { "team:01": "rebuilding" } },
      ],
    })

    expect(report.arms).toHaveLength(2)
    expect(report.arms[0]?.result.fixture.draftProspectIds).toEqual(report.arms[1]?.result.fixture.draftProspectIds)
    expect(report.comparisons[0]?.armA).toBe("balanced")
    expect(report.comparisons[0]?.armB).toBe("rebuilding")
    expect(report.comparisons[0]?.averageScoreComponentDelta).toHaveProperty("expectedUpside")
  })
})
