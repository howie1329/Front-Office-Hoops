import type {
  GameMatchupFixture,
  GameResult,
  GameSimulationConfig,
} from "@workspace/domain-v2"
import {
  gameMatchupFixtureSchema,
  gameSimulationConfigSchema,
  matchupBatchReportSchema,
} from "@workspace/league-schema"
import {
  resolveGameSimulationConfig,
  simulateGameMatchup,
} from "@workspace/sim-v2"

import type {
  CalibrationBenchmarkProfile,
  CalibrationTarget,
} from "./benchmarkProfiles"

export { MODERN_BALANCED_BENCHMARK_PROFILE } from "./benchmarkProfiles"
export type {
  CalibrationBenchmarkProfile,
  CalibrationTarget,
} from "./benchmarkProfiles"
export {
  DEFAULT_SLIDER_SENSITIVITY_EXPECTATIONS,
  runSliderSensitivity,
  serializeSliderSensitivityReport,
} from "./sensitivity"
export {
  runSeasonBatch,
  serializeSeasonBatchReport,
} from "./season"
export type {
  SeasonBatchMetric,
  SeasonBatchOptions,
  SeasonBatchReport,
} from "./season"
export type {
  SensitivityClassification,
  SensitivityDirection,
  SensitivityExpectation,
  SliderSensitivityArm,
  SliderSensitivityOptions,
  SliderSensitivityReport,
  SliderSensitivityResult,
  SliderSensitivityScenario,
  SliderSensitivityScenarioResult,
} from "./sensitivity"

export type CalibrationProgress = {
  completed: number
  total: number
  label: string
}

export type CalibrationMetric = {
  count: number
  mean: number
  minimum: number
  maximum: number
  p10: number
  median: number
  p90: number
}

export type CalibrationBenchmarkCheck = {
  metric: string
  actual: CalibrationMetric
  target: CalibrationTarget
  passed: boolean
}

export type CalibrationBenchmarkReport = {
  profileId: string
  label: string
  passed: boolean
  checks: Record<string, CalibrationBenchmarkCheck>
}

export type CalibrationFailure = {
  seed: string
  fixture: GameMatchupFixture
  result: GameResult
}

export type MatchupBatchReport = {
  schema: "foh-matchup-calibration"
  version: 2
  baseSeed: string
  count: number
  completed: number
  failed: number
  effectiveConfig: GameSimulationConfig
  metrics: Record<string, CalibrationMetric>
  benchmark: CalibrationBenchmarkReport | null
  results: GameResult[]
  failures: CalibrationFailure[]
}

export type MatchupBatchOptions = {
  baseSeed: string
  count: number
  createFixture: (seed: string) => GameMatchupFixture
  benchmarkProfile?: CalibrationBenchmarkProfile
  onProgress?: (progress: CalibrationProgress) => void
  shouldCancel?: () => boolean
}

const CALIBRATION_METRIC_KEYS = [
  "homeScore",
  "awayScore",
  "totalScore",
  "homePossessions",
  "awayPossessions",
  "reconciliationPass",
  "overtimePeriods",
  "injuryEvents",
  "failureRate",
  "topPlayerPoints",
  "topPlayerOpportunities",
  "teamPoints",
  "teamPossessions",
  "offensiveEfficiency",
  "fieldGoalPercentage",
  "threePointPercentage",
  "freeThrowPercentage",
  "threePointAttemptRate",
  "freeThrowAttemptRate",
  "rimAttemptRate",
  "midrangeAttemptRate",
  "assists",
  "turnovers",
  "turnoverRate",
  "rebounds",
  "offensiveRebounds",
  "defensiveRebounds",
  "steals",
  "blocks",
  "fouls",
  "topPlayerOpportunityShare",
  "benchPointsShare",
  "starterMinutes",
  "benchMinutes",
] as const

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction)
  )
  return sorted[index] ?? 0
}

function metric(values: number[]): CalibrationMetric {
  return {
    count: values.length,
    mean: values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : 0,
    minimum: values.length ? Math.min(...values) : 0,
    maximum: values.length ? Math.max(...values) : 0,
    p10: percentile(values, 0.1),
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  }
}

function emptyMetric(): CalibrationMetric {
  return metric([])
}

function createMetricBuckets(): Record<string, number[]> {
  return Object.fromEntries(CALIBRATION_METRIC_KEYS.map((key) => [key, []]))
}

