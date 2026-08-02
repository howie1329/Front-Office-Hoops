import type {
  CareerAvailabilitySummary,
  CareerCurveRules,
  CareerCohortOptions,
  CareerCohortReport,
  CareerCohortSummary,
  CareerResolvedSettings,
  CareerIndividualOptions,
  CareerIndividualReport,
  CareerMatchedCohortOptions,
  CareerMatchedCohortReport,
  CareerMatchedPlayerPair,
  CareerSettingDifference,
  CareerRetirementContext,
  CareerSeasonResult,
  CareerSkillTrajectory,
  CareerTimeline,
  CareerSnapshot,
  FailedCareerFixture,
  PlayerEntity,
  PlayerGenerationConfig,
  PlayerSkillKey,
  PlayerSkills,
} from "@workspace/domain-v2"
import {
  getPlayerCurrentAbility,
  advancePlayerCareerYear,
  createDeterministicRandom,
  evaluatePlayerRetirement,
  getCareerPhase,
  CAREER_DEVELOPMENT_SETTINGS_VERSION,
  resolveCareerDevelopmentSettings,
  STANDARD_CAREER_CURVE_RULES,
} from "@workspace/sim-v2"

import {
  createCareerAnnualContext,
  createCareerGenerationConfig,
  createCareerPlayer,
} from "./careerFixtures"
import type { CareerFixture } from "./careerFixtures"
import {
  evaluateCareerBenchmark,
  NBA_LIKE_CAREER_BENCHMARK_PROFILE,
} from "./careerBenchmarks"
import type { CareerBenchmarkProfile } from "./careerBenchmarks"

export type CareerProgress = {
  completed: number
  total: number
  label: string
  seed: string
}

export type CareerIndividualRunOptions = CareerIndividualOptions & {
  config?: PlayerGenerationConfig
}

export type CareerCohortRunOptions = CareerCohortOptions & {
  benchmarkProfile?: CareerBenchmarkProfile
  fixedFixtures?: CareerFixture[]
  retainTimelines?: boolean
  onProgress?: (progress: CareerProgress) => void
  shouldCancel?: () => boolean
}

export type CareerTraceInput = {
  player: PlayerEntity
  seed: string
  options: CareerIndividualOptions
  config?: PlayerGenerationConfig
  rules?: CareerCurveRules
}

const skillKeys: PlayerSkillKey[] = [
  "shooting",
  "finishing",
  "passing",
  "handling",
  "rebounding",
  "defense",
  "basketballIQ",
  "stamina",
]

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.floor((sorted.length - 1) * fraction)
  return sorted[index] ?? 0
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function validateCommonOptions(options: CareerIndividualOptions): void {
  if (!options.seed.trim()) throw new Error("A career seed is required.")
  if (
    !Number.isInteger(options.startingAge) ||
    options.startingAge < 18 ||
    options.startingAge > 40
  ) {
    throw new RangeError(
      "Career starting age must be an integer from 18 to 40."
    )
  }
  if (
    !Number.isInteger(options.runYears) ||
    options.runYears < 1 ||
    options.runYears > 30
  ) {
    throw new RangeError(
      "Career run length must be an integer from 1 to 30 years."
    )
  }
}

function availabilityFromContext(
  context: ReturnType<typeof createCareerAnnualContext>
): CareerAvailabilitySummary {
  return {
    gamesScheduled: context.gamesScheduled,
    gamesPlayed: context.gamesPlayed,
    minutes: context.minutes,
    availabilityRate: context.gamesPlayed / context.gamesScheduled,
    injuryDevelopmentPenalty: context.injuryDevelopmentPenalty,
    injuryAffected: context.injuryDevelopmentPenalty > 0,
  }
}

function createCareerSnapshot(
  player: PlayerEntity,
  season: number,
  seasonResult: CareerSeasonResult
): CareerSnapshot {
  return {
    season,
    ageAtSeasonStart: player.age,
    playerAtSeasonStart: structuredClone(player),
    currentAbility: getPlayerCurrentAbility(player),
    potentialForecast: player.profile.development.potential,
    peakAge: player.profile.development.peakAge,
    declineStartAge: player.profile.development.declineStartAge,
    phase: getCareerPhase(
      player.age,
      player.profile.development.peakAge,
      player.profile.development.declineStartAge
    ),
    seasonResult,
  }
}

