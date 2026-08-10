import type { EconomyConfig } from "@workspace/domain-v2"
import {
  createEconomySnapshot,
  STANDARD_ECONOMY_CONFIG,
} from "@workspace/sim-v2"

export type MarketEconomySeasonEvidence = {
  season: number
  softCap: number
  taxLine: number
  hardCapLine: number
  minimumSalary: number
  maximumSalary: number
  rookieScaleTop: number
  taxLineCapRatio: number
  hardCapLineCapRatio: number
  minimumSalaryCapRatio: number
  maximumSalaryCapRatio: number
  rookieScaleCapRatio: number
}

export type MarketEconomyScenarioResult = {
  id: string
  label: string
  config: EconomyConfig
  seasons: MarketEconomySeasonEvidence[]
  metrics: {
    finalSoftCapMultiple: number
    taxLineCapRatioDrift: number
    hardCapLineCapRatioDrift: number
    minimumSalaryCapRatioDrift: number
    maximumSalaryCapRatioDrift: number
    rookieScaleCapRatioDrift: number
  }
  checks: {
    monotonicLines: boolean
    orderedLines: boolean
    boundedRelativeDrift: boolean
  }
  passed: boolean
}

export type MarketEconomyCalibrationReport = {
  schema: "foh-contract-market-economy-calibration"
  version: 1
  baseSeed: string
  seasons: number
  arms: MarketEconomyScenarioResult[]
  comparisonChecks: {
    stableGrowthBelowStandard: boolean
    highGrowthAboveStandard: boolean
    lowTaxPressureAboveStandard: boolean
    highTaxPressureBelowStandard: boolean
  }
  passed: boolean
  harnessNote: string
}

function withGrowthRate(
  id: string,
  rate: number
): { id: string; label: string; config: EconomyConfig } {
  const config = structuredClone(STANDARD_ECONOMY_CONFIG)
  config.presetId = id
  for (const key of Object.keys(config.annualGrowth) as Array<
    keyof EconomyConfig["annualGrowth"]
  >) {
    config.annualGrowth[key] = rate
  }
  return {
    id,
    label:
      id === "stable-growth"
        ? "Stable 2% growth"
        : id === "high-growth-stress"
          ? "High 7% growth stress"
          : "Standard 4% growth",
    config,
  }
}

