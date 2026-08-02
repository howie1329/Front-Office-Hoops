import type {
  DraftDecisionConfig,
  DraftDecisionResult,
  DraftDecisionRunInput,
  DraftScoutTier,
  DraftTeamMode,
} from "@workspace/domain-v2"
import { resolveDraftDecisionConfig, runDraftDecisionLab } from "@workspace/sim-v2"

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
    averageBaseBoardRankOfPick: DraftCalibrationMetric
    tieBreakUsedRate: DraftCalibrationMetric
    averageFirstRoundPeakAbility: DraftCalibrationMetric
    averageSecondRoundPeakAbility: DraftCalibrationMetric
  }
  runs: DraftDecisionResult[]
}

export type DraftCalibrationArm = {
  id: string
  config?: Partial<DraftDecisionConfig>
  scoutTiers?: Record<string, DraftScoutTier>
  teamModes?: Record<string, DraftTeamMode>
}

export type DraftMatchedComparison = {
  armA: string
  armB: string
  changedPickCount: number
  changedFirstRoundPickCount: number
  changedWithinTieGroupCount: number
  averageScoreComponentDelta: {
    base: number
    final: number
    floor: number
    expectedUpside: number
    fit: number
    risk: number
    tieBreak: number
  }
}

export type DraftMatchedCalibrationReport = {
  schema: "foh-draft-decision-matched-calibration"
  version: 1
  seed: string
  arms: Array<{ id: string; result: DraftDecisionResult }>
  comparisons: DraftMatchedComparison[]
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
  const baseBoardRanks: number[] = []
  const tieBreakRates: number[] = []
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
      config: resolveDraftDecisionConfig(options.config),
      scoutTiers: options.scoutTiers,
    }
    const result = runDraftDecisionLab(input)
    if (options.retainRuns) runs.push(result)
    legal.push(result.diagnostics.legal ? 1 : 0)
    boardRanks.push(...Object.values(result.diagnostics.averageBoardRankOfPick))
    baseBoardRanks.push(...Object.values(result.diagnostics.averageBaseBoardRankOfPick))
    tieBreakRates.push(result.diagnostics.tieBreakUsedRate)
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
      averageBaseBoardRankOfPick: metric(baseBoardRanks),
      tieBreakUsedRate: metric(tieBreakRates),
      averageFirstRoundPeakAbility: metric(firstRoundPeaks),
      averageSecondRoundPeakAbility: metric(secondRoundPeaks),
    },
    runs,
  }
}

export function runDraftDecisionMatchedArms(input: {
  seed: string
  arms: DraftCalibrationArm[]
}): DraftMatchedCalibrationReport {
  if (input.arms.length < 2) {
    throw new RangeError("Matched draft calibration requires at least two arms.")
  }
  const arms = input.arms.map((arm) => ({
    id: arm.id,
    result: runDraftDecisionLab({
      seed: input.seed,
      config: resolveDraftDecisionConfig(arm.config),
      scoutTiers: arm.scoutTiers,
      teamModes: arm.teamModes,
    }),
  }))
  const comparisons: DraftMatchedComparison[] = []
  for (let leftIndex = 0; leftIndex < arms.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < arms.length; rightIndex += 1) {
      const left = arms[leftIndex]
      const right = arms[rightIndex]
      let changedPickCount = 0
      let changedFirstRoundPickCount = 0
      let changedWithinTieGroupCount = 0
      const componentTotals = {
        base: 0,
        final: 0,
        floor: 0,
        expectedUpside: 0,
        fit: 0,
        risk: 0,
        tieBreak: 0,
      }
      let componentCount = 0
      const rightPicks = new Map(right.result.picks.map((pick) => [pick.overall, pick]))
      for (const team of left.result.fixture.teams) {
        const leftEntries = new Map(left.result.fixture.boards[team.id]?.entries.map((entry) => [entry.playerId, entry]) ?? [])
        const rightEntries = new Map(right.result.fixture.boards[team.id]?.entries.map((entry) => [entry.playerId, entry]) ?? [])
        for (const [playerId, leftEntry] of leftEntries) {
          const rightEntry = rightEntries.get(playerId)
          if (!rightEntry) continue
          componentTotals.base += rightEntry.score.base - leftEntry.score.base
          componentTotals.final += rightEntry.score.final - leftEntry.score.final
          componentTotals.floor += rightEntry.score.floor - leftEntry.score.floor
          componentTotals.expectedUpside += rightEntry.score.expectedUpside - leftEntry.score.expectedUpside
          componentTotals.fit += rightEntry.score.fit - leftEntry.score.fit
          componentTotals.risk += rightEntry.score.risk - leftEntry.score.risk
          componentTotals.tieBreak += rightEntry.score.tieBreak - leftEntry.score.tieBreak
          componentCount += 1
        }
      }
      for (const leftPick of left.result.picks) {
        const rightPick = rightPicks.get(leftPick.overall)
        if (!rightPick || rightPick.playerId === leftPick.playerId) continue
        changedPickCount += 1
        if (leftPick.round === 1) changedFirstRoundPickCount += 1
        if (leftPick.tieGroup || rightPick.tieGroup) changedWithinTieGroupCount += 1
      }
      comparisons.push({
        armA: left.id,
        armB: right.id,
        changedPickCount,
        changedFirstRoundPickCount,
        changedWithinTieGroupCount,
        averageScoreComponentDelta: Object.fromEntries(
          Object.entries(componentTotals).map(([key, value]) => [key, componentCount ? value / componentCount : 0])
        ) as DraftMatchedComparison["averageScoreComponentDelta"],
      })
    }
  }
  return {
    schema: "foh-draft-decision-matched-calibration",
    version: 1,
    seed: input.seed,
    arms,
    comparisons,
  }
}

export function serializeDraftDecisionBatch(report: DraftCalibrationReport): string {
  return JSON.stringify(report, null, 2)
}

export function serializeDraftDecisionMatchedCalibration(report: DraftMatchedCalibrationReport): string {
  return JSON.stringify(report, null, 2)
}