function createTimeline(input: CareerTraceInput): CareerTimeline {
  validateCommonOptions(input.options)
  if (!input.seed.trim()) throw new Error("A career trace seed is required.")

  const baseSeason = input.options.season ?? 1
  let player = structuredClone(input.player)
  const random = createDeterministicRandom(input.seed)
  const rules = input.rules ?? STANDARD_CAREER_CURVE_RULES
  const snapshots: CareerSnapshot[] = []
  let injuryHistory = 0
  let finalPlayer = structuredClone(player)
  let retirementAge: number | null = null
  let retirementSeason: number | null = null

  for (let offset = 0; offset < input.options.runYears; offset += 1) {
    const season = baseSeason + offset
    const seasonPlayer = structuredClone(player)
    const context = createCareerAnnualContext(input.options, season)
    injuryHistory = Math.min(
      1,
      injuryHistory * 0.7 + context.injuryDevelopmentPenalty * 0.3
    )
    const retirementContext: CareerRetirementContext = {
      season,
      gamesPlayed: context.gamesPlayed,
      gamesScheduled: context.gamesScheduled,
      minutes: context.minutes,
      injuryHistory,
      health: 100 - context.injuryDevelopmentPenalty * 45,
    }
    const retirement = evaluatePlayerRetirement({
      player,
      context: retirementContext,
      random,
    })

    let development: CareerSeasonResult["development"] = null
    if (retirement.retired) {
      retirementAge = player.age
      retirementSeason = season
      finalPlayer = { ...player, leagueStatus: { kind: "retired" as const } }
    } else {
      const transition = advancePlayerCareerYear({
        player,
        context,
        random,
        config: input.config,
        rules,
      })
      development = {
        phase: transition.phase,
        growthCurve: transition.player.profile.development.growthCurve,
        declineCurve: transition.player.profile.development.declineCurve,
        appliedGrowthMultiplier:
          rules.growthMultipliers[
            transition.player.profile.development.growthCurve
          ],
        appliedDeclineMultiplier:
          rules.declineMultipliers[
            transition.player.profile.development.declineCurve
          ],
        skillDeltas: transition.skillDeltas,
        events: transition.events,
      }
      player = transition.player
      finalPlayer = player
    }

    snapshots.push(
      createCareerSnapshot(seasonPlayer, season, {
        availability: availabilityFromContext(context),
        retirement,
        development,
      })
    )

    if (retirement.retired) break
  }

  const retired = retirementAge !== null
  const peakSnapshot = snapshots.reduce((best, current) =>
    current.currentAbility > best.currentAbility ? current : best
  )
  const finalAbility = getPlayerCurrentAbility(finalPlayer)
  const peakAbility = Math.max(peakSnapshot.currentAbility, finalAbility)
  const realizedPeakAge =
    finalAbility > peakSnapshot.currentAbility
      ? finalPlayer.age
      : peakSnapshot.ageAtSeasonStart
  const plateauLength = snapshots.filter(
    (snapshot) => snapshot.phase === "plateau"
  ).length

  return {
    playerId: input.player.id,
    seed: input.seed,
    startingAge: input.options.startingAge,
    snapshots,
    finalPlayer,
    retired,
    retirementAge,
    retirementSeason,
    seasonsSimulated: snapshots.length,
    terminationReason: retired ? "retired" : "horizon-complete",
    peakAbility,
    realizedPeakAge,
    plateauLength,
  }
}

