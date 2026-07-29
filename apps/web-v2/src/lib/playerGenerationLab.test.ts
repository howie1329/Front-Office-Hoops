import { createStandardPlayerGenerationConfig } from "@workspace/domain-v2"
import { describe, expect, it } from "vitest"

import {
  createLabPresetDefaults,
  createHistogram,
  createLabPlayers,
  getLabMetric,
  getLabPlayerDisplayName,
  getLabPlayerIndex,
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
      identityMode: "generated" as const,
      presetId: "initial-roster" as const,
      basePresetId: "initial-roster" as const,
      config: createStandardPlayerGenerationConfig(),
    }

    const first = createLabPlayers(options)
    const second = createLabPlayers(options)

    expect(first).toEqual(second)
    expect(first.map(getLabPlayerIndex)).toEqual([1, 2, 3])
    expect(first.map(getLabPlayerDisplayName).every(Boolean)).toBe(true)
    expect(first.every((result) => result.player.identity.firstName)).toBe(true)
  })

  it("supports single-sample placeholder mode without storing its label", () => {
    const results = createLabPlayers({
      seed: "lab-seed",
      mode: "single",
      count: 25,
      sampleIndex: 7,
      identityMode: "none",
      presetId: "initial-roster",
      basePresetId: "initial-roster",
      config: createStandardPlayerGenerationConfig(),
    })

    expect(results).toHaveLength(1)
    expect(results[0].player.identity).toEqual({
      firstName: null,
      lastName: null,
    })
    expect(getLabPlayerDisplayName(results[0])).toBe("Player 007")
    expect(getLabPlayerIndex(results[0])).toBe(7)
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
      identityMode: "generated",
      presetId: "initial-roster",
      basePresetId: "initial-roster",
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

  it("exports version six reports with preset and population metadata", () => {
    const options = {
      seed: "export-seed",
      mode: "single" as const,
      count: 1,
      sampleIndex: 1,
      identityMode: "generated" as const,
      presetId: "draft-class" as const,
      basePresetId: "draft-class" as const,
      config: createStandardPlayerGenerationConfig(),
    }
    const results = createLabPlayers(options)
    const report = JSON.parse(serializeLabReport(options, results)) as {
      version: number
      identityMode: string
      identityGeneratorVersion: number
      context: { kind: string; id: string }
      population: {
        count: number
        startIndex: number
        identityMode: string
        identityGeneratorVersion: number
      }
      results: typeof results
    }

    expect(report.version).toBe(6)
    expect(report.identityMode).toBe("generated")
    expect(report.identityGeneratorVersion).toBe(1)
    expect(report).toMatchObject({
      presetId: "draft-class",
      basePresetId: "draft-class",
      populationPresetVersion: 1,
    })
    expect(report.context).toEqual({
      kind: "lab",
      id: "player-generation-lab",
    })
    expect(report.population).toMatchObject({
      count: 1,
      startIndex: 1,
      identityMode: "generated",
      identityGeneratorVersion: 1,
    })
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

  it("loads shared production defaults for each lab preset", () => {
    expect(createLabPresetDefaults("initial-roster")).toMatchObject({
      count: 450,
      config: { age: { min: 19, max: 34 } },
    })
    expect(createLabPresetDefaults("initial-free-agents")).toMatchObject({
      count: 100,
      config: { talentDistribution: { center: 43 } },
    })
    expect(createLabPresetDefaults("draft-class")).toMatchObject({
      count: 90,
      config: { age: { min: 18, max: 23 } },
    })
  })
})
