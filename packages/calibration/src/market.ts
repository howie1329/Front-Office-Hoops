import type {
  ContractMarketConfig,
  ContractMarketFixture,
  ContractOffer,
  EconomyConfig,
} from "@workspace/domain-v2"
import {
  calculateContractDemand,
  createDefaultContractMarketFixture,
  runFreeAgencySimulation,
  validateContractOffer,
} from "@workspace/sim-v2"
import type { FreeAgencySimulationResult } from "@workspace/sim-v2"

export type MarketCalibrationMetric = {
  count: number
  mean: number
  minimum: number
  maximum: number
  p10: number
  median: number
  p90: number
}

export type MarketCalibrationMetricKey =
  | "signedRate"
  | "offersPerFreeAgent"
  | "averageBidderCount"
  | "firstRoundSigningShare"
  | "cleanupSigningShare"
  | "lockoutRate"
  | "illegalDecisionRate"
  | "hardCapViolationRate"
  | "rosterCapacityViolationRate"
  | "reconciliationPassRate"
  | "explanationCoverageRate"
  | "taxTeamRate"
  | "payrollSpreadAsCap"
  | "minimumContractRate"
  | "maximumContractRate"
  | "valueSalaryCorrelation"
  | "averageSalaryCapRatio"
  | "averageSalaryDemandRatio"
  | "starUnsignedRate"
  | "rotationOrBetterUnsignedRate"
  | "meaningfulUnsignedTargets"
  | "targetConcentration"

export type MarketCalibrationRunSummary = Record<
  MarketCalibrationMetricKey,
  number
> & {
  seed: string
  freeAgentCount: number
  signedCount: number
  unsignedCount: number
  offerCount: number
  decisionCount: number
}

export type MarketCalibrationFailure = {
  seed: string
  message: string
  fixture: ContractMarketFixture | null
}

export type MarketCalibrationOutlier = {
  seed: string
  reasons: string[]
  summary: MarketCalibrationRunSummary
}

export type MarketBenchmarkTarget = {
  metric: MarketCalibrationMetricKey | "salaryTierOrderingRate"
  statistic: "mean" | "minimum" | "maximum" | "p10" | "median" | "p90" | "value"
  minimum?: number
  maximum?: number
}

export type MarketBenchmarkProfile = {
  id: string
  label: string
  targets: Record<string, MarketBenchmarkTarget>
}

export type MarketBenchmarkCheck = MarketBenchmarkTarget & {
  id: string
  actual: number
  passed: boolean
}

export type MarketBenchmarkReport = {
  profileId: string
  label: string
  passed: boolean
  checks: Record<string, MarketBenchmarkCheck>
}

type MarketQualityTier = "star" | "starter" | "rotation" | "depth"

export type MarketCalibrationReport = {
  schema: "foh-contract-market-calibration"
  version: 1
  baseSeed: string
  count: number
  completed: number
  failed: number
  cancelled: boolean
  effectiveConfig: {
    economy: EconomyConfig
    market: ContractMarketConfig
  } | null
  metrics: Record<MarketCalibrationMetricKey, MarketCalibrationMetric>
  salaryByTier: Record<MarketQualityTier, MarketCalibrationMetric>
  salaryTierOrderingRate: number
  benchmark: MarketBenchmarkReport | null
  runs: MarketCalibrationRunSummary[]
  failures: MarketCalibrationFailure[]
  outliers: MarketCalibrationOutlier[]
}

export type MarketCalibrationOptions = {
  baseSeed: string
  count: number
  createFixture?: (seed: string) => ContractMarketFixture
  benchmarkProfile?: MarketBenchmarkProfile
  onProgress?: (progress: {
    completed: number
    total: number
    label: string
  }) => void
  shouldCancel?: () => boolean
}

type RunAnalysis = {
  summary: MarketCalibrationRunSummary
  salaryByTier: Record<MarketQualityTier, number[]>
}

const QUALITY_TIERS: MarketQualityTier[] = [
  "depth",
  "rotation",
  "starter",
  "star",
]

