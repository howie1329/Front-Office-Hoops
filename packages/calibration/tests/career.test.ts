import { describe, expect, it } from "vitest"

import {
  careerCohortReportSchema,
  deserializeCareerCohortReport,
  serializeCareerCohortReport as serializeValidatedCareerCohortReport,
} from "@workspace/league-schema"

import {
  NBA_LIKE_CAREER_BENCHMARK_PROFILE,
  runCareerCohort,
  runIndividualCareer,
  runCareerTrace,
  serializeCareerCohortReport,
} from "../src"
import { createCareerPlayer } from "../src/careerFixtures"

const options = {
  seed: "career-cohort-test",
  startingAge: 20,
  sampleSize: 24,
  runYears: 5,
  minutesContext: "typical" as const,
  coachingContext: "standard" as const,
  injuryContext: "normal" as const,
  developmentContext: "standard" as const,
  populationContext: "draft-class" as const,
  growthCurve: "distribution" as const,
  declineCurve: "distribution" as const,
}

describe("career calibration runner", () => {
  it("replays individual and cohort runs deterministically", () => {
    const first = runCareerCohort({
      ...options,
      benchmarkProfile: NBA_LIKE_CAREER_BENCHMARK_PROFILE,
      retainTimelines: true,
    })
    const second = runCareerCohort({
      ...options,
      benchmarkProfile: NBA_LIKE_CAREER_BENCHMARK_PROFILE,
      retainTimelines: true,
    })

    expect(first).toEqual(second)
    expect(first.completed).toBe(options.sampleSize)
    expect(first.summary.skillTrajectories).toHaveLength(options.runYears)
    expect(first.summary.failedSeeds).toEqual([])
    expect(first.playerIndex).toHaveLength(options.sampleSize)
    expect(first.resolvedSettings).toMatchObject({
      populationContext: "draft-class",
      growthCurve: "distribution",
      declineCurve: "distribution",
    })
    expect(first.benchmark?.checks.averagePeakAge).toBeDefined()
    expect(careerCohortReportSchema.safeParse(first).success).toBe(true)
  })

  it("keeps yearly trace data and final retirement state separate", () => {
    const fixture = createCareerPlayer("trace-player", 24)
    const individualOptions = {
      seed: options.seed,
      startingAge: options.startingAge,
      runYears: options.runYears,
      minutesContext: options.minutesContext,
      coachingContext: options.coachingContext,
      injuryContext: options.injuryContext,
      developmentContext: options.developmentContext,
      populationContext: options.populationContext,
      growthCurve: options.growthCurve,
      declineCurve: options.declineCurve,
    }
    const timeline = runCareerTrace({
      player: fixture.player,
      seed: "trace-player",
      options: individualOptions,
      config: fixture.config,
    })
    const report = runIndividualCareer(individualOptions)

    expect(timeline.snapshots[0]?.potentialForecast).toBe(
      fixture.player.profile.development.potential
    )
    expect(timeline.snapshots[0]?.ageAtSeasonStart).toBe(24)
    expect(timeline.snapshots).toHaveLength(individualOptions.runYears)
    expect(timeline.seasonsSimulated).toBe(individualOptions.runYears)
    expect(timeline.terminationReason).toBe("horizon-complete")
    expect(
      timeline.snapshots[0]?.seasonResult.development?.events.every(
        (event) => event.season === timeline.snapshots[0]?.season
      )
    ).toBe(true)
    expect(
      report.timeline.snapshots[0]?.seasonResult.development?.events.length
    ).toBeGreaterThan(0)
    expect(report.timeline.finalPlayer.profile.physical).toEqual(
      report.timeline.snapshots[0]?.playerAtSeasonStart.profile.physical
    )
  })

  it("retains failed seeds and supports cancellation", () => {
    let calls = 0
    const report = runCareerCohort({
      ...options,
      sampleSize: 10,
      shouldCancel: () => calls++ >= 3,
    })

    expect(report.cancelled).toBe(true)
    expect(report.completed).toBe(3)
    expect(report.failedFixtures).toEqual([])
  })

  it("supports the calibration starting-age matrix", () => {
    for (const startingAge of [19, 24, 29, 34]) {
      const report = runCareerCohort({
        ...options,
        startingAge,
        sampleSize: 4,
        runYears: 10,
      })
      expect(report.summary.startingAge).toBe(startingAge)
      expect(report.summary.skillTrajectories).toHaveLength(10)
      expect(careerCohortReportSchema.safeParse(report).success).toBe(true)
    }
  })

  it("round-trips the strict career report envelope", () => {
    const report = runCareerCohort({ ...options, sampleSize: 3 })
    const serialized = serializeValidatedCareerCohortReport(report)
    expect(deserializeCareerCohortReport(serialized)).toEqual(report)
    expect(JSON.parse(serializeCareerCohortReport(report))).toMatchObject({
      schema: "foh-career-cohort-lab",
      version: 4,
      completed: 3,
    })
  })

  it("forwards development settings into the engine and report", () => {
    const settings = {
      growthRateScale: 1.25,
      growthNoiseScale: 0.5,
      growthMultipliers: {
        slow: 0.6,
        standard: 1,
        fast: 1.45,
        elite: 1.9,
      },
      declineMultipliers: {
        durable: 0.6,
        standard: 1,
        early: 1.35,
        steep: 1.9,
      },
      timingPreset: "late" as const,
    }
    const report = runCareerCohort({
      ...options,
      sampleSize: 4,
      runYears: 3,
      settings,
      retainTimelines: true,
    })

    expect(report.options.settings).toEqual(settings)
    expect(report.resolvedSettings).toMatchObject({
      settingsVersion: 1,
      growthRateScale: 1.25,
      growthNoiseScale: 0.5,
      timingPreset: "late",
      growthMultipliers: settings.growthMultipliers,
      declineMultipliers: settings.declineMultipliers,
    })
    expect(report.timelines?.[0]?.snapshots[0]?.peakAge).toBeGreaterThanOrEqual(
      options.startingAge
    )
    expect(careerCohortReportSchema.safeParse(report).success).toBe(true)

    const individual = runIndividualCareer({
      ...options,
      settings,
    })
    expect(individual.resolvedSettings).toMatchObject({
      growthRateScale: 1.25,
      timingPreset: "late",
    })
  })
})