function createResolvedSettings(
  options: CareerCohortOptions | CareerIndividualOptions,
  config: PlayerGenerationConfig,
  rules: CareerCurveRules
): CareerResolvedSettings {
  return {
    settingsVersion: CAREER_DEVELOPMENT_SETTINGS_VERSION,
    populationContext: options.populationContext,
    growthCurve: options.growthCurve,
    declineCurve: options.declineCurve,
    growthCurveWeights: structuredClone(config.development.growthCurveWeights),
    declineCurveWeights: structuredClone(
      config.development.declineCurveWeights
    ),
    growthMultipliers: structuredClone(rules.growthMultipliers),
    declineMultipliers: structuredClone(rules.declineMultipliers),
    growthTransitionChance: rules.growthTransitionChance,
    declineTransitionChance: rules.declineTransitionChance,
    growthRateScale: rules.growthRateScale,
    growthNoiseScale: rules.growthNoiseScale,
    stallChance: rules.stallChance,
    stallMagnitude: rules.stallMagnitude,
    surgeChance: rules.surgeChance,
    surgeMagnitude: rules.surgeMagnitude,
    timingPreset: rules.timingPreset,
  }
}

function createPlayerIndex(
  timelines: CareerTimeline[]
): CareerCohortReport["playerIndex"] {
  return timelines.map((timeline) => {
    const firstSnapshot = timeline.snapshots[0]
    const finalDevelopment = timeline.finalPlayer.profile.development
    return {
      playerId: timeline.playerId,
      seed: timeline.seed,
      startingAge: timeline.startingAge,
      finalAge: timeline.finalPlayer.age,
      finalAbility: getPlayerCurrentAbility(timeline.finalPlayer),
      peakAbility: timeline.peakAbility,
      realizedPeakAge: timeline.realizedPeakAge,
      peakAge: firstSnapshot?.peakAge ?? finalDevelopment.peakAge,
      declineStartAge:
        firstSnapshot?.declineStartAge ?? finalDevelopment.declineStartAge,
      growthCurve:
        firstSnapshot?.playerAtSeasonStart.profile.development.growthCurve ??
        finalDevelopment.growthCurve,
      declineCurve:
        firstSnapshot?.playerAtSeasonStart.profile.development.declineCurve ??
        finalDevelopment.declineCurve,
      retired: timeline.retired,
      retirementAge: timeline.retirementAge,
      seasonsSimulated: timeline.seasonsSimulated,
      terminationReason: timeline.terminationReason,
    }
  })
}

function skillStats(values: number[]): {
  average: number
  p10: number
  median: number
  p90: number
} {
  return {
    average: round(average(values)),
    p10: round(percentile(values, 0.1)),
    median: round(percentile(values, 0.5)),
    p90: round(percentile(values, 0.9)),
  }
}

function createTrajectory(
  timelines: CareerTimeline[],
  offset: number,
  baseSeason: number,
  startingAge: number
): CareerSkillTrajectory {
  const snapshots = timelines
    .map((timeline) => timeline.snapshots[offset])
    .filter((snapshot): snapshot is CareerSnapshot => Boolean(snapshot))
  const first = snapshots[0]
  const skills = Object.fromEntries(
    skillKeys.map((skill) => [
      skill,
      skillStats(
        snapshots.map(
          (snapshot) => snapshot.playerAtSeasonStart.profile.skills[skill]
        )
      ),
    ])
  ) as Record<
    PlayerSkillKey,
    { average: number; p10: number; median: number; p90: number }
  >
  const currentAbility = skillStats(
    snapshots.map((snapshot) => snapshot.currentAbility)
  )

  return {
    season: baseSeason + offset,
    age: first?.ageAtSeasonStart ?? startingAge + offset,
    activePlayers: snapshots.length,
    average: Object.fromEntries(
      skillKeys.map((skill) => [skill, skills[skill]?.average ?? 0])
    ) as PlayerSkills,
    p10: Object.fromEntries(
      skillKeys.map((skill) => [skill, skills[skill]?.p10 ?? 0])
    ) as PlayerSkills,
    median: Object.fromEntries(
      skillKeys.map((skill) => [skill, skills[skill]?.median ?? 0])
    ) as PlayerSkills,
    p90: Object.fromEntries(
      skillKeys.map((skill) => [skill, skills[skill]?.p90 ?? 0])
    ) as PlayerSkills,
    currentAbility,
  }
}

