import { describe, expect, it } from "vitest"

import { createPlayerContractFixture } from "@workspace/domain-v2"

import { createDeterministicRandom, evaluatePlayerRetirement } from "../src"
import type { RandomSource } from "../src"

describe("evaluatePlayerRetirement", () => {
  it("keeps young players ineligible and exposes factor explanations", () => {
    const evaluation = evaluatePlayerRetirement({
      player: createPlayerContractFixture({ age: 24 }),
      context: { season: 1 },
      random: createDeterministicRandom("young-retirement"),
    })

    expect(evaluation.eligible).toBe(false)
    expect(evaluation.retired).toBe(false)
    expect(evaluation.factors.map((factor) => factor.key)).toContain("age")
  })

  it("makes retirement final when the hazard roll fires", () => {
    const alwaysZeroRandom: RandomSource = {
      next: () => 0,
      int: () => 0,
      normal: (mean) => mean,
      fork() {
        return this
      },
    }
    const evaluation = evaluatePlayerRetirement({
      player: createPlayerContractFixture({ age: 48 }),
      context: {
        season: 20,
        gamesPlayed: 5,
        gamesScheduled: 82,
        injuryHistory: 1,
        health: 20,
        opportunity: 0,
        contractOpportunity: 0,
      },
      random: alwaysZeroRandom,
    })

    expect(evaluation.eligible).toBe(true)
    expect(evaluation.retired).toBe(true)
    expect(evaluation.probability).toBeGreaterThan(0)
    expect(evaluation.factors).toHaveLength(7)
  })
})
