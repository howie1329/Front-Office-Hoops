import type { DraftDecisionConfig, DraftDecisionResult, DraftDecisionRunInput, DraftScoutTier } from "@workspace/domain-v2"
import { runDraftDecisionLab, STANDARD_DRAFT_DECISION_CONFIG } from "@workspace/sim-v2"

export type DraftCalibrationOptions = {
  baseSeed: string
  count: number
  config?: Partial<DraftDecisionConfig>
  scoutTiers?: Record<string, DraftScoutTier>
  retainRuns?: boolean
  onProgress?: (progress: { completed: number; total: number; label: string }) => void
  shouldCancel?: () => boolean
}

export type DraftCalibrationMetric = {
  count: number
  mean: number
  minimum: number
  maximum: number
  median: number
}

export type DraftCalibrationReport = {
  schema: "foh-draft-decision-calibration"
  version: 1
  baseSeed: string
  count: number
  completed: number
  cancelled: boolean
  metrics: {
    legalRunRate: DraftCalibrationMetric
    averageScoutAbsoluteError: Record<DraftScoutTier, DraftCalibrationMetric>
    averageBoardRankOfPick: DraftCalibrationMetric
    averageFirstRoundPeakAbility: DraftCalibrationMetric
    averageSecondRoundPeakAbility: DraftCalibrationMetric
  }
  runs: DraftDecisionResult[]
}

function metric(values: number[]): DraftCalibrationMetric {
  const sorted = [...values].sort((left, right) => left - right)
  return {
    count: values.length,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    minimum: sorted[0] ?? 0,
    maximum: sorted.at(-1) ?? 0,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
  }
}

export function runDraftDecisionBatch(options: DraftCalibrationOptions): DraftCalibrationReport {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100) {
    throw new RangeError("Draft calibration count must be an integer from 1 to 100.")
  }
  const runs: DraftDecisionResult[] = []
  const legal: number[] = []
  const boardRanks: number[] = []
  const firstRoundPeaks: number[] = []
  const secondRoundPeaks: number[] = []
  const scoutErrors: Record<DraftScoutTier, number[]> = { weak: [], average: [], strong: [] }
  let cancelled = false
  for (let index = 0; index < options.count; index += 1) {
    if (options.shouldCancel?.()) {
      cancelled = true
      break
    }
    const input: DraftDecisionRunInput = {
      seed: `${options.baseSeed}:${index + 1}`,
      config: { ...STANDARD_DRAFT_DECISION_CONFIG, ...options.config },
      scoutTiers: options.scoutTiers,
    }
    const result = runDraftDecisionLab(input)
    if (options.retainRuns) runs.push(result)
    legal.push(result.diagnostics.legal ? 1 : 0)
    boardRanks.push(...Object.values(result.diagnostics.averageBoardRankOfPick))
    for (const outcome of result.outcomes) {
      const pick = result.picks.find((candidate) => candidate.playerId === outcome.playerId)
      if (pick) {
        if (pick.round === 1) firstRoundPeaks.push(outcome.realizedPeakAbility)
        else secondRoundPeaks.push(outcome.realizedPeakAbility)
        const tier = result.fixture.teamProfiles[pick.teamId]?.scoutTier
        if (tier && outcome.scoutError !== null) scoutErrors[tier].push(Math.abs(outcome.scoutError))
      }
    }
    options.onProgress?.({ completed: index + 1, total: options.count, label: `Draft run ${index + 1} of ${options.count}` })
  }
  return {
    schema: "foh-draft-decision-calibration",
    version: 1,
    baseSeed: options.baseSeed,
    count: options.count,
    completed: legal.length,
    cancelled,
    metrics: {
      legalRunRate: metric(legal),
      averageScoutAbsoluteError: {
        weak: metric(scoutErrors.weak),
        average: metric(scoutErrors.average),
        strong: metric(scoutErrors.strong),
      },
      averageBoardRankOfPick: metric(boardRanks),
      averageFirstRoundPeakAbility: metric(firstRoundPeaks),
      averageSecondRoundPeakAbility: metric(secondRoundPeaks),
    },
    runs,
  }
}

export function serializeDraftDecisionBatch(report: DraftCalibrationReport): string {
  return JSON.stringify(report, null, 2)
}