function addMetric(
  buckets: Record<string, number[]>,
  key: string,
  value: number
): void {
  ;(buckets[key] ??= []).push(value)
}

export function calculateRate(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0
  }
  return (numerator / denominator) * 100
}

function collectAttemptMetrics(
  result: GameResult,
  buckets: Record<string, number[]>
): void {
  addMetric(
    buckets,
    "failureRate",
    result.status === "completed" && result.reconciliation.passed ? 0 : 1
  )
  addMetric(
    buckets,
    "overtimePeriods",
    result.periods.filter((period) => period.kind === "overtime").length
  )
  addMetric(buckets, "injuryEvents", result.events.length)
}

function collectMetrics(
  result: GameResult,
  buckets: Record<string, number[]>
): void {
  const teamResults = Object.values(result.teams)
  const homeTeam = result.teams[result.homeTeamId]
  const awayTeam = result.teams[result.awayTeamId]

  addMetric(buckets, "homeScore", homeTeam?.points ?? 0)
  addMetric(buckets, "awayScore", awayTeam?.points ?? 0)
  addMetric(
    buckets,
    "totalScore",
    teamResults.reduce((total, team) => total + team.points, 0)
  )
  addMetric(buckets, "homePossessions", homeTeam?.possessions ?? 0)
  addMetric(buckets, "awayPossessions", awayTeam?.possessions ?? 0)

  const playerResults = Object.values(result.players)
  addMetric(
    buckets,
    "topPlayerPoints",
    Math.max(0, ...playerResults.map((player) => player.points))
  )
  addMetric(
    buckets,
    "topPlayerOpportunities",
    Math.max(0, ...playerResults.map((player) => player.opportunities))
  )

  for (const team of teamResults) {
    const players = playerResults.filter(
      (player) => player.teamId === team.teamId
    )
    const benchPlayers = players.filter((player) => !player.starter)
    const starterPlayers = players.filter((player) => player.starter)
    const topPlayerOpportunities = Math.max(
      0,
      ...players.map((player) => player.opportunities)
    )
    const benchPoints = benchPlayers.reduce(
      (total, player) => total + player.points,
      0
    )

    addMetric(buckets, "teamPoints", team.points)
    addMetric(buckets, "teamPossessions", team.possessions)
    addMetric(
      buckets,
      "offensiveEfficiency",
      calculateRate(team.points, team.possessions)
    )
    addMetric(
      buckets,
      "fieldGoalPercentage",
      calculateRate(team.fieldGoalsMade, team.fieldGoalsAttempted)
    )
    addMetric(
      buckets,
      "threePointPercentage",
      calculateRate(team.threePointersMade, team.threePointersAttempted)
    )
    addMetric(
      buckets,
      "freeThrowPercentage",
      calculateRate(team.freeThrowsMade, team.freeThrowsAttempted)
    )
    addMetric(
      buckets,
      "threePointAttemptRate",
      calculateRate(team.threePointersAttempted, team.fieldGoalsAttempted)
    )
    addMetric(
      buckets,
      "freeThrowAttemptRate",
      calculateRate(team.freeThrowsAttempted, team.fieldGoalsAttempted)
    )
    addMetric(
      buckets,
      "rimAttemptRate",
      calculateRate(team.shotProfile.rimAttempts, team.fieldGoalsAttempted)
    )
    addMetric(
      buckets,
      "midrangeAttemptRate",
      calculateRate(team.shotProfile.midrangeAttempts, team.fieldGoalsAttempted)
    )
    addMetric(buckets, "assists", team.assists)
    addMetric(buckets, "turnovers", team.turnovers)
    addMetric(
      buckets,
      "turnoverRate",
      calculateRate(team.turnovers, team.possessions)
    )
    addMetric(buckets, "rebounds", team.rebounds)
    addMetric(buckets, "offensiveRebounds", team.offensiveRebounds)
    addMetric(buckets, "defensiveRebounds", team.defensiveRebounds)
    addMetric(buckets, "steals", team.steals)
    addMetric(buckets, "blocks", team.blocks)
    addMetric(buckets, "fouls", team.fouls)
    addMetric(
      buckets,
      "topPlayerOpportunityShare",
      calculateRate(topPlayerOpportunities, team.possessions)
    )
    addMetric(
      buckets,
      "benchPointsShare",
      calculateRate(benchPoints, team.points)
    )
    addMetric(
      buckets,
      "starterMinutes",
      starterPlayers.reduce((total, player) => total + player.minutes, 0)
    )
    addMetric(
      buckets,
      "benchMinutes",
      benchPlayers.reduce((total, player) => total + player.minutes, 0)
    )
  }
}

