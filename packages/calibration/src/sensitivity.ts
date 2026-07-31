import type {
  GameMatchupFixture,
  GameResult,
  GameSimulationConfig,
} from "@workspace/domain-v2"
import { sliderSensitivityReportSchema } from "@workspace/league-schema"
import {
  GAME_SETTING_DESCRIPTORS,
  getGameNumericSetting,
  getPlayerCurrentAbility,
  updateGameNumericSetting,
} from "@workspace/sim-v2"
import type { GameNumericSettingPath } from "@workspace/sim-v2"

import {
  runMatchupBatch,
  type CalibrationMetric,
  type MatchupBatchReport,
} from "./index"

export type SensitivityDirection =
  "increase" | "decrease" | "spread-increase" | "distance-decrease" | "observe"

export type SensitivityClassification =
  "wired" | "no-op" | "conditional" | "saturated" | "unknown"

export type SensitivityExpectation = {
  primaryMetric: string
  direction: SensitivityDirection
  diagnosticFloor?: number
}

export type SliderSensitivityScenario = {
  id: string
  createFixture: (seed: string) => GameMatchupFixture
}

export type SliderSensitivityOptions = {
  baseSeed: string
  count: number
  scenarios: SliderSensitivityScenario[]
  paths?: GameNumericSettingPath[]
  expectations?: Partial<Record<GameNumericSettingPath, SensitivityExpectation>>
}

export type SensitivityArmLabel =
  "minimum" | "lower-quartile" | "baseline" | "upper-quartile" | "maximum"

export type SliderSensitivityArm = {
  label: SensitivityArmLabel
  value: number
  effectiveConfig: GameSimulationConfig
  metrics: Record<string, CalibrationMetric>
}

export type SensitivityMetricDelta = {
  metric: string
  baseline: CalibrationMetric
  low: CalibrationMetric
  high: CalibrationMetric
  lowSignal: number
  highSignal: number
  delta: number
  diagnosticFloor: number
  directionalPass: boolean
}

export type SliderSensitivityScenarioResult = {
  scenario: string
  arms: SliderSensitivityArm[]
  pairedCount: number
  pairedChangedCount: number
  primary: SensitivityMetricDelta
  classification: SensitivityClassification
  diagnostic: string
}

export type SliderSensitivityResult = {
  path: GameNumericSettingPath
  label: string
  primaryMetric: string
  direction: SensitivityDirection
  classification: SensitivityClassification
  scenarios: SliderSensitivityScenarioResult[]
  diagnostic: string
}

export type SliderSensitivityReport = {
  schema: "foh-slider-sensitivity"
  version: 1
  baseSeed: string
  count: number
  baselineConfig: GameSimulationConfig
  results: SliderSensitivityResult[]
}

export const DEFAULT_SLIDER_SENSITIVITY_EXPECTATIONS: Record<
  GameNumericSettingPath,
  SensitivityExpectation
