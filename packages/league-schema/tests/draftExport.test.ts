import { describe, expect, it } from "vitest"

import { runDraftDecisionLab } from "@workspace/sim-v2"

import {
  createDraftDecisionExport,
  validateDraftDecisionSafeExport,
} from "../src"

describe("draft decision exports", () => {
  it("keeps hidden truth and private boards out of the selected-team-safe profile", () => {
    const result = runDraftDecisionLab({ seed: "draft-export-test" })
    const safe = createDraftDecisionExport(result, {
      profile: "selected-team-safe",
      selectedTeamId: "team:01",
    })

    expect(validateDraftDecisionSafeExport(safe)).toEqual({ valid: true, issues: [] })
    expect(JSON.stringify(safe)).not.toContain("privateReports")
    expect(JSON.stringify(safe)).not.toContain("realizedPeakAbility")
  })
})
