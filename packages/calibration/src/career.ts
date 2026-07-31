import type {
  CareerAvailabilitySummary,
  CareerCohortOptions,
  CareerCohortReport,
  CareerCohortSummary,
  CareerIndividualOptions,
  CareerIndividualReport,
  CareerRetirementContext,
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
} from "@workspace/sim-v2"

import { createCareerAnnualContext, createCareerPlayer } from "./careerFixtures"
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
  retainTimelines?: boolean
  onProgress?: (progress: CareerProgress) => void
  shouldCancel?: () => boolean
}

export type CareerTraceInput = {
  player: PlayerEntity
  seed: string
  options: CareerIndividualOptions
  config?: PlayerGenerationConfig
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
  context: ReturnType<typeof createCareerAnnualContext>,
  retirement: CareerSnapshot["retirement"],
  events: CareerSnapshot["events"]
): CareerSnapshot {
  return {
    season,
    age: player.age,
    player: structuredClone(player),
    currentAbility: getPlayerCurrentAbility(player),
    potentialForecast: player.profile.development.potential,
    peakAge: player.profile.development.peakAge,
    declineStartAge: player.profile.development.declineStartAge,
    phase: getCareerPhase(
      player.age,
      player.profile.development.peakAge,
      player.profile.development.declineStartAge
    ),
    events,
    availability: availabilityFromContext(context),
    retirement,
  }
}

function createTimeline(input: CareerTraceInput): CareerTimeline {
  validateCommonOptions(input.options)
  if (!input.seed.trim()) throw new Error("A career trace seed is required.")

  const baseSeason = input.options.season ?? 1
  let player = structuredClone(input.player)
  const random = createDeterministicRandom(input.seed)
  const snapshots: CareerSnapshot[] = []
  let injuryHistory = 0
  let pendingEvents: CareerSnapshot["events"] = []

  for (let offset = 0; offset <= input.options.runYears; offset += 1) {
    const season = baseSeason + offset
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
    const snapshotPlayer = retirement.retired
      ? { ...player, leagueStatus: { kind: "retired" as const } }
      : player
    snapshots.push(
      createCareerSnapshot(
        snapshotPlayer,
        season,
        context,
        retirement,
        pendingEvents
      )
    )

    if (retirement.retired || offset === input.options.runYears) break

    const transition = advancePlayerCareerYear({
      player,
      context,
      random,
      config: input.config,
    })
    player = transition.player
    pendingEvents = transition.events
  }

  const finalSnapshot = snapshots.at(-1)!
  const retired = finalSnapshot.retirement.retired
  const finalPlayer = retired
    ? { ...player, leagueStatus: { kind: "retired" as const } }
    : player
  const peakSnapshot = snapshots.reduce((best, current) =>
    current.currentAbility > best.currentAbility ? current : best
  )
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
    retirementAge: retired ? finalSnapshot.age : null,
    peakAbility: peakSnapshot.currentAbility,
    realizedPeakAge: peakSnapshot.age,
    plateauLength,
  }
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
        snapshots.map((snapshot) => snapshot.player.profile.skills[skill])
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
    age: first?.age ?? startingAge + offset,
    activePlayers: snapshots.filter((snapshot) => !snapshot.retirement.retired)
      .length,
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
  const trajectories = Array.from(
    { length: options.runYears + 1 },
    (_, offset) =>
      createTrajectory(timelines, offset, baseSeason, options.startingAge)
  )
  const initialAbilities = timelines.map(
    (timeline) => timeline.snapshots[0]?.currentAbility ?? 0
  )
  const finalAbilities = timelines.map(
    (timeline) => timeline.snapshots.at(-1)?.currentAbility ?? 0
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
    timeline.snapshots.map((snapshot) => snapshot.availability.availabilityRate)
  )
  const injuryAffectedSeasons = timelines.reduce(
    (sum, timeline) =>
      sum +
      timeline.snapshots.filter(
        (snapshot) => snapshot.availability.injuryAffected
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
      const finalAge =
        timeline.snapshots.at(-1)?.age ?? timeline.realizedPeakAge
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
  const fixture = createCareerPlayer(
    options.seed,
    options.startingAge,
    options.developmentContext,
    config
  )
  const timeline = createTimeline({
    player: fixture.player,
    seed: options.seed,
    options,
    config: fixture.config,
  })
  return {
    schema: "foh-career-individual-lab",
    version: 1,
    options: reportOptions,
    timeline,
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
      const fixture = createCareerPlayer(
        seed,
        options.startingAge,
        options.developmentContext
      )
      timelines.push(
        createTimeline({
          player: fixture.player,
          seed,
          options,
          config: fixture.config,
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
  return {
    schema: "foh-career-cohort-lab",
    version: 1,
    options: {
      seed: options.seed,
      startingAge: options.startingAge,
      sampleSize: options.sampleSize,
      runYears: options.runYears,
      minutesContext: options.minutesContext,
      coachingContext: options.coachingContext,
      injuryContext: options.injuryContext,
      developmentContext: options.developmentContext,
      ...(options.season === undefined ? {} : { season: options.season }),
    },
    completed: timelines.length + failedFixtures.length,
    cancelled,
    summary,
    timelines: options.retainTimelines ? timelines : undefined,
    benchmark,
    failedFixtures,
  }
}

export function serializeCareerCohortReport(
  report: CareerCohortReport
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