function buildBenchmarkReport(
  metrics: Record<string, CalibrationMetric>,
  profile: CalibrationBenchmarkProfile
): CalibrationBenchmarkReport {
  const checks: Record<string, CalibrationBenchmarkCheck> = {}

  for (const [metricName, target] of Object.entries(profile.targets)) {
    const actual = metrics[metricName] ?? emptyMetric()
    const passed =
      actual.count > 0 && actual.mean >= target.min && actual.mean <= target.max
    checks[metricName] = {
      metric: metricName,
      actual,
      target,
      passed,
    }
  }

  return {
    profileId: profile.id,
    label: profile.label,
    passed: Object.values(checks).every((check) => check.passed),
    checks,
  }
}

function resolveFixtureConfig(
  fixture: GameMatchupFixture,
  seed: string
): GameSimulationConfig {
  const validation = gameSimulationConfigSchema.safeParse(fixture.config)
  if (!validation.success) {
    throw new Error(
      "Calibration fixture " + seed + " has an invalid game simulation config."
    )
  }
  return resolveGameSimulationConfig(fixture.config, fixture.config.presetId)
}

function rejectedResult(fixture: GameMatchupFixture, seed: string): GameResult {
  return {
    version: 1,
    seed,
    status: "rejected",
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    winnerTeamId: null,
    periods: [],
    teams: {},
    players: {},
    events: [],
    diagnostics: [
      {
        code: "invalid-calibration-fixture",
        message: "The fixture failed schema validation before simulation.",
        severity: "error",
        scope: "fixture",
      },
    ],
    reconciliation: { passed: false, checks: [] },
  }
}

export function runMatchupBatch(
  options: MatchupBatchOptions
): MatchupBatchReport {
  if (!options.baseSeed.trim()) {
    throw new Error("Calibration batches require a base seed.")
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("Calibration batch count must be a positive integer.")
  }

  const firstSeed = options.baseSeed + ":1"
  const firstFixture = options.createFixture(firstSeed)
  const effectiveConfig = resolveFixtureConfig(firstFixture, firstSeed)
  const effectiveConfigFingerprint = JSON.stringify(effectiveConfig)
  const results: GameResult[] = []
  const failures: CalibrationFailure[] = []
  const buckets = createMetricBuckets()

  for (let index = 0; index < options.count; index += 1) {
    if (options.shouldCancel?.()) break
    const seed = options.baseSeed + ":" + (index + 1)
    const fixture = index === 0 ? firstFixture : options.createFixture(seed)
    const fixtureConfig = resolveFixtureConfig(fixture, seed)
    if (JSON.stringify(fixtureConfig) !== effectiveConfigFingerprint) {
      throw new Error(
        "Calibration batch fixtures must use one effective game simulation config."
      )
    }
    const fixtureValidation = gameMatchupFixtureSchema.safeParse(fixture)
    const result = fixtureValidation.success
      ? simulateGameMatchup(fixture)
      : rejectedResult(fixture, seed)

    results.push(result)
    collectAttemptMetrics(result, buckets)
    if (result.status !== "completed" || !result.reconciliation.passed) {
      failures.push({ seed, fixture, result })
    } else {
      addMetric(buckets, "reconciliationPass", 1)
      collectMetrics(result, buckets)
    }
    options.onProgress?.({
      completed: index + 1,
      total: options.count,
      label: "Simulated " + (index + 1) + " of " + options.count + " games",
    })
  }

  const completed = results.filter(
    (result) => result.status === "completed"
  ).length
  const metrics = Object.fromEntries(
    Object.entries(buckets).map(([key, values]) => [key, metric(values)])
  )

  return {
    schema: "foh-matchup-calibration",
    version: 2,
    baseSeed: options.baseSeed,
    count: options.count,
    completed,
    failed: failures.length,
    effectiveConfig,
    metrics,
    benchmark: options.benchmarkProfile
      ? buildBenchmarkReport(metrics, options.benchmarkProfile)
      : null,
    results,
    failures,
  }
}

export function serializeMatchupBatchReport(
  report: MatchupBatchReport
): string {
  matchupBatchReportSchema.parse(report)
  return JSON.stringify(report, null, 2)
}
