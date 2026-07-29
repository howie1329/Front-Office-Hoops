import { createStandardPlayerGenerationConfig } from "@workspace/domain-v2"
import { describe, expect, it } from "vitest"

import {
  createHistogram,
  createLabPlayers,
  getLabMetric,
  serializeLabReport,
  summarizeLabPlayers,
  validateLabConfig,
} from "./playerGenerationLab"

describe("player generation lab helpers", () => {
  it("keeps seeded batches reproducible and labels players by index", () => {
    const options = {
      seed: "lab-seed",
      mode: "batch" as const,
      count: 3,
      sampleIndex: 1,
      config: createStandardPlayerGenerationConfig(),
    }

    const first = createLabPlayers(options)
    const second = createLabPlayers(options)

    expect(first).toEqual(second)
    expect(first.map((result) => result.player.name)).toEqual([
      "Player 001",
      "Player 002",
      "Player 003",
    ])
  })

  it("supports single-sample mode without changing the label sequence", () => {
    const results = createLabPlayers({
      seed: "lab-seed",
      mode: "single",
      count: 25,
      sampleIndex: 7,
      config: createStandardPlayerGenerationConfig(),
    })

    expect(results).toHaveLength(1)
    expect(results[0].player.name).toBe("Player 007")
    expect(getLabMetric("potential").getValue(results[0])).toBe(
      results[0].player.profile.development.potential
    )
  })

  it("summarizes talent tiers and trait rate", () => {
    const results = createLabPlayers({
      seed: "summary-seed",
      mode: "batch",
      count: 20,
      sampleIndex: 1,
      config: createStandardPlayerGenerationConfig(),
    })
    const summary = summarizeLabPlayers(results)

    expect(summary.count).toBe(20)
    expect(summary.minimumTalent).toBeLessThanOrEqual(summary.averageTalent)
    expect(summary.averageTalent).toBeLessThanOrEqual(summary.maximumTalent)
    expect(summary.averageCurrentAbility).toBeGreaterThan(0)
    expect(summary.averagePotential).toBeGreaterThanOrEqual(
      summary.averageCurrentAbility
    )
    expect(summary.averagePotentialGap).toBeGreaterThanOrEqual(0)
    expect(
      Object.values(summary.tierCounts).reduce((sum, count) => sum + count, 0)
    ).toBe(20)
    expect(summary.primaryPositionCounts).not.toEqual({})
    expect(summary.primaryArchetypeCounts).not.toEqual({})
    expect(summary.secondaryPositionRate).toBeGreaterThanOrEqual(0)
    expect(summary.secondaryArchetypeRate).toBeGreaterThanOrEqual(0)
    expect(summary.traitRate).toBeGreaterThanOrEqual(0)
    expect(summary.traitRate).toBeLessThanOrEqual(1)
  })

  it("creates complete histograms and flags inconsistent tail settings", () => {
    expect(createHistogram([1, 2, 3], 2)).toEqual([
      { label: "1–2", count: 1 },
      { label: "2–3", count: 2 },
    ])

    const config = createStandardPlayerGenerationConfig()
    config.starTailFrequency.above70 = 0.1
    config.starTailFrequency.above80 = 0.2

    expect(validateLabConfig(config)).toContain(
      "70+ frequency must be at least as high as 80+ frequency."
    )
  })

  it("exports version three reports with anchored potential diagnostics", () => {
    const options = {
      seed: "export-seed",
      mode: "single" as const,
      count: 1,
      sampleIndex: 1,
      config: createStandardPlayerGenerationConfig(),
    }
    const results = createLabPlayers(options)
    const report = JSON.parse(serializeLabReport(options, results)) as {
      version: number
      results: typeof results
    }

    expect(report.version).toBe(4)
    expect(report.results[0].player.profile.development.potential).toBe(
      results[0].player.profile.development.potential
    )
    expect(report.results[0].diagnostics.potentialBase).toBe(
      Math.max(
        report.results[0].diagnostics.currentAbility,
        report.results[0].diagnostics.latentTalent
      )
    )
    expect(getLabMetric("potentialGap").getValue(report.results[0])).toBe(
      report.results[0].player.profile.development.potential -
        report.results[0].diagnostics.currentAbility
    )
  })
})
