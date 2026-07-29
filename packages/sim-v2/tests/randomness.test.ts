import { describe, expect, it } from "vitest"

import {
  createDeterministicRandom,
  createRandomSource,
} from "../src"

describe("RandomSource", () => {
  it("reproduces deterministic sequences for the same seed", () => {
    const first = createDeterministicRandom("ratings-seed-001")
    const second = createDeterministicRandom("ratings-seed-001")

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ])
  })

  it("keeps scoped streams reproducible and independent", () => {
    const first = createDeterministicRandom("league-seed")
    const second = createDeterministicRandom("league-seed")

    expect(first.fork("player-generation").next()).toBe(
      second.fork("player-generation").next(),
    )
    expect(first.fork("player-generation").next()).not.toBe(
      first.fork("injuries").next(),
    )
  })

  it("supports integer, normal, and zero-deviation draws", () => {
    const random = createDeterministicRandom("distribution-seed")

    for (let index = 0; index < 100; index += 1) {
      expect(random.int(2, 7)).toBeGreaterThanOrEqual(2)
      expect(random.int(2, 7)).toBeLessThanOrEqual(7)
      expect(Number.isFinite(random.normal(50, 10))).toBe(true)
    }

    expect(random.normal(50, 0)).toBe(50)
  })

  it("requires valid source configuration", () => {
    expect(() => createDeterministicRandom("")).toThrow()
    expect(() =>
      createRandomSource({ mode: "deterministic-lab" }),
    ).toThrow()
  })
})