function correlation(left: number[], right: number[]): number {
  if (left.length < 2 || left.length !== right.length) return 0
  const leftMean = average(left)
  const rightMean = average(right)
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * ((right[index] ?? rightMean) - rightMean),
    0
  )
  const leftVariance = left.reduce(
    (sum, value) => sum + (value - leftMean) ** 2,
    0
  )
  const rightVariance = right.reduce(
    (sum, value) => sum + (value - rightMean) ** 2,
    0
  )
  if (leftVariance === 0 || rightVariance === 0) return 0
  return round(numerator / Math.sqrt(leftVariance * rightVariance))
}

function createSummary(
  timelines: CareerTimeline[],
  options: CareerCohortOptions,
  failedSeeds: string[]
): CareerCohortSummary {
  const baseSeason = options.season ?? 1
  const trajectories = Array.from({ length: options.runYears }, (_, offset) =>
    createTrajectory(timelines, offset, baseSeason, options.startingAge)
  )
  const initialAbilities = timelines.map(
    (timeline) => timeline.snapshots[0]?.currentAbility ?? 0
  )
  const finalAbilities = timelines.map((timeline) =>
    getPlayerCurrentAbility(timeline.finalPlayer)
  )
  const peakAges = timelines.map(
    (timeline) => timeline.snapshots[0]?.peakAge ?? 0
  )
  const declineAges = timelines.map(
    (timeline) => timeline.snapshots[0]?.declineStartAge ?? 0
  )
  const realizedPeaks = timelines.map((timeline) => timeline.peakAbility)
  const forecasts = timelines.map(
    (timeline) => timeline.snapshots[0]?.potentialForecast ?? 0
  )
  const retired = timelines.filter((timeline) => timeline.retired)
  const availabilityValues = timelines.flatMap((timeline) =>
    timeline.snapshots.map(
      (snapshot) => snapshot.seasonResult.availability.availabilityRate
    )
  )
  const injuryAffectedSeasons = timelines.reduce(
    (sum, timeline) =>
      sum +
      timeline.snapshots.filter(
        (snapshot) => snapshot.seasonResult.availability.injuryAffected
      ).length,
    0
  )
  const retirementAgeCounts = new Map<number, number>()
  for (const timeline of retired) {
    if (timeline.retirementAge === null) continue
    retirementAgeCounts.set(
      timeline.retirementAge,
      (retirementAgeCounts.get(timeline.retirementAge) ?? 0) + 1
    )
  }
  const growthToPeak = average(
    timelines.map(
      (timeline, index) => timeline.peakAbility - (initialAbilities[index] ?? 0)
    )
  )
  const declineRate = average(
    timelines.map((timeline, index) => {
      const finalAge = timeline.finalPlayer.age
      const seasons = Math.max(1, finalAge - timeline.realizedPeakAge)
      return (
        Math.max(0, timeline.peakAbility - (finalAbilities[index] ?? 0)) /
        seasons
      )
    })
  )
  const breakoutRate = timelines.length
    ? timelines.filter(
        (timeline, index) =>
          timeline.peakAbility - (initialAbilities[index] ?? 0) >= 8
      ).length / timelines.length
    : 0
  const bustRate = timelines.length
    ? timelines.filter(
        (timeline) =>
          timeline.snapshots[0]!.potentialForecast - timeline.peakAbility >= 10
      ).length / timelines.length
    : 0
  const lateBloomerRate = timelines.length
    ? timelines.filter(
        (timeline) =>
          timeline.realizedPeakAge >= (timeline.snapshots[0]?.peakAge ?? 0) + 2
      ).length / timelines.length
    : 0
  const averageForecast = average(forecasts)
  const averageRealizedPeak = average(realizedPeaks)
  const potentialErrors = forecasts.map(
    (forecast, index) => forecast - (realizedPeaks[index] ?? forecast)
  )
  const withinForecastErrorRate = (limit: number) =>
    timelines.length
      ? potentialErrors.filter((error) => Math.abs(error) <= limit).length /
        timelines.length
      : 0
  const surgeTimelines = timelines.filter((timeline) =>
    timeline.snapshots.some((snapshot) =>
      snapshot.seasonResult.development?.events.some(
        (event) => event.type === "development-surge"
      )
    )
  )
  const stallTimelines = timelines.filter((timeline) =>
    timeline.snapshots.some((snapshot) =>
      snapshot.seasonResult.development?.events.some(
        (event) => event.type === "development-stall"
      )
    )
  )
  const surgeCount = timelines.reduce(
    (count, timeline) =>
      count +
      timeline.snapshots.reduce(
        (seasonCount, snapshot) =>
          seasonCount +
          (snapshot.seasonResult.development?.events.filter(
            (event) => event.type === "development-surge"
          ).length ?? 0),
        0
      ),
    0
  )
  const stallCount = timelines.reduce(
    (count, timeline) =>
      count +
      timeline.snapshots.reduce(
        (seasonCount, snapshot) =>
          seasonCount +
          (snapshot.seasonResult.development?.events.filter(
            (event) => event.type === "development-stall"
          ).length ?? 0),
        0
      ),
    0
  )
  const outlierTimelines = [...timelines]
    .sort(
      (left, right) =>
        Math.abs(
          right.peakAbility - (right.snapshots[0]?.currentAbility ?? 0)
        ) -
        Math.abs(left.peakAbility - (left.snapshots[0]?.currentAbility ?? 0))
    )
    .slice(0, 3)

  return {
    playerCount: timelines.length,
    startingAge: options.startingAge,
    runYears: options.runYears,
    skillTrajectories: trajectories,
    averagePeakAge: round(average(peakAges)),
    averageDeclineStartAge: round(average(declineAges)),
    averagePlateauLength: round(
      average(timelines.map((timeline) => timeline.plateauLength))
    ),
    growthToPeak: round(growthToPeak),
    declineRate: round(declineRate),
    breakoutRate: round(breakoutRate),
    bustRate: round(bustRate),
    lateBloomerRate: round(lateBloomerRate),
    availabilityRate: round(average(availabilityValues)),
    injuryAffectedSeasons,
    retirementRate: timelines.length
      ? round(retired.length / timelines.length)
      : 0,
    retirementAgeDistribution: [...retirementAgeCounts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([age, count]) => ({
        age,
        count,
        rate: timelines.length ? round(count / timelines.length) : 0,
      })),
    potentialForecastVsRealizedPeak: {
      averageForecast: round(averageForecast),
      averageRealizedPeak: round(averageRealizedPeak),
      correlation: correlation(forecasts, realizedPeaks),
    },
    potentialForecastError: {
      mean: round(average(potentialErrors)),
      median: round(percentile(potentialErrors, 0.5)),
      p10: round(percentile(potentialErrors, 0.1)),
      p90: round(percentile(potentialErrors, 0.9)),
      within1Rate: round(withinForecastErrorRate(1)),
      within3Rate: round(withinForecastErrorRate(3)),
      within5Rate: round(withinForecastErrorRate(5)),
      within10Rate: round(withinForecastErrorRate(10)),
      exceededForecastRate: timelines.length
        ? round(
            realizedPeaks.filter(
              (realizedPeak, index) => realizedPeak > (forecasts[index] ?? 0)
            ).length / timelines.length
          )
        : 0,
    },
    growthEvents: {
      surgeCount,
      stallCount,
      surgeRate: timelines.length
        ? round(surgeTimelines.length / timelines.length)
        : 0,
      stallRate: timelines.length
        ? round(stallTimelines.length / timelines.length)
        : 0,
    },
    failedSeeds,
    outlierTimelines,
  }
}