const METRIC_KEYS: MarketCalibrationMetricKey[] = [
  "signedRate",
  "offersPerFreeAgent",
  "averageBidderCount",
  "firstRoundSigningShare",
  "cleanupSigningShare",
  "lockoutRate",
  "illegalDecisionRate",
  "hardCapViolationRate",
  "rosterCapacityViolationRate",
  "reconciliationPassRate",
  "explanationCoverageRate",
  "taxTeamRate",
  "payrollSpreadAsCap",
  "minimumContractRate",
  "maximumContractRate",
  "valueSalaryCorrelation",
  "averageSalaryCapRatio",
  "averageSalaryDemandRatio",
  "starUnsignedRate",
  "rotationOrBetterUnsignedRate",
  "meaningfulUnsignedTargets",
  "targetConcentration",
]

export const STANDARD_MARKET_BENCHMARK_PROFILE: MarketBenchmarkProfile = {
  id: "foh-standard-market-v1",
  label: "FOH standard contract market",
  targets: {
    reconciliation: {
      metric: "reconciliationPassRate",
      statistic: "minimum",
      minimum: 1,
    },
    legality: {
      metric: "illegalDecisionRate",
      statistic: "maximum",
      maximum: 0,
    },
    hardCap: {
      metric: "hardCapViolationRate",
      statistic: "maximum",
      maximum: 0,
    },
    rosterCapacity: {
      metric: "rosterCapacityViolationRate",
      statistic: "maximum",
      maximum: 0,
    },
    explanations: {
      metric: "explanationCoverageRate",
      statistic: "minimum",
      minimum: 1,
    },
    valueToSalary: {
      metric: "valueSalaryCorrelation",
      statistic: "median",
      minimum: 0.6,
    },
    salaryTierOrdering: {
      metric: "salaryTierOrderingRate",
      statistic: "value",
      minimum: 1,
    },
    signedPool: {
      metric: "signedRate",
      statistic: "median",
      minimum: 0.5,
      maximum: 1,
    },
    starAvailability: {
      metric: "starUnsignedRate",
      statistic: "p90",
      maximum: 0.1,
    },
    meaningfulUserTargets: {
      metric: "meaningfulUnsignedTargets",
      statistic: "median",
      minimum: 1,
    },
    demandContinuityLow: {
      metric: "averageSalaryDemandRatio",
      statistic: "p10",
      minimum: 0.75,
    },
    demandContinuityHigh: {
      metric: "averageSalaryDemandRatio",
      statistic: "p90",
      maximum: 1.25,
    },
    bidderCoverage: {
      metric: "averageBidderCount",
      statistic: "median",
      minimum: 0.5,
      maximum: 6,
    },
    taxPressure: {
      metric: "taxTeamRate",
      statistic: "median",
      maximum: 0.75,
    },
  },
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction))
  )
  return sorted[index] ?? 0
}

function metric(values: number[]): MarketCalibrationMetric {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
  return {
    count: sorted.length,
    mean: average(sorted),
    minimum: sorted[0] ?? 0,
    maximum: sorted.at(-1) ?? 0,
    p10: percentile(sorted, 0.1),
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  }
}

function correlation(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length < 2) return 0
  const leftMean = average(left)
  const rightMean = average(right)
  let covariance = 0
  let leftVariance = 0
  let rightVariance = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean
    const rightDelta = (right[index] ?? 0) - rightMean
    covariance += leftDelta * rightDelta
    leftVariance += leftDelta ** 2
    rightVariance += rightDelta ** 2
  }
  const denominator = Math.sqrt(leftVariance * rightVariance)
  return denominator > 0 ? covariance / denominator : 0
}

function countActionableUserTargets(
  fixture: ContractMarketFixture,
  playerIds: string[],
  demandByPlayer: Record<string, ReturnType<typeof calculateContractDemand>>
): number {
  const targetCounts = Object.keys(fixture.teamContexts).map((teamId) => {
    return playerIds.filter((playerId) => {
      const demand = demandByPlayer[playerId]
      if (!demand) return false
      const years = demand.preferredYears
      const firstYearSalary = demand.projectedAnnualValue
      const offer: ContractOffer = {
        id: `${fixture.seed}:calibration-user-offer:${teamId}:${playerId}`,
        playerId,
        teamId,
        season: fixture.season,
        phase: "free-agency",
        round: 1,
        annualSalary: Array.from(
          { length: years },
          (_, index) =>
            Math.round(
              (firstYearSalary *
                (1 + fixture.economy.config.standardRaiseRate) ** index) /
                10_000
            ) * 10_000
        ),
        years,
        fullyGuaranteed: true,
        source: "user",
      }
      return validateContractOffer(fixture, offer).valid
    }).length
  })
  return average(targetCounts)
}

