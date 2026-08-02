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
  })
})
