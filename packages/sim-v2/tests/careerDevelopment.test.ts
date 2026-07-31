import { describe, expect, it } from "vitest"

import {
  createPlayerContractFixture,
  createStandardPlayerGenerationConfig,
} from "@workspace/domain-v2"

import {
  advancePlayerCareerYear,
  createDeterministicRandom,
  getCareerPhase,
  resolveCareerDevelopmentSettings,
  STANDARD_CAREER_CURVE_RULES,
  validateCareerDevelopmentSettings,
} from "../src"

function createPlayer(
  overrides: Partial<{ age: number; peakAge: number; declineStartAge: number }>
) {
  const player = createPlayerContractFixture({ age: overrides.age ?? 22 })
  return {
    ...player,
    profile: {
      ...player.profile,
      development: {
        ...player.profile.development,
        peakAge: overrides.peakAge ?? 27,
        declineStartAge: overrides.declineStartAge ?? 32,
        volatility: 10,
      },
    },
  }
}

const context = {
  season: 1,
  minutes: 27 * 72,
  gamesPlayed: 72,
  gamesScheduled: 82,
  injuryDevelopmentPenalty: 0,
  coachingDevelopmentEmphasis: 50,
}

describe("advancePlayerCareerYear", () => {
  it("replays deterministically and keeps physical attributes stable", () => {
    const player = createPlayer({ age: 22 })
    const first = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("career-seed"),
    })
    const second = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("career-seed"),
    })

    expect(first).toEqual(second)
    expect(first.player.age).toBe(23)
    expect(first.player.profile.physical).toEqual(player.profile.physical)
    expect(first.availability.availabilityRate).toBeCloseTo(72 / 82)
  })

  it("applies growth, plateau, and decline phases", () => {
    expect(getCareerPhase(22, 27, 32)).toBe("growth")
    expect(getCareerPhase(29, 27, 32)).toBe("plateau")
    expect(getCareerPhase(34, 27, 32)).toBe("decline")

    const growth = advancePlayerCareerYear({
      player: createPlayer({ age: 22 }),
      context,
      random: createDeterministicRandom("growth"),
    })
    const decline = advancePlayerCareerYear({
      player: createPlayer({ age: 34 }),
      context,
      random: createDeterministicRandom("decline"),
    })

    expect(Object.values(growth.skillDeltas).some((delta) => delta > 0)).toBe(
      true
    )
    expect(Object.values(decline.skillDeltas).some((delta) => delta < 0)).toBe(
      true
    )
    expect(
      growth.events.some((event) => event.type === "skill-development")
    ).toBe(true)
  })

  it("develops at zero minutes and responds to opportunity with diminishing returns", () => {
    const player = createPlayer({ age: 22 })
    const zero = advancePlayerCareerYear({
      player,
      context: { ...context, minutes: 0 },
      random: createDeterministicRandom("matched-minutes"),
    })
    const typical = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("matched-minutes"),
    })
    const high = advancePlayerCareerYear({
      player,
      context: { ...context, minutes: 35 * 80 },
      random: createDeterministicRandom("matched-minutes"),
    })

    const total = (values: Record<string, number>) =>
      Object.values(values).reduce((sum, value) => sum + value, 0)
    expect(total(zero.skillDeltas)).toBeGreaterThan(0)
    expect(total(typical.skillDeltas)).toBeGreaterThan(total(zero.skillDeltas))
    expect(total(high.skillDeltas) - total(typical.skillDeltas)).toBeLessThan(
      total(typical.skillDeltas) - total(zero.skillDeltas)
    )
  })

  it("uses potential as a forecast signal without clamping skills to it", () => {
    const player = createPlayer({ age: 22 })
    const highPotential = {
      ...player,
      profile: {
        ...player.profile,
        development: { ...player.profile.development, potential: 98 },
      },
    }
    const lowPotential = {
      ...player,
      profile: {
        ...player.profile,
        development: { ...player.profile.development, potential: 72 },
      },
    }
    const high = advancePlayerCareerYear({
      player: highPotential,
      context,
      random: createDeterministicRandom("potential"),
      config: createStandardPlayerGenerationConfig(),
    })
    const low = advancePlayerCareerYear({
      player: lowPotential,
      context,
      random: createDeterministicRandom("potential"),
      config: createStandardPlayerGenerationConfig(),
    })

    expect(
      Object.values(high.skillDeltas).reduce((sum, value) => sum + value, 0)
    ).toBeGreaterThan(
      Object.values(low.skillDeltas).reduce((sum, value) => sum + value, 0)
    )
    expect(Math.max(...Object.values(high.player.profile.skills))).toBeLessThan(
      100
    )
  })

  it("applies curve tiers without changing the potential contract", () => {
    const player = createPlayer({ age: 22 })
    const slow = advancePlayerCareerYear({
      player: {
        ...player,
        profile: {
          ...player.profile,
          development: { ...player.profile.development, growthCurve: "slow" },
        },
      },
      context,
      random: createDeterministicRandom("curve-tier"),
      rules: STANDARD_CAREER_CURVE_RULES,
    })
    const elite = advancePlayerCareerYear({
      player: {
        ...player,
        profile: {
          ...player.profile,
          development: { ...player.profile.development, growthCurve: "elite" },
        },
      },
      context,
      random: createDeterministicRandom("curve-tier"),
      rules: STANDARD_CAREER_CURVE_RULES,
    })
    const total = (values: Record<string, number>) =>
      Object.values(values).reduce((sum, value) => sum + value, 0)

    expect(total(elite.skillDeltas)).toBeGreaterThan(total(slow.skillDeltas))
    expect(elite.player.profile.development.potential).toBe(
      player.profile.development.potential
    )
  })

  it("records deterministic trajectory-change events when enabled", () => {
    const player = createPlayer({ age: 22 })
    const result = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("forced-curve-transition"),
      rules: {
        ...STANDARD_CAREER_CURVE_RULES,
        growthTransitionChance: 1,
      },
    })

    expect(
      result.events.some((event) => event.type === "trajectory-change")
    ).toBe(true)
    expect(result.player.profile.development.growthCurve).not.toBe("standard")
  })

  it("resolves bounded settings and preserves curve ordering", () => {
    const settings = resolveCareerDevelopmentSettings({
      growthRateScale: 1.25,
      growthMultipliers: { fast: 1.5 },
      timingPreset: "late",
    })

    expect(settings.growthRateScale).toBe(1.25)
    expect(settings.growthMultipliers.fast).toBe(1.5)
    expect(settings.timingPreset).toBe("late")
    expect(validateCareerDevelopmentSettings({ growthRateScale: 4 })).toEqual([
      "Growth rate scale must be between 0.25 and 3.",
    ])
    expect(
      validateCareerDevelopmentSettings({
        growthMultipliers: { slow: 1.2, standard: 1 },
      })
    ).toEqual([
      "Growth multipliers must be ordered slow < standard < fast < elite.",
    ])
  })

  it("applies baseline scale and records controlled growth events", () => {
    const player = createPlayer({ age: 22 })
    const total = (values: Record<string, number>) =>
      Object.values(values).reduce((sum, value) => sum + value, 0)
    const baseline = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("settings-scale"),
      rules: STANDARD_CAREER_CURVE_RULES,
    })
    const accelerated = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("settings-scale"),
      rules: resolveCareerDevelopmentSettings({ growthRateScale: 2 }),
    })
    const stalled = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom("settings-events"),
      rules: resolveCareerDevelopmentSettings({
        stallChance: 1,
        stallMagnitude: 1,
      }),
    })

    expect(total(accelerated.skillDeltas)).toBeGreaterThan(
      total(baseline.skillDeltas)
    )
    expect(
      stalled.events.some((event) => event.type === "development-stall")
    ).toBe(true)
    expect(
      stalled.events.find((event) => event.type === "development-stall")
    ).toMatchObject({ delta: -1, reason: "calibration" })
  })

  it("does not develop retired players", () => {
    const player = createPlayer({ age: 38 })
    expect(() =>
      advancePlayerCareerYear({
        player: { ...player, leagueStatus: { kind: "retired" } },
        context,
        random: createDeterministicRandom("retired"),
      })
    ).toThrow("Retired players")
  })
})