function analyzeRun(
  fixture: ContractMarketFixture,
  result: FreeAgencySimulationResult
): RunAnalysis {
  const allOffers = [
    ...result.rounds.flatMap((round) => round.offers),
    ...result.cleanup.offers,
  ]
  const allDecisions = [
    ...result.rounds.flatMap((round) => round.decisions),
    ...result.cleanup.decisions,
  ]
  const freeAgentCount = fixture.actualFreeAgentIds.length
  const signedCount = result.signedContracts.length
  const unsignedCount = result.unsignedPlayerIds.length
  const signedIds = new Set(
    result.signedContracts.map((contract) => contract.playerId)
  )
  const unsignedIds = new Set(result.unsignedPlayerIds)
  const demandByPlayer = Object.fromEntries(
    fixture.actualFreeAgentIds.map((playerId) => [
      playerId,
      calculateContractDemand(fixture, playerId),
    ])
  )
  const tierByPlayer = Object.fromEntries(
    Object.entries(demandByPlayer).map(([playerId, demand]) => [
      playerId,
      demand.comparableTier,
    ])
  ) as Record<string, MarketQualityTier>
  const salaryByTier: Record<MarketQualityTier, number[]> = {
    star: [],
    starter: [],
    rotation: [],
    depth: [],
  }
  const signedValues: number[] = []
  const signedSalaries: number[] = []
  const salaryDemandRatios: number[] = []

  for (const contract of result.signedContracts) {
    const salary = contract.annualSalary[0] ?? 0
    const value = fixture.values[contract.playerId]?.rawValue
    const demand = demandByPlayer[contract.playerId]
    const tier = tierByPlayer[contract.playerId]
    if (typeof value === "number") {
      signedValues.push(value)
      signedSalaries.push(salary)
    }
    if (demand) {
      salaryDemandRatios.push(safeDivide(salary, demand.projectedAnnualValue))
    }
    if (tier) salaryByTier[tier].push(salary / fixture.economy.softCap)
  }

  const starIds = fixture.actualFreeAgentIds.filter(
    (playerId) => tierByPlayer[playerId] === "star"
  )
  const rotationOrBetterIds = fixture.actualFreeAgentIds.filter((playerId) =>
    ["star", "starter", "rotation"].includes(tierByPlayer[playerId] ?? "")
  )
  const meaningfulUnsignedTargets = rotationOrBetterIds.filter((playerId) =>
    unsignedIds.has(playerId)
  ).length
  const actionableUserTargets = countActionableUserTargets(
    fixture,
    rotationOrBetterIds,
    demandByPlayer
  )
  const initialTeamContexts = fixture.teamContexts
  const finalTeamContexts = result.finalFixture.teamContexts
  const finalTeams = Object.values(finalTeamContexts)
  const payrolls = finalTeams.map((team) => team.payroll)
  const capacityViolations = finalTeams.filter((team) => {
    const initial = initialTeamContexts[team.team.id]
    return (
      !initial ||
      team.rosteredPlayerCount >
        initial.rosteredPlayerCount + initial.marketRosterSlots ||
      team.reservedRosterSlots !== 0 ||
      team.reservedSalary !== 0
    )
  }).length
  const hardCapViolations = result.finalFixture.economy.hardCapTriggered
    ? finalTeams.filter(
        (team) => team.payroll > result.finalFixture.economy.hardCapLine
      ).length
    : 0
  const uniqueSignedIds = new Set(
    result.signedContracts.map((contract) => contract.playerId)
  )
  const reconciliationPassed =
    signedCount + unsignedCount === freeAgentCount &&
    uniqueSignedIds.size === signedCount &&
    fixture.actualFreeAgentIds.every(
      (playerId) => signedIds.has(playerId) !== unsignedIds.has(playerId)
    )
  const coverageTargets = result.playerCoverage.map(
    (coverage) => coverage.targetedRounds.length
  )
  const totalTargets = coverageTargets.reduce((sum, count) => sum + count, 0)
  const firstRoundSignings = result.rounds[0]?.acceptedPlayerIds.length ?? 0
  const minimumContracts = result.signedContracts.filter(
    (contract) =>
      (contract.annualSalary[0] ?? 0) <= fixture.economy.minimumSalary
  ).length
  const maximumContracts = result.signedContracts.filter(
    (contract) =>
      (contract.annualSalary[0] ?? 0) >= fixture.economy.maximumSalary
  ).length

  return {
    summary: {
      seed: fixture.seed,
      freeAgentCount,
      signedCount,
      unsignedCount,
      offerCount: allOffers.length,
      decisionCount: allDecisions.length,
      signedRate: safeDivide(signedCount, freeAgentCount),
      offersPerFreeAgent: safeDivide(allOffers.length, freeAgentCount),
      averageBidderCount: average(
        result.playerCoverage.map((coverage) => coverage.teamCount)
      ),
      firstRoundSigningShare: safeDivide(firstRoundSignings, signedCount),
      cleanupSigningShare: safeDivide(
        result.cleanup.acceptedPlayerIds.length,
        signedCount
      ),
      lockoutRate: safeDivide(
        allDecisions.filter(
          (decision) => decision.decision === "refuse-further-negotiation"
        ).length,
        allDecisions.length
      ),
      illegalDecisionRate: safeDivide(
        allDecisions.filter(
          (decision) => decision.decision === "accept" && !decision.legal.valid
        ).length,
        allDecisions.filter((decision) => decision.decision === "accept").length
      ),
      hardCapViolationRate: safeDivide(hardCapViolations, finalTeams.length),
      rosterCapacityViolationRate: safeDivide(
        capacityViolations,
        finalTeams.length
      ),
      reconciliationPassRate: reconciliationPassed ? 1 : 0,
      explanationCoverageRate: safeDivide(
        allDecisions.filter(
          (decision) =>
            decision.reasonCodes.length > 0 &&
            decision.summary.trim().length > 0
        ).length,
        allDecisions.length
      ),
      taxTeamRate: safeDivide(
        finalTeams.filter(
          (team) => team.payroll > result.finalFixture.economy.taxLine
        ).length,
        finalTeams.length
      ),
      payrollSpreadAsCap: safeDivide(
        (payrolls.length ? Math.max(...payrolls) : 0) -
          (payrolls.length ? Math.min(...payrolls) : 0),
        fixture.economy.softCap
      ),
      minimumContractRate: safeDivide(minimumContracts, signedCount),
      maximumContractRate: safeDivide(maximumContracts, signedCount),
      valueSalaryCorrelation: correlation(signedValues, signedSalaries),
      averageSalaryCapRatio: average(
        signedSalaries.map((salary) => salary / fixture.economy.softCap)
      ),
      averageSalaryDemandRatio: average(salaryDemandRatios),
      starUnsignedRate: safeDivide(
        starIds.filter((playerId) => unsignedIds.has(playerId)).length,
        starIds.length
      ),
      rotationOrBetterUnsignedRate: safeDivide(
        meaningfulUnsignedTargets,
        rotationOrBetterIds.length
      ),
      meaningfulUnsignedTargets: actionableUserTargets,
      targetConcentration: safeDivide(
        coverageTargets.length ? Math.max(...coverageTargets) : 0,
        totalTargets
      ),
    },
    salaryByTier,
  }
}