> = {
  "environment.pace": {
    primaryMetric: "teamPossessions",
    direction: "increase",
  },
  "environment.scoringEnvironment": {
    primaryMetric: "teamPoints",
    direction: "increase",
  },
  "environment.gameVariance": {
    primaryMetric: "totalScore",
    direction: "spread-increase",
  },
  "environment.talentSeparation": {
    primaryMetric: "strongTeamPointDiff",
    direction: "increase",
  },
  "environment.homeCourtAdvantage": {
    primaryMetric: "homeCourtPointDiff",
    direction: "increase",
  },
  "offense.threePointRate": {
    primaryMetric: "threePointAttemptRate",
    direction: "increase",
  },
  "offense.rimRate": {
    primaryMetric: "rimAttemptRate",
    direction: "increase",
  },
  "offense.midrangeRate": {
    primaryMetric: "midrangeAttemptRate",
    direction: "increase",
  },
  "offense.shotSelectionDiscipline": {
    primaryMetric: "fieldGoalPercentage",
    direction: "increase",
  },
  "offense.starUsage": {
    primaryMetric: "topPlayerOpportunityShare",
    direction: "increase",
  },
  "offense.ballMovement": {
    primaryMetric: "assists",
    direction: "increase",
  },
  "offense.isolationRate": {
    primaryMetric: "assists",
    direction: "decrease",
  },
  "offense.transitionRate": {
    primaryMetric: "transitionAttemptProxy",
    direction: "increase",
  },
  "offense.offensiveRebounding": {
    primaryMetric: "offensiveRebounds",
    direction: "increase",
  },
  "defense.pressure": {
    primaryMetric: "turnovers",
    direction: "increase",
  },
  "defense.helpDefense": {
    primaryMetric: "blocks",
    direction: "increase",
  },
  "defense.turnoverPressure": {
    primaryMetric: "turnovers",
    direction: "increase",
  },
  "defense.switching": {
    primaryMetric: "fieldGoalPercentage",
    direction: "observe",
  },
  "defense.doubleTeamRate": {
    primaryMetric: "creatorTurnovers",
    direction: "increase",
  },
  "defense.foulDiscipline": {
    primaryMetric: "fouls",
    direction: "decrease",
  },
  "rotation.adherence": {
    primaryMetric: "rotationTargetError",
    direction: "distance-decrease",
  },
  "rotation.benchUsage": {
    primaryMetric: "benchPointsShare",
    direction: "increase",
  },
  "rotation.starterWorkload": {
    primaryMetric: "starterMinutes",
    direction: "increase",
  },
  "rotation.fatigueImpact": {
    primaryMetric: "lateEfficiencyDelta",
    direction: "decrease",
  },
  "coaching.influence": {
    primaryMetric: "coachPaceAlignedPossessions",
    direction: "increase",
  },
  "coaching.paceInfluence": {
    primaryMetric: "coachPaceAlignedPossessions",
    direction: "increase",
  },
  "coaching.shotSelectionInfluence": {
    primaryMetric: "coachShotSelectionAlignedMix",
    direction: "increase",
  },
  "coaching.defensiveInfluence": {
    primaryMetric: "coachDefenseAlignedTurnovers",
    direction: "increase",
  },
  "injuries.maxGamesOut": {
    primaryMetric: "injuryDuration",
    direction: "increase",
  },
}

const SENSITIVITY_METRIC_KEYS = [
  "homeCourtPointDiff",
  "homeCourtEfficiencyDiff",
  "strongTeamPointDiff",
  "transitionAttemptProxy",
  "creatorTurnovers",
  "creatorShotShare",
  "rotationTargetError",
  "lateEfficiencyDelta",
  "coachPaceAlignedPossessions",
  "coachShotSelectionAlignedMix",
  "coachDefenseAlignedTurnovers",
  "injuryDuration",
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

function calculateRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0
}

function sign(value: number): number {
  return value < 0 ? -1 : value > 0 ? 1 : 0
}

function getDiagnosticFloor(
  metricName: string,
  override: number | undefined
): number {
  if (override !== undefined) return override
  if (
    metricName.toLowerCase().includes("percentage") ||
    metricName.toLowerCase().includes("share") ||
    metricName.toLowerCase().includes("rate") ||
    metricName.toLowerCase().includes("mix")
  ) {
    return 0.1
  }
  return 0.25
}

function getSignalValue(
  value: CalibrationMetric,
  direction: SensitivityDirection
): number {
  return direction === "spread-increase" ? value.p90 - value.p10 : value.mean
}

function createMetricBuckets(): Record<string, number[]> {
  return Object.fromEntries(SENSITIVITY_METRIC_KEYS.map((key) => [key, []]))
}

function addMetric(
  buckets: Record<string, number[]>,
  key: string,
  value: number
): void {
  if (Number.isFinite(value)) (buckets[key] ??= []).push(value)
}

function getTeamAverageAbility(
  fixture: GameMatchupFixture,
  teamId: string
): number {
  return average(
    Object.values(fixture.players)
      .filter(
        (player) =>
          player.leagueStatus.kind === "rostered" &&
          player.leagueStatus.teamId === teamId
      )
      .map((player) => getPlayerCurrentAbility(player))
  )
}

function getPeriodEfficiency(
  result: GameResult,
  periodNumber: number,
  teamId: string
): number {
  const period = result.periods.find(
    (candidate) => candidate.number === periodNumber
  )
  if (!period) return 0
  return calculateRate(
    period.teamPoints[teamId] ?? 0,
    period.teamPossessions[teamId] ?? 0
  )
}

