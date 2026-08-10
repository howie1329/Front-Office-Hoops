import { describe, expect, it } from "vitest"

import {
  runMarketEconomyCalibration,
  runMarketCalibration,
  serializeMarketCalibrationReport,
  STANDARD_MARKET_BENCHMARK_PROFILE,
} from "../src"
import { createDefaultContractMarketFixture } from "@workspace/sim-v2"

describe("market calibration", () => {
  it("produces deterministic aggregate metrics and benchmark evidence", () => {
    const options = {
      baseSeed: "market-calibration-test",
      count: 2,
      benchmarkProfile: STANDARD_MARKET_BENCHMARK_PROFILE,
    }
    const first = runMarketCalibration(options)
    const second = runMarketCalibration(options)

    expect(second).toEqual(first)
    expect(first.completed).toBe(2)
    expect(first.failed).toBe(0)
    expect(first.metrics.signedRate.count).toBe(2)
    expect(first.salaryByTier.depth.count).toBeGreaterThan(0)
    expect(first.benchmark?.checks.reconciliation?.passed).toBe(true)
    expect(JSON.parse(serializeMarketCalibrationReport(first))).toEqual(first)
  }, 20_000)

  it("retains failed seeds without discarding successful summaries", () => {
    const report = runMarketCalibration({
      baseSeed: "market-calibration-failure",
      count: 2,
      createFixture: (seed) => {
        if (seed.endsWith(":002")) throw new Error("simulated fixture failure")
        return createDefaultContractMarketFixture(seed)
      },
    })

    expect(report.completed).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.failures[0]).toMatchObject({
      seed: "market-calibration-failure:002",
      message: "simulated fixture failure",
      fixture: null,
    })
  }, 10_000)

  it("validates the batch boundary", () => {
    expect(() => runMarketCalibration({ baseSeed: "", count: 1 })).toThrow(
      "base seed"
    )
    expect(() =>
      runMarketCalibration({ baseSeed: "market", count: 501 })
    ).toThrow("1 to 500")
  })

  it("compares deterministic 30-season economy arms", () => {
    const report = runMarketEconomyCalibration("economy-calibration-test", 30)

    expect(report.passed).toBe(true)
    expect(report.arms).toHaveLength(5)
    expect(report.arms.every((arm) => arm.seasons.length === 30)).toBe(true)
    expect(report.comparisonChecks).toEqual({
      stableGrowthBelowStandard: true,
      highGrowthAboveStandard: true,
      lowTaxPressureAboveStandard: true,
      highTaxPressureBelowStandard: true,
    })
  })
})