function salaryTierOrderingRate(
  salaryByTier: Record<MarketQualityTier, MarketCalibrationMetric>
): number {
  let comparisons = 0
  let ordered = 0
  for (let index = 0; index < QUALITY_TIERS.length - 1; index += 1) {
    const lower = salaryByTier[QUALITY_TIERS[index]!]
    const higher = salaryByTier[QUALITY_TIERS[index + 1]!]
    if (lower.count === 0 || higher.count === 0) continue
    comparisons += 1
    if (lower.median <= higher.median) ordered += 1
  }
  return safeDivide(ordered, comparisons)
}

function buildBenchmark(
  metrics: Record<MarketCalibrationMetricKey, MarketCalibrationMetric>,
  tierOrderingRate: number,
  profile: MarketBenchmarkProfile
): MarketBenchmarkReport {
  const checks = Object.fromEntries(
    Object.entries(profile.targets).map(([id, target]) => {
      const actual =
        target.metric === "salaryTierOrderingRate"
          ? tierOrderingRate
          : metrics[target.metric][
              target.statistic as keyof MarketCalibrationMetric
            ]
      const numericActual = typeof actual === "number" ? actual : 0
      const passed =
        (target.minimum === undefined || numericActual >= target.minimum) &&
        (target.maximum === undefined || numericActual <= target.maximum)
      return [
        id,
        {
          id,
          ...target,
          actual: numericActual,
          passed,
        } satisfies MarketBenchmarkCheck,
      ]
    })
  )
  return {
    profileId: profile.id,
    label: profile.label,
    passed: Object.values(checks).every((check) => check.passed),
    checks,
  }
}