function collectDerivedMetrics(
  result: GameResult,
  fixture: GameMatchupFixture
): Record<string, number> {
  if (result.status !== "completed") return {}
  const home = result.teams[fixture.homeTeamId]
  const away = result.teams[fixture.awayTeamId]
  if (!home || !away) return {}

  const players = Object.values(result.players)
  const creators = players.filter((player) =>
    /creator/i.test(player.role.label)
  )
  const creatorTurnovers = sum(creators.map((player) => player.turnovers))
  const creatorAttempts = sum(
    creators.map((player) => player.fieldGoalsAttempted)
  )
  const totalAttempts = home.fieldGoalsAttempted + away.fieldGoalsAttempted
  const homeNonMidrange =
    home.shotProfile.rimAttempts + home.shotProfile.threePointAttempts
  const awayNonMidrange =
    away.shotProfile.rimAttempts + away.shotProfile.threePointAttempts
  const homeMix = calculateRate(homeNonMidrange, home.fieldGoalsAttempted)
  const awayMix = calculateRate(awayNonMidrange, away.fieldGoalsAttempted)
  const paceDelta =
    fixture.coaching[fixture.homeTeamId]!.pace -
    fixture.coaching[fixture.awayTeamId]!.pace
  const shotSelectionDelta =
    fixture.coaching[fixture.homeTeamId]!.shotSelection -
    fixture.coaching[fixture.awayTeamId]!.shotSelection
  const defensivePressureDelta =
    fixture.coaching[fixture.homeTeamId]!.defensivePressure -
    fixture.coaching[fixture.awayTeamId]!.defensivePressure
  const strongTeamId =
    getTeamAverageAbility(fixture, fixture.homeTeamId) >=
    getTeamAverageAbility(fixture, fixture.awayTeamId)
      ? fixture.homeTeamId
      : fixture.awayTeamId
  const weakTeamId =
    strongTeamId === fixture.homeTeamId
      ? fixture.awayTeamId
      : fixture.homeTeamId
  const strongTeam = result.teams[strongTeamId]!
  const weakTeam = result.teams[weakTeamId]!
  const totalMinutes = sum(result.periods.map((period) => period.minutes)) * 5
  const rotationTargetError = [fixture.homeTeamId, fixture.awayTeamId].reduce(
    (total, teamId) => {
      const rotation = fixture.rotations[teamId]!
      const targetTotal = sum(Object.values(rotation.targetMinutes))
      const playersForTeam = players.filter(
        (player) => player.teamId === teamId
      )
      return (
        total +
        playersForTeam.reduce((teamTotal, player) => {
          const target = rotation.targetMinutes[player.playerId] ?? 0
          const normalizedTarget = targetTotal
            ? (target / targetTotal) * totalMinutes
            : 0
          return teamTotal + Math.abs(player.minutes - normalizedTarget)
        }, 0)
      )
    },
    0
  )
  const firstThreeEfficiency = average(
    [fixture.homeTeamId, fixture.awayTeamId].flatMap((teamId) =>
      [1, 2, 3].map((period) => getPeriodEfficiency(result, period, teamId))
    )
  )
  const fourthEfficiency = average(
    [fixture.homeTeamId, fixture.awayTeamId].map((teamId) =>
      getPeriodEfficiency(result, 4, teamId)
    )
  )

  return {
    homeCourtPointDiff: home.points - away.points,
    homeCourtEfficiencyDiff:
      calculateRate(home.points, home.possessions) -
      calculateRate(away.points, away.possessions),
    strongTeamPointDiff: strongTeam.points - weakTeam.points,
    transitionAttemptProxy: calculateRate(
      homeNonMidrange + awayNonMidrange,
      totalAttempts
    ),
    creatorTurnovers,
    creatorShotShare: calculateRate(creatorAttempts, totalAttempts),
    rotationTargetError,
    lateEfficiencyDelta: fourthEfficiency - firstThreeEfficiency,
    coachPaceAlignedPossessions:
      paceDelta === 0
        ? 0
        : (home.possessions - away.possessions) * sign(paceDelta),
    coachShotSelectionAlignedMix:
      shotSelectionDelta === 0
        ? 0
        : (homeMix - awayMix) * sign(shotSelectionDelta),
    coachDefenseAlignedTurnovers:
      defensivePressureDelta === 0
        ? 0
        : (away.turnovers - home.turnovers) * sign(defensivePressureDelta),
    injuryDuration: result.events.length
      ? Math.max(...result.events.map((event) => event.gamesRemaining))
      : 0,
  }
}

function mergeSensitivityMetrics(
  batch: MatchupBatchReport,
  fixtures: Map<string, GameMatchupFixture>
): Record<string, CalibrationMetric> {
  const buckets = createMetricBuckets()
  for (const result of batch.results) {
    const fixture = fixtures.get(result.seed)
    if (!fixture) continue
    const derived = collectDerivedMetrics(result, fixture)
    for (const [key, value] of Object.entries(derived)) {
      addMetric(buckets, key, value)
    }
  }
  return {
    ...batch.metrics,
    ...Object.fromEntries(
      Object.entries(buckets).map(([key, values]) => [key, metric(values)])
    ),
  }
}

