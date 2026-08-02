import type {
  CareerAnnualContext,
  CareerCohortOptions,
  CareerPopulationContext,
  CareerDevelopmentPreset,
  CareerTimingPreset,
  CareerMinutesPreset,
  PlayerEntity,
  PlayerGenerationConfig,
} from "@workspace/domain-v2"
import {
  createPlayerPopulationPreset,
  createStandardPlayerGenerationConfig,
} from "@workspace/domain-v2"
import {
  createDeterministicRandom,
  generatePlayerWithDiagnostics,
} from "@workspace/sim-v2"

export type CareerFixture = {
  seed: string
  player: PlayerEntity
  config: PlayerGenerationConfig
}

function cloneConfig(config: PlayerGenerationConfig): PlayerGenerationConfig {
  return structuredClone(config)
}

export function createCareerGenerationConfig(
  preset: CareerDevelopmentPreset,
  populationContext: CareerPopulationContext = "roster"
): PlayerGenerationConfig {
  const populationPresetId =
    populationContext === "draft-class"
      ? "draft-class"
      : populationContext === "free-agent"
        ? "initial-free-agents"
        : "initial-roster"
  const config = cloneConfig(
    populationContext === "roster"
      ? createStandardPlayerGenerationConfig()
      : createPlayerPopulationPreset(populationPresetId).config
  )
  if (preset === "high-potential") {
    config.development.potential = {
      ...config.development.potential,
      center: 16,
      spread: 4,
    }
  }
  if (preset === "low-potential") {
    config.development.potential = {
      ...config.development.potential,
      center: 2,
      spread: 2,
    }
  }
  if (preset === "high-volatility") {
    config.development.volatility = {
      ...config.development.volatility,
      center: 62,
      spread: 16,
    }
  }
  return config
}

export function createCareerPlayer(
  seed: string,
  startingAge: number,
  preset: CareerDevelopmentPreset = "standard",
  config?: PlayerGenerationConfig,
  curveOverrides?: Pick<CareerCohortOptions, "growthCurve" | "declineCurve">,
  populationContext: CareerPopulationContext = "roster",
  timingPreset: CareerTimingPreset = "standard"
): CareerFixture {
  if (!seed.trim()) throw new Error("A career fixture seed is required.")
  if (!Number.isInteger(startingAge) || startingAge < 18 || startingAge > 40) {
    throw new RangeError(
      "Career starting age must be an integer from 18 to 40."
    )
  }

  const effectiveConfig =
    config ?? createCareerGenerationConfig(preset, populationContext)
  const result = generatePlayerWithDiagnostics(
    createDeterministicRandom(seed),
    {
      id: `career:${seed}:player`,
      age: startingAge,
      identity: { firstName: null, lastName: null },
    },
    effectiveConfig
  )
  const timingOffset =
    timingPreset === "early" ? -1 : timingPreset === "late" ? 1 : 0
  const peakAge = Math.max(
    startingAge,
    Math.min(45, result.player.profile.development.peakAge + timingOffset)
  )
  const declineStartAge = Math.max(
    peakAge + 1,
    Math.min(
      50,
      result.player.profile.development.declineStartAge + timingOffset
    )
  )
  const player = {
    ...result.player,
    profile: {
      ...result.player.profile,
      development: {
        ...result.player.profile.development,
        peakAge,
        declineStartAge,
        ...(curveOverrides?.growthCurve &&
        curveOverrides.growthCurve !== "distribution"
          ? { growthCurve: curveOverrides.growthCurve }
          : {}),
        ...(curveOverrides?.declineCurve &&
        curveOverrides.declineCurve !== "distribution"
          ? { declineCurve: curveOverrides.declineCurve }
          : {}),
      },
    },
  }
  return {
    seed,
    player,
    config: effectiveConfig,
  }
}

export function resolveCareerGames(
  injuryContext: CareerCohortOptions["injuryContext"]
): { gamesPlayed: number; gamesScheduled: number; penalty: number } {
  switch (injuryContext) {
    case "healthy":
      return { gamesPlayed: 82, gamesScheduled: 82, penalty: 0 }
    case "injured":
      return { gamesPlayed: 48, gamesScheduled: 82, penalty: 0.55 }
    case "normal":
      return { gamesPlayed: 72, gamesScheduled: 82, penalty: 0.12 }
  }
}

export function resolveCareerMinutes(
  minutesContext: CareerMinutesPreset
): number {
  switch (minutesContext) {
    case "zero":
      return 0
    case "low":
      return 12 * 60
    case "typical":
      return 27 * 72
    case "high":
      return 35 * 80
  }
}

export function resolveCareerCoachingEmphasis(
  coachingContext: CareerCohortOptions["coachingContext"]
): number {
  switch (coachingContext) {
    case "weak":
      return 25
    case "standard":
      return 50
    case "strong":
      return 75
  }
}

export function createCareerAnnualContext(
  options: Pick<
    CareerCohortOptions,
    "minutesContext" | "coachingContext" | "injuryContext"
  >,
  season: number
): CareerAnnualContext {
  const games = resolveCareerGames(options.injuryContext)
  return {
    season,
    minutes: resolveCareerMinutes(options.minutesContext),
    gamesPlayed: games.gamesPlayed,
    gamesScheduled: games.gamesScheduled,
    injuryDevelopmentPenalty: games.penalty,
    coachingDevelopmentEmphasis: resolveCareerCoachingEmphasis(
      options.coachingContext
    ),
  }
}