function identifyOutliers(
  runs: MarketCalibrationRunSummary[]
): MarketCalibrationOutlier[] {
  return runs
    .map((summary) => {
      const reasons: string[] = []
      if (summary.reconciliationPassRate < 1)
        reasons.push("market-reconciliation-failed")
      if (summary.illegalDecisionRate > 0)
        reasons.push("illegal-contract-accepted")
      if (summary.hardCapViolationRate > 0)
        reasons.push("active-hard-cap-violation")
      if (summary.rosterCapacityViolationRate > 0)
        reasons.push("roster-capacity-violation")
      if (summary.starUnsignedRate > 0.1)
        reasons.push("unexpected-star-availability")
      if (summary.valueSalaryCorrelation < 0.5)
        reasons.push("weak-value-salary-correlation")
      if (summary.meaningfulUnsignedTargets < 1)
        reasons.push("no-actionable-user-targets")
      return { seed: summary.seed, reasons, summary }
    })
    .filter((outlier) => outlier.reasons.length > 0)
    .sort(
      (left, right) =>
        right.reasons.length - left.reasons.length ||
        left.seed.localeCompare(right.seed)
    )
    .slice(0, 10)
}

export function runMarketCalibration(
  options: MarketCalibrationOptions
): MarketCalibrationReport {
  if (!options.baseSeed.trim()) {
    throw new Error("A market calibration base seed is required.")
  }
  if (
    !Number.isInteger(options.count) ||
    options.count < 1 ||
    options.count > 500
  ) {
    throw new RangeError(
      "Market calibration count must be an integer from 1 to 500."
    )
  }

  const createFixture =
    options.createFixture ?? createDefaultContractMarketFixture
  const runs: MarketCalibrationRunSummary[] = []
  const failures: MarketCalibrationFailure[] = []
  const metricValues = Object.fromEntries(
    METRIC_KEYS.map((key) => [key, [] as number[]])
  ) as Record<MarketCalibrationMetricKey, number[]>
  const tierSalaryValues: Record<MarketQualityTier, number[]> = {
    star: [],
    starter: [],
    rotation: [],
    depth: [],
  }
  let effectiveConfig: MarketCalibrationReport["effectiveConfig"] = null
  let cancelled = false

  for (let index = 0; index < options.count; index += 1) {
    if (options.shouldCancel?.()) {
      cancelled = true
      break
    }
    const seed = `${options.baseSeed}:${String(index + 1).padStart(3, "0")}`
    let fixture: ContractMarketFixture | null = null
    try {
      fixture = createFixture(seed)
      effectiveConfig ??= {
        economy: structuredClone(fixture.economy.config),
        market: structuredClone(fixture.config),
      }
      const result = runFreeAgencySimulation(fixture)
      const analysis = analyzeRun(fixture, result)
      runs.push(analysis.summary)
      for (const key of METRIC_KEYS) {
        metricValues[key].push(analysis.summary[key])
      }
      for (const tier of QUALITY_TIERS) {
        tierSalaryValues[tier].push(...analysis.salaryByTier[tier])
      }
    } catch (error) {
      failures.push({
        seed,
        message:
          error instanceof Error
            ? error.message
            : "Unknown market run failure.",
        fixture,
      })
    }
    options.onProgress?.({
      completed: index + 1,
      total: options.count,
      label: `Market run ${index + 1} of ${options.count}`,
    })
  }

  const metrics = Object.fromEntries(
    METRIC_KEYS.map((key) => [key, metric(metricValues[key])])
  ) as Record<MarketCalibrationMetricKey, MarketCalibrationMetric>
  const salaryByTier = Object.fromEntries(
    QUALITY_TIERS.map((tier) => [tier, metric(tierSalaryValues[tier])])
  ) as Record<MarketQualityTier, MarketCalibrationMetric>
  const orderingRate = salaryTierOrderingRate(salaryByTier)

  return {
    schema: "foh-contract-market-calibration",
    version: 1,
    baseSeed: options.baseSeed,
    count: options.count,
    completed: runs.length,
    failed: failures.length,
    cancelled,
    effectiveConfig,
    metrics,
    salaryByTier,
    salaryTierOrderingRate: orderingRate,
    benchmark: options.benchmarkProfile
      ? buildBenchmark(metrics, orderingRate, options.benchmarkProfile)
      : null,
    runs,
    failures,
    outliers: identifyOutliers(runs),
  }
}

