import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { expect, it } from "vitest"

import {
  renderMarketEconomyCalibrationMarkdown,
  renderMarketCalibrationMarkdown,
  runMarketEconomyCalibration,
  runMarketCalibration,
  serializeMarketEconomyCalibrationReport,
  serializeMarketCalibrationReport,
  STANDARD_MARKET_BENCHMARK_PROFILE,
} from "../src"

it("writes the reproducible 100-seed market baseline", () => {
  const report = runMarketCalibration({
    baseSeed: "foh-v2-market-baseline",
    count: 100,
    benchmarkProfile: STANDARD_MARKET_BENCHMARK_PROFILE,
    onProgress: ({ completed, total }) => {
      if (completed % 10 === 0) {
        console.log(`Completed ${completed}/${total} market runs`)
      }
    },
  })
  const auditDirectory = fileURLToPath(
    new URL("../../../docs/v2/audits/", import.meta.url)
  )

  writeFileSync(
    `${auditDirectory}foh-v2-market-calibration-baseline.json`,
    serializeMarketCalibrationReport(report)
  )
  writeFileSync(
    `${auditDirectory}foh-v2-market-calibration-baseline.md`,
    renderMarketCalibrationMarkdown(report)
  )

  const economyReport = runMarketEconomyCalibration(
    "foh-v2-market-economy-baseline",
    30
  )
  writeFileSync(
    `${auditDirectory}foh-v2-market-economy-calibration-baseline.json`,
    serializeMarketEconomyCalibrationReport(economyReport)
  )
  writeFileSync(
    `${auditDirectory}foh-v2-market-economy-calibration-baseline.md`,
    renderMarketEconomyCalibrationMarkdown(economyReport)
  )

  expect(report.completed).toBe(100)
  expect(report.failed).toBe(0)
  expect(economyReport.passed).toBe(true)
}, 180_000)
