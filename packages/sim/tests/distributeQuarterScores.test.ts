import { describe, expect, it } from "vitest"

import { createRng } from "../src/rng"
import { distributeQuarterScores } from "../src/distributeQuarterScores"

function sumQuarters(quarters: number[]): number {
  return quarters.reduce((total, value) => total + value, 0)
}

describe("distributeQuarterScores", () => {
  it.each([0, 87, 108, 125])(
    "sums quarters to the final score for %i points",
    (finalScore) => {
      const quarters = distributeQuarterScores(finalScore, createRng(`sum-${finalScore}`))

      expect(sumQuarters(quarters)).toBe(finalScore)
    },
  )

  it("never returns negative quarter values", () => {
    const quarters = distributeQuarterScores(108, createRng("non-negative"))

    for (const value of quarters) {
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it("is deterministic for the same score and rng sequence", () => {
    const first = distributeQuarterScores(108, createRng("quarter-determinism"))
    const second = distributeQuarterScores(108, createRng("quarter-determinism"))

    expect(second).toEqual(first)
  })

  it("usually changes quarter splits for different rng sequences", () => {
    const results = ["alpha", "beta", "gamma", "delta"].map((seed) =>
      distributeQuarterScores(108, createRng(seed)),
    )

    const uniqueSplits = new Set(results.map((quarters) => quarters.join("-")))
    expect(uniqueSplits.size).toBeGreaterThan(1)
  })
})