export function serializeMarketCalibrationReport(
  report: MarketCalibrationReport
): string {
  return JSON.stringify(report, null, 2)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function renderMarketCalibrationMarkdown(
  report: MarketCalibrationReport
): string {
  const checks = Object.values(report.benchmark?.checks ?? {})
  const lines = [
    "# Front Office Hoops v2 — Market Calibration Baseline",
    "",
    `**Seed:** \`${report.baseSeed}\`  `,
    `**Runs:** ${report.completed}/${report.count} completed; ${report.failed} failed  `,
    `**Benchmark:** ${report.benchmark?.passed ? "PASS" : "FAIL"}`,
    "",
    "## Benchmark checks",
    "",
    "| Check | Actual | Range | Result |",
    "| --- | ---: | ---: | --- |",
    ...checks.map((check) => {
      const range = `${check.minimum ?? "—"} to ${check.maximum ?? "—"}`
      return `| ${check.id} | ${check.actual.toFixed(4)} | ${range} | ${check.passed ? "Pass" : "Fail"} |`
    }),
    "",
    "## Market summary",
    "",
    `- Median signed rate: ${formatPercent(report.metrics.signedRate.median)}`,
    `- Median value/salary correlation: ${report.metrics.valueSalaryCorrelation.median.toFixed(3)}`,
    `- Median actionable user targets: ${report.metrics.meaningfulUnsignedTargets.median.toFixed(1)}`,
    `- Median tax-team rate: ${formatPercent(report.metrics.taxTeamRate.median)}`,
    `- Maximum illegal-decision rate: ${formatPercent(report.metrics.illegalDecisionRate.maximum)}`,
    `- Maximum roster-capacity violation rate: ${formatPercent(report.metrics.rosterCapacityViolationRate.maximum)}`,
    "",
    "## Salary by quality tier",
    "",
    "| Tier | Count | Median cap share | P10 | P90 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...QUALITY_TIERS.map((tier) => {
      const value = report.salaryByTier[tier]
      return `| ${tier} | ${value.count} | ${formatPercent(value.median)} | ${formatPercent(value.p10)} | ${formatPercent(value.p90)} |`
    }),
    "",
    "## Retained outliers",
    "",
    ...(report.outliers.length
      ? report.outliers.map(
          (outlier) => `- \`${outlier.seed}\`: ${outlier.reasons.join(", ")}`
        )
      : ["- None."]),
    "",
    "The JSON companion report contains every per-seed summary, effective settings, failures, and reproducible outlier seeds.",
    "Tax frequency is observational in this external-free-agent arm; re-signing and integrated economy scenarios own the minimum tax-pressure gate.",
    "",
  ]
  return lines.join("\n")
}