export function runCareerTrace(input: CareerTraceInput): CareerTimeline {
  return createTimeline(input)
}

export function runIndividualCareer(
  options: CareerIndividualRunOptions
): CareerIndividualReport {
  validateCommonOptions(options)
  const { config, ...reportOptions } = options
  const rules = resolveCareerDevelopmentSettings(options.settings)
  const fixture = createCareerPlayer(
    options.seed,
    options.startingAge,
    options.developmentContext,
    config,
    options,
    options.populationContext,
    rules.timingPreset
  )
  const timeline = createTimeline({
    player: fixture.player,
    seed: options.seed,
    options,
    config: fixture.config,
    rules,
  })
  return {
    schema: "foh-career-individual-lab",
    version: 5,
    options: reportOptions,
    timeline,
    resolvedSettings: createResolvedSettings(options, fixture.config, rules),
    failedFixtures: [],
  }
}

export function runCareerCohort(
  options: CareerCohortRunOptions
): CareerCohortReport {
  validateCommonOptions(options)
  if (
    !Number.isInteger(options.sampleSize) ||
    options.sampleSize < 1 ||
    options.sampleSize > 100000
  ) {
    throw new RangeError("Career cohort sample size must be from 1 to 100,000.")
  }
  if (
    options.fixedFixtures &&
    options.fixedFixtures.length !== options.sampleSize
  ) {
    throw new RangeError(
      "Fixed career fixtures must match the requested cohort sample size."
    )
  }

  const rules = resolveCareerDevelopmentSettings(options.settings)

  const timelines: CareerTimeline[] = []
  const failedFixtures: FailedCareerFixture[] = []
  let cancelled = false
  for (let index = 0; index < options.sampleSize; index += 1) {
    if (options.shouldCancel?.()) {
      cancelled = true
      break
    }
    const seed = `${options.seed}:player:${index + 1}`
    try {
      const fixture =
        options.fixedFixtures?.[index] ??
        createCareerPlayer(
          seed,
          options.startingAge,
          options.developmentContext,
          undefined,
          options,
          options.populationContext,
          rules.timingPreset
        )
      timelines.push(
        createTimeline({
          player: fixture.player,
          seed,
          options,
          config: fixture.config,
          rules,
        })
      )
    } catch (error) {
      failedFixtures.push({
        seed,
        message:
          error instanceof Error
            ? error.message
            : "Unknown career fixture failure.",
      })
    }
    options.onProgress?.({
      completed: index + 1,
      total: options.sampleSize,
      label: "Career cohort",
      seed,
    })
  }

  const summary = createSummary(
    timelines,
    options,
    failedFixtures.map((fixture) => fixture.seed)
  )
  const benchmark = options.benchmarkProfile
    ? evaluateCareerBenchmark(summary, options.benchmarkProfile)
    : null
  const resolvedConfig = createCareerGenerationConfig(
    options.developmentContext,
    options.populationContext
  )
  return {
    schema: "foh-career-cohort-lab",
    version: 5,
    options: {
      seed: options.seed,
      startingAge: options.startingAge,
      sampleSize: options.sampleSize,
      runYears: options.runYears,
      minutesContext: options.minutesContext,
      coachingContext: options.coachingContext,
      injuryContext: options.injuryContext,
      developmentContext: options.developmentContext,
      populationContext: options.populationContext,
      growthCurve: options.growthCurve,
      declineCurve: options.declineCurve,
      ...(options.settings === undefined ? {} : { settings: options.settings }),
      ...(options.season === undefined ? {} : { season: options.season }),
    },
    completed: timelines.length + failedFixtures.length,
    cancelled,
    summary,
    resolvedSettings: createResolvedSettings(options, resolvedConfig, rules),
    playerIndex: createPlayerIndex(timelines),
    timelines: options.retainTimelines ? timelines : undefined,
    benchmark,
    failedFixtures,
  }
}