function taxArm(
  id: "low-tax-pressure" | "high-tax-pressure",
  taxLineCapRatio: number,
  hardCapLineCapRatio: number
): { id: string; label: string; config: EconomyConfig } {
  const config = structuredClone(STANDARD_ECONOMY_CONFIG)
  config.presetId = id
  config.growth.taxLine = Math.round(config.growth.softCap * taxLineCapRatio)
  config.growth.hardCapLine = Math.round(
    config.growth.softCap * hardCapLineCapRatio
  )
  return {
    id,
    label: id === "low-tax-pressure" ? "Low tax pressure" : "High tax pressure",
    config,
  }
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

function drift(values: number[]): number {
  return values.length ? Math.max(...values) - Math.min(...values) : 0
}

function analyzeArm(input: {
  id: string
  label: string
  config: EconomyConfig
  seasons: number
}): MarketEconomyScenarioResult {
  const seasons = Array.from({ length: input.seasons }, (_, index) => {
    const snapshot = createEconomySnapshot(index + 1, input.config)
    const rookieScaleTop = snapshot.rookieScale[0]?.salary ?? 0
    return {
      season: snapshot.season,
      softCap: snapshot.softCap,
      taxLine: snapshot.taxLine,
      hardCapLine: snapshot.hardCapLine,
      minimumSalary: snapshot.minimumSalary,
      maximumSalary: snapshot.maximumSalary,
      rookieScaleTop,
      taxLineCapRatio: ratio(snapshot.taxLine, snapshot.softCap),
      hardCapLineCapRatio: ratio(snapshot.hardCapLine, snapshot.softCap),
      minimumSalaryCapRatio: ratio(snapshot.minimumSalary, snapshot.softCap),
      maximumSalaryCapRatio: ratio(snapshot.maximumSalary, snapshot.softCap),
      rookieScaleCapRatio: ratio(rookieScaleTop, snapshot.softCap),
    }
  })
  const first = seasons[0]!
  const last = seasons.at(-1)!
  const monotonicLines = seasons.every((season, index) => {
    const previous = seasons[index - 1]
    return (
      !previous ||
      (season.softCap >= previous.softCap &&
        season.taxLine >= previous.taxLine &&
        season.hardCapLine >= previous.hardCapLine &&
        season.minimumSalary >= previous.minimumSalary &&
        season.maximumSalary >= previous.maximumSalary &&
        season.rookieScaleTop >= previous.rookieScaleTop)
    )
  })
  const orderedLines = seasons.every(
    (season) =>
      season.minimumSalary <= season.maximumSalary &&
      season.softCap < season.taxLine &&
      season.taxLine < season.hardCapLine
  )
  const metrics = {
    finalSoftCapMultiple: ratio(last.softCap, first.softCap),
    taxLineCapRatioDrift: drift(
      seasons.map((season) => season.taxLineCapRatio)
    ),
    hardCapLineCapRatioDrift: drift(
      seasons.map((season) => season.hardCapLineCapRatio)
    ),
    minimumSalaryCapRatioDrift: drift(
      seasons.map((season) => season.minimumSalaryCapRatio)
    ),
    maximumSalaryCapRatioDrift: drift(
      seasons.map((season) => season.maximumSalaryCapRatio)
    ),
    rookieScaleCapRatioDrift: drift(
      seasons.map((season) => season.rookieScaleCapRatio)
    ),
  }
  const boundedRelativeDrift = Object.entries(metrics)
    .filter(([key]) => key.endsWith("RatioDrift"))
    .every(([, value]) => value <= 0.001)
  const checks = { monotonicLines, orderedLines, boundedRelativeDrift }
  return {
    id: input.id,
    label: input.label,
    config: input.config,
    seasons,
    metrics,
    checks,
    passed: Object.values(checks).every(Boolean),
  }
}

export function runMarketEconomyCalibration(
  baseSeed = "foh-v2-market-economy-baseline",
  seasons = 30
): MarketEconomyCalibrationReport {
  if (!baseSeed.trim())
    throw new Error("An economy calibration seed is required.")
  if (!Number.isInteger(seasons) || seasons < 2 || seasons > 100) {
    throw new RangeError(
      "Economy calibration seasons must be an integer from 2 to 100."
    )
  }
  const armInputs = [
    withGrowthRate("stable-growth", 0.02),
    withGrowthRate("standard-growth", 0.04),
    withGrowthRate("high-growth-stress", 0.07),
    taxArm("low-tax-pressure", 1.35, 1.55),
    taxArm("high-tax-pressure", 1.08, 1.28),
  ]
  const arms = armInputs.map((arm) => analyzeArm({ ...arm, seasons }))
  const byId = Object.fromEntries(arms.map((arm) => [arm.id, arm]))
  const stable = byId["stable-growth"]!
  const standard = byId["standard-growth"]!
  const high = byId["high-growth-stress"]!
  const lowTax = byId["low-tax-pressure"]!
  const highTax = byId["high-tax-pressure"]!
  const standardTaxRatio = standard.seasons[0]!.taxLineCapRatio
  const comparisonChecks = {
    stableGrowthBelowStandard:
      stable.metrics.finalSoftCapMultiple <
      standard.metrics.finalSoftCapMultiple,
    highGrowthAboveStandard:
      high.metrics.finalSoftCapMultiple > standard.metrics.finalSoftCapMultiple,
    lowTaxPressureAboveStandard:
      lowTax.seasons[0]!.taxLineCapRatio > standardTaxRatio,
    highTaxPressureBelowStandard:
      highTax.seasons[0]!.taxLineCapRatio < standardTaxRatio,
  }
  return {
    schema: "foh-contract-market-economy-calibration",
    version: 1,
    baseSeed,
    seasons,
    arms,
    comparisonChecks,
    passed:
      arms.every((arm) => arm.passed) &&
      Object.values(comparisonChecks).every(Boolean),
    harnessNote:
      "This report validates deterministic line growth and sensitivity. Payroll turnover, development, retirement, draft inflow, and tax incidence remain League Loop integration evidence.",
  }
}

export function serializeMarketEconomyCalibrationReport(
  report: MarketEconomyCalibrationReport
): string {
  return JSON.stringify(report, null, 2)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

export function renderMarketEconomyCalibrationMarkdown(
  report: MarketEconomyCalibrationReport
): string {
  return [
    "# Front Office Hoops v2 — Multi-Season Economy Baseline",
    "",
    `**Seed:** \`${report.baseSeed}\`  `,
    `**Horizon:** ${report.seasons} seasons  `,
    `**Result:** ${report.passed ? "PASS" : "FAIL"}`,
    "",
    "## Scenario arms",
    "",
    "| Arm | Final cap multiple | Tax/cap drift | Max/cap drift | Result |",
    "| --- | ---: | ---: | ---: | --- |",
    ...report.arms.map(
      (arm) =>
        `| ${arm.label} | ${arm.metrics.finalSoftCapMultiple.toFixed(2)}× | ${formatPercent(arm.metrics.taxLineCapRatioDrift)} | ${formatPercent(arm.metrics.maximumSalaryCapRatioDrift)} | ${arm.passed ? "Pass" : "Fail"} |`
    ),
    "",
    "## Comparison checks",
    "",
    ...Object.entries(report.comparisonChecks).map(
      ([check, passed]) => `- ${check}: ${passed ? "Pass" : "Fail"}`
    ),
    "",
    report.harnessNote,
    "",
  ].join("\n")
}
