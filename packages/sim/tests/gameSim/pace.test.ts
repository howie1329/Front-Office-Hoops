import { describe, expect, it } from "vitest"

import { DEFAULT_PACE } from "@workspace/shared/constants"

import { createRng } from "../../src"
import { philosophyPaceModifier } from "../../src/gameSim/coachingPhilosophy"
import { estimatePossessions } from "../../src/gameSim/ratingHelpers"

describe("pace", () => {
  it("uses DEFAULT_PACE with head-coach pace modifiers", () => {
    const rng = createRng("pace-test")
    const slow = estimatePossessions(
      DEFAULT_PACE,
      philosophyPaceModifier("slow"),
      rng,
    )
    const fast = estimatePossessions(
      DEFAULT_PACE,
      philosophyPaceModifier("fast"),
      rng,
    )

    expect(philosophyPaceModifier("slow")).toBe(-4)
    expect(philosophyPaceModifier("fast")).toBe(4)
    expect(fast).toBeGreaterThan(slow)
    expect(slow).toBeGreaterThanOrEqual(80)
  })
})