function flattenCareerRules(
  rules: CareerCurveRules
): Record<string, number | string> {
  return {
    growthRateScale: rules.growthRateScale,
    growthNoiseScale: rules.growthNoiseScale,
    stallChance: rules.stallChance,
    stallMagnitude: rules.stallMagnitude,
    surgeChance: rules.surgeChance,
    surgeMagnitude: rules.surgeMagnitude,
    growthTransitionChance: rules.growthTransitionChance,
    declineTransitionChance: rules.declineTransitionChance,
    timingPreset: rules.timingPreset,
    "growthMultipliers.slow": rules.growthMultipliers.slow,
    "growthMultipliers.standard": rules.growthMultipliers.standard,
    "growthMultipliers.fast": rules.growthMultipliers.fast,
    "growthMultipliers.elite": rules.growthMultipliers.elite,
    "declineMultipliers.durable": rules.declineMultipliers.durable,
    "declineMultipliers.standard": rules.declineMultipliers.standard,
    "declineMultipliers.early": rules.declineMultipliers.early,
    "declineMultipliers.steep": rules.declineMultipliers.steep,
  }
}

function diffCareerRules(
  baseline: CareerCurveRules,
  variant: CareerCurveRules
): CareerSettingDifference[] {
  const baselineValues = flattenCareerRules(baseline)
  const variantValues = flattenCareerRules(variant)
  return Object.keys(baselineValues)
    .filter((path) => baselineValues[path] !== variantValues[path])
    .map((path) => ({
      path,
      baseline: baselineValues[path]!,
      variant: variantValues[path]!,
    }))
}

