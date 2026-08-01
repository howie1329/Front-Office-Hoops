import type {
  SeasonFixture,
  SeasonRunProgress,
  SeasonRunResult,
} from "@workspace/domain-v2"

import { runSeason } from "@workspace/sim-v2"

export type SeasonBatchMetric = {
  count: number
  mean: number
  minimum: number
  maximum: number
}

export type SeasonBatchReport = {
  schema: "foh-season-production-calibration"
  version: 1
  baseSeed: string
  count: number
  completed: number
  failed: number
  cancelled: boolean
  reports: SeasonRunResult[]
  metrics: Record<string, SeasonBatchMetric>
}

export type SeasonBatchOptions = {
  baseSeed: string
  count: number
  createFixture: (seed: string) => SeasonFixture
  onProgress?: (
    progress: SeasonRunProgress & { season: number; totalSeasons: number }
  ) => void
  shouldCancel?: () => boolean
}

function metric(values: number[]): SeasonBatchMetric {
  return {
    count: values.length,
    mean: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0,
    minimum: values.length ? Math.min(...values) : 0,
    maximum: values.length ? Math.max(...values) : 0,
  }
}

export function runSeasonBatch(options: SeasonBatchOptions): SeasonBatchReport {
  if (!options.baseSeed.trim())
    throw new Error("A season batch seed is required.")
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("A season batch count must be a positive integer.")
  }
  const reports: SeasonRunResult[] = []
  const summaries: Record<string, number[]> = {
    finalPointsPerGame: [],
    finalOffensiveEfficiency: [],
    finalReconciliationPassRate: [],
    finalTopPlayerValue: [],
    finalAveragePlayerValue: [],
    finalInjuries: [],
  }
  let cancelled = false

  for (let index = 0; index < options.count; index += 1) {
    if (options.shouldCancel?.()) {
      cancelled = true
      break
    }
    const report = runSeason(
      options.createFixture(`${options.baseSeed}:${index + 1}`),
      {
        shouldCancel: options.shouldCancel,
        onProgress: (progress) =>
          options.onProgress?.({
            ...progress,
            season: index + 1,
            totalSeasons: options.count,
          }),
      }
    )
    if (report.status === "cancelled") {
      cancelled = true
      break
    }
    reports.push(report)
    const final = report.checkpoints.at(-1)
    if (final) {
      const values = Object.values(final.values).map((value) => value.rawValue)
      summaries.finalPointsPerGame.push(final.leagueSummary.pointsPerGame)
      summaries.finalOffensiveEfficiency.push(
        final.leagueSummary.offensiveEfficiency
      )
      summaries.finalReconciliationPassRate.push(
        final.leagueSummary.reconciliationPassRate
      )
      if (values.length > 0) {
        summaries.finalTopPlayerValue.push(Math.max(...values))
      }
      summaries.finalAveragePlayerValue.push(
        values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0
      )
      summaries.finalInjuries.push(final.leagueSummary.injuries)
    }
  }

  return {
    schema: "foh-season-production-calibration",
    version: 1,
    baseSeed: options.baseSeed,
    count: options.count,
    completed: reports.filter((report) => report.status === "completed").length,
    failed: reports.filter((report) => report.status === "failed").length,
    cancelled,
    reports,
    metrics: Object.fromEntries(
      Object.entries(summaries).map(([key, values]) => [key, metric(values)])
    ),
  }
}

export function serializeSeasonBatchReport(report: SeasonBatchReport): string {
  return JSON.stringify(report, null, 2)
}