function createArmValues(
  path: GameNumericSettingPath,
  baselineConfig: GameSimulationConfig
): Array<{ label: SensitivityArmLabel; value: number }> {
  const descriptor = GAME_SETTING_DESCRIPTORS.find(
    (candidate) => candidate.path === path
  )!
  const baseline = getGameNumericSetting(baselineConfig, path)
  const values = [
    { label: "minimum" as const, value: descriptor.min },
    {
      label: "lower-quartile" as const,
      value: descriptor.min + (descriptor.max - descriptor.min) * 0.25,
    },
    { label: "baseline" as const, value: baseline },
    {
      label: "upper-quartile" as const,
      value: descriptor.min + (descriptor.max - descriptor.min) * 0.75,
    },
    { label: "maximum" as const, value: descriptor.max },
  ]
  const unique = new Map<
    number,
    { label: SensitivityArmLabel; value: number }
  >()
  for (const arm of values) {
    const snapped = Math.round(arm.value / descriptor.step) * descriptor.step
    const value = Math.min(descriptor.max, Math.max(descriptor.min, snapped))
    if (!unique.has(value) || arm.label === "baseline") {
      unique.set(value, { label: arm.label, value })
    }
  }
  return [...unique.values()].sort((left, right) => left.value - right.value)
}

function fingerprint(result: GameResult): string {
  return JSON.stringify(result)
}

function countChangedPairs(
  lowResults: GameResult[],
  highResults: GameResult[]
): number {
  return lowResults.reduce(
    (count, result, index) =>
      count +
      (fingerprint(result) === fingerprint(highResults[index]!) ? 0 : 1),
    0
  )
}

function allResultsEqual(results: GameResult[][]): boolean {
  const first = results[0] ?? []
  return results.every(
    (candidate) =>
      candidate.length === first.length &&
      candidate.every(
        (result, index) => fingerprint(result) === fingerprint(first[index]!)
      )
  )
}

function directionalPass(
  signals: number[],
  direction: SensitivityDirection,
  floor: number
): boolean {
  if (direction === "observe") return false
  const endpointDelta = (signals.at(-1) ?? 0) - (signals[0] ?? 0)
  const endpointPass =
    direction === "increase"
      ? endpointDelta > floor
      : direction === "decrease" || direction === "distance-decrease"
        ? endpointDelta < -floor
        : endpointDelta > floor
  if (!endpointPass) return false
  const adjacentPasses = signals
    .slice(1)
    .reduce((count, signalValue, index) => {
      const delta = signalValue - signals[index]!
      const passes =
        direction === "increase" || direction === "spread-increase"
          ? delta >= 0
          : delta <= 0
      return count + (passes ? 1 : 0)
    }, 0)
  return adjacentPasses >= Math.max(1, signals.length - 2)
}

function classifyScenario(
  scenario: string,
  arms: SliderSensitivityArm[],
  resultSets: GameResult[][],
  expectation: SensitivityExpectation
): SliderSensitivityScenarioResult {
  const primaryMetrics = arms.map(
    (arm) => arm.metrics[expectation.primaryMetric] ?? metric([])
  )
  const baselineIndex = Math.max(
    0,
    arms.findIndex((arm) => arm.label === "baseline")
  )
  const baselineMetric = primaryMetrics[baselineIndex] ?? metric([])
  const lowMetric = primaryMetrics[0] ?? metric([])
  const highMetric = primaryMetrics.at(-1) ?? metric([])
  const floor = getDiagnosticFloor(
    expectation.primaryMetric,
    expectation.diagnosticFloor
  )
  const signals = primaryMetrics.map((value) =>
    getSignalValue(value, expectation.direction)
  )
  const primary: SensitivityMetricDelta = {
    metric: expectation.primaryMetric,
    baseline: baselineMetric,
    low: lowMetric,
    high: highMetric,
    lowSignal: signals[0] ?? 0,
    highSignal: signals.at(-1) ?? 0,
    delta: (signals.at(-1) ?? 0) - (signals[0] ?? 0),
    diagnosticFloor: floor,
    directionalPass: directionalPass(signals, expectation.direction, floor),
  }
  const pairedChangedCount = countChangedPairs(
    resultSets[0] ?? [],
    resultSets.at(-1) ?? []
  )
  const unchanged = allResultsEqual(resultSets)
  const signalRange = Math.max(...signals, 0) - Math.min(...signals, 0)
  const classification: SensitivityClassification = unchanged
    ? expectation.direction === "observe"
      ? "unknown"
      : "no-op"
    : primary.directionalPass
      ? "wired"
      : signalRange === 0
        ? "saturated"
        : "unknown"
  const diagnostic =
    "Scenario " +
    scenario +
    ": " +
    classification +
    "; changed paired games " +
    pairedChangedCount +
    "/" +
    Math.min(resultSets[0]?.length ?? 0, resultSets.at(-1)?.length ?? 0) +
    "; endpoint delta " +
    primary.delta.toFixed(2) +
    "."
  return {
    scenario,
    arms,
    pairedCount: resultSets.length
      ? Math.min(...resultSets.map((results) => results.length))
      : 0,
    pairedChangedCount,
    primary,
    classification,
    diagnostic,
  }
}

