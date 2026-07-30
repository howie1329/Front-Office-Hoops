import type {
  GameMatchupFixture,
  GameResult,
} from "@workspace/domain-v2"
import {
  gameMatchupFixtureSchema,
  matchupBatchReportSchema,
} from "@workspace/league-schema"
import { simulateGameMatchup } from "@workspace/sim-v2"

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

export type CalibrationFailure = {
  seed: string
  fixture: GameMatchupFixture
  result: GameResult
}

export type MatchupBatchReport = {
  schema: "foh-matchup-calibration"
  version: 1
  baseSeed: string
  count: number
  completed: number
  failed: number
  metrics: Record<string, CalibrationMetric>
  results: GameResult[]
  failures: CalibrationFailure[]
}

export type MatchupBatchOptions = {
  baseSeed: string
  count: number
  createFixture: (seed: string) => GameMatchupFixture
  onProgress?: (progress: CalibrationProgress) => void
  shouldCancel?: () => boolean
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))
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

function addMetric(
  buckets: Record<string, number[]>,
  key: string,
  value: number
): void {
  ;(buckets[key] ??= []).push(value)
}

function collectMetrics(
  result: GameResult,
  buckets: Record<string, number[]>
): void {
  const teamResults = Object.values(result.teams)
  addMetric(buckets, "homeScore", result.teams[result.homeTeamId]?.points ?? 0)
  addMetric(buckets, "awayScore", result.teams[result.awayTeamId]?.points ?? 0)
  addMetric(
    buckets,
    "totalScore",
    teamResults.reduce((total, team) => total + team.points, 0)
  )
  addMetric(
    buckets,
    "homePossessions",
    result.teams[result.homeTeamId]?.possessions ?? 0
  )
  addMetric(
    buckets,
    "awayPossessions",
    result.teams[result.awayTeamId]?.possessions ?? 0
  )
  addMetric(
    buckets,
    "reconciliationPass",
    result.reconciliation.passed ? 1 : 0
  )
  addMetric(buckets, "overtimePeriods", result.periods.filter((period) => period.kind === "overtime").length)
  addMetric(buckets, "injuryEvents", result.events.length)

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
}

export function runMatchupBatch(options: MatchupBatchOptions): MatchupBatchReport {
  if (!options.baseSeed.trim()) {
    throw new Error("Calibration batches require a base seed.")
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("Calibration batch count must be a positive integer.")
  }

  const results: GameResult[] = []
  const failures: CalibrationFailure[] = []
  const buckets: Record<string, number[]> = {}

  for (let index = 0; index < options.count; index += 1) {
    if (options.shouldCancel?.()) break
    const seed = `${options.baseSeed}:${index + 1}`
    const fixture = options.createFixture(seed)
    const fixtureValidation = gameMatchupFixtureSchema.safeParse(fixture)
    const result = fixtureValidation.success
      ? simulateGameMatchup(fixture)
      : {
          version: 1,
          seed,
          status: "rejected" as const,
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
              severity: "error" as const,
              scope: "fixture" as const,
            },
          ],
          reconciliation: { passed: false, checks: [] },
        }
    results.push(result)
    if (result.status !== "completed" || !result.reconciliation.passed) {
      failures.push({ seed, fixture, result })
    } else {
      collectMetrics(result, buckets)
    }
    options.onProgress?.({
      completed: index + 1,
      total: options.count,
      label: `Simulated ${index + 1} of ${options.count} games`,
    })
  }

  return {
    schema: "foh-matchup-calibration",
    version: 1,
    baseSeed: options.baseSeed,
    count: options.count,
    completed: results.filter((result) => result.status === "completed").length,
    failed: failures.length,
    metrics: Object.fromEntries(
      Object.entries(buckets).map(([key, values]) => [key, metric(values)])
    ),
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