export type CareerMatchedCohortRunOptions = CareerMatchedCohortOptions & {
  benchmarkProfile?: CareerBenchmarkProfile
  retainTimelines?: boolean
  onProgress?: (progress: CareerProgress) => void
  shouldCancel?: () => boolean
}

export function runMatchedCareerCohort(
  options: CareerMatchedCohortRunOptions
): CareerMatchedCohortReport {
  const baselineRules = resolveCareerDevelopmentSettings(options.settings)
  const variantRules = resolveCareerDevelopmentSettings(options.variantSettings)
  const settingsDiff = diffCareerRules(baselineRules, variantRules)

  if (settingsDiff.length !== 1) {
    throw new RangeError(
      "Matched career runs must differ by exactly one development setting."
    )
  }
  if (settingsDiff[0]?.path === "timingPreset") {
    throw new RangeError(
      "Timing presets cannot be matched without changing generated player profiles."
    )
  }

  const fixtures: CareerFixture[] = Array.from(
    { length: options.sampleSize },
    (_, index) => {
      const seed = `${options.seed}:player:${index + 1}`
      return createCareerPlayer(
        seed,
        options.startingAge,
        options.developmentContext,
        undefined,
        options,
        options.populationContext,
        baselineRules.timingPreset
      )
    }
  )
  const progress = (label: string) => (next: CareerProgress) =>
    options.onProgress?.({ ...next, label: `${label}: ${next.label}` })

  const baseline = runCareerCohort({
    ...options,
    settings: options.settings,
    fixedFixtures: fixtures,
    onProgress: progress("Baseline"),
  })
  const variant = runCareerCohort({
    ...options,
    settings: options.variantSettings,
    fixedFixtures: fixtures,
    onProgress: progress("Variant"),
  })
  const playerPairs: CareerMatchedPlayerPair[] = baseline.playerIndex.map(
    (player, index) => {
      const variantPlayer = variant.playerIndex[index]
      return {
        seed: player.seed,
        baselinePlayerId: player.playerId,
        variantPlayerId: variantPlayer?.playerId ?? player.playerId,
      }
    }
  )

  return {
    schema: "foh-career-matched-cohort-lab",
    version: 1,
    options: baseline.options,
    baseline,
    variant,
    settingsDiff,
    playerPairs,
  }
}

export function serializeCareerCohortReport(
  report: CareerCohortReport
): string {
  return JSON.stringify(report, null, 2)
}

export function serializeCareerMatchedCohortReport(
  report: CareerMatchedCohortReport
): string {
  return JSON.stringify(report, null, 2)
}

export function serializeCareerIndividualReport(
  report: CareerIndividualReport
): string {
  return JSON.stringify(report, null, 2)
}

export { NBA_LIKE_CAREER_BENCHMARK_PROFILE }
export type { CareerBenchmarkProfile }