function aggregateClassification(
  scenarios: SliderSensitivityScenarioResult[],
  direction: SensitivityDirection
): SensitivityClassification {
  const classifications = scenarios.map((scenario) => scenario.classification)
  if (classifications.includes("wired") && classifications.includes("no-op")) {
    return "conditional"
  }
  if (classifications.includes("wired")) return "wired"
  if (classifications.includes("saturated")) return "saturated"
  if (classifications.every((classification) => classification === "no-op")) {
    return direction === "observe" ? "unknown" : "no-op"
  }
  return "unknown"
}

export function runSliderSensitivity(
  options: SliderSensitivityOptions
): SliderSensitivityReport {
  if (!options.baseSeed.trim()) {
    throw new Error("Slider sensitivity runs require a base seed.")
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("Slider sensitivity count must be a positive integer.")
  }
  if (options.scenarios.length === 0) {
    throw new Error("Slider sensitivity runs require at least one scenario.")
  }

  const paths =
    options.paths ??
    GAME_SETTING_DESCRIPTORS.map((descriptor) => descriptor.path)
  const expectations = {
    ...DEFAULT_SLIDER_SENSITIVITY_EXPECTATIONS,
    ...options.expectations,
  }
  const results = paths.map((path) => {
    const descriptor = GAME_SETTING_DESCRIPTORS.find(
      (candidate) => candidate.path === path
    )!
    const scenarioResults = options.scenarios.map((scenario) => {
      const firstFixture = scenario.createFixture(options.baseSeed + ":1")
      const armValues = createArmValues(path, firstFixture.config)
      const armRuns = armValues.map((arm) => {
        const fixtures = new Map<string, GameMatchupFixture>()
        const batch = runMatchupBatch({
          baseSeed: options.baseSeed,
          count: options.count,
          createFixture: (seed) => {
            const fixture = scenario.createFixture(seed)
            const nextFixture = {
              ...fixture,
              config: updateGameNumericSetting(fixture.config, path, arm.value),
            }
            fixtures.set(seed, nextFixture)
            return nextFixture
          },
        })
        return {
          arm,
          batch,
          fixtures,
          metrics: mergeSensitivityMetrics(batch, fixtures),
        }
      })
      const arms = armRuns.map((run) => ({
        ...run.arm,
        effectiveConfig: run.batch.effectiveConfig,
        metrics: run.metrics,
      }))
      const expectation = expectations[path]!
      return classifyScenario(
        scenario.id,
        arms,
        armRuns.map((run) => run.batch.results),
        expectation
      )
    })
    const expectation = expectations[path]!
    return {
      path,
      label: descriptor.label,
      primaryMetric: expectation.primaryMetric,
      direction: expectation.direction,
      classification: aggregateClassification(
        scenarioResults,
        expectation.direction
      ),
      scenarios: scenarioResults,
      diagnostic: scenarioResults
        .map((scenario) => scenario.diagnostic)
        .join(" "),
    }
  })
  const baselineConfig =
    results[0]?.scenarios[0]?.arms.find((arm) => arm.label === "baseline")
      ?.effectiveConfig ?? firstScenarioBaseline(options)

  return {
    schema: "foh-slider-sensitivity",
    version: 1,
    baseSeed: options.baseSeed,
    count: options.count,
    baselineConfig,
    results,
  }
}

function firstScenarioBaseline(
  options: SliderSensitivityOptions
): GameSimulationConfig {
  const fixture = options.scenarios[0]!.createFixture(options.baseSeed + ":1")
  return fixture.config
}

export function serializeSliderSensitivityReport(
  report: SliderSensitivityReport
): string {
  sliderSensitivityReportSchema.parse(report)
  return JSON.stringify(report, null, 2)
}
