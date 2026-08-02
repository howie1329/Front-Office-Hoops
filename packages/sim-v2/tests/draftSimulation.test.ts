import { describe, expect, it } from "vitest"

import {
  createDraftDecisionFixture,
  runDraftDecisionLab,
  STANDARD_DRAFT_DECISION_CONFIG,
} from "../src"

describe("draft decision lab", () => {
  it("creates a deterministic 75-player class and legal 60-pick draft", () => {
    const first = runDraftDecisionLab({ seed: "draft-test" })
    const second = runDraftDecisionLab({ seed: "draft-test" })

    expect(first.fixture.draftProspectIds).toHaveLength(75)
    expect(first.picks).toHaveLength(60)
    expect(first.diagnostics.legal).toBe(true)
    expect(first.picks).toEqual(second.picks)
    expect(first.contracts[0]?.source).toBe("rookie-scale")
    expect(first.contracts.at(-1)?.source).toBe("second-round-minimum")
    expect(first.diagnostics.averageBaseBoardRankOfPick["team:01"]).toBeGreaterThan(0)
    expect(first.diagnostics.tieBreakUsedRate).toBeGreaterThanOrEqual(0)
    expect(first.diagnostics.tieBreakUsedRate).toBeLessThanOrEqual(1)
    expect(first.picks.every((pick) => pick.baseBoardRank !== null && pick.baseBoardRank !== undefined)).toBe(true)
    expect(Object.values(first.fixture.boards).flatMap((board) => board.entries).every((entry) => Math.abs(entry.score.tieBreak) <= first.fixture.config.boardModel.tieBreakMaxAdjustment)).toBe(true)

    const labDefault = runDraftDecisionLab({ seed: "draft-lab-001" })
    expect(labDefault.picks).toHaveLength(60)
    expect(labDefault.diagnostics.legal).toBe(true)
  })

  it("keeps reports fixed while producing different private scout views", () => {
    const fixture = createDraftDecisionFixture({
      seed: "scout-test",
      config: STANDARD_DRAFT_DECISION_CONFIG,
      scoutTiers: { "team:01": "weak", "team:02": "strong" },
    })
    const playerId = fixture.draftProspectIds[0]
    expect(fixture.publicReports[playerId]?.scoutTier).toBe("public")
    expect(fixture.privateReports["team:01"]?.[playerId]?.scoutTier).toBe("weak")
    expect(fixture.privateReports["team:02"]?.[playerId]?.scoutTier).toBe("strong")
    expect(fixture.boards["team:01"]?.generatedAt).toBe("pre-draft")
    expect(fixture.boards["team:02"]?.generatedAt).toBe("pre-draft")

    for (const report of Object.values(fixture.privateReports).flatMap((teamReports) => Object.values(teamReports)).concat(Object.values(fixture.publicReports))) {
      for (const [key, range] of Object.entries(report.ranges)) {
        expect(range.min).toBeLessThanOrEqual(range.max)
        if (key === "weightPounds") expect(range.max).toBeLessThanOrEqual(500)
        else if (key.includes("Age")) expect(range.max).toBeLessThanOrEqual(50)
        else if (key.includes("Inches")) expect(range.max).toBeLessThanOrEqual(key === "heightInches" ? 96 : 110)
        else expect(range.max).toBeLessThanOrEqual(100)
      }
    }
    expect(fixture.publicMock.every((entry) => entry.projectedRange.min >= 1 && entry.projectedRange.max <= fixture.draftProspectIds.length)).toBe(true)
  })
})
