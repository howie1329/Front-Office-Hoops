import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  Rng,
} from "@workspace/shared/types"

import {
  computeCoachingModifier,
  computeCultureModifier,
  computeInjuryModifier,
  computePerformanceModifier,
} from "./modifiers/index"
import { computeRoleMinutesModifier } from "./modifiers/roleMinutes"
import { computeVeteranMentorshipModifier } from "./modifiers/veteranMentorship"
import type { DevelopmentContext, DevelopmentModifier } from "./types"

export function collectModifiers(context: DevelopmentContext): DevelopmentModifier[] {
  const modifiers: DevelopmentModifier[] = []

  const candidates = [
    computeVeteranMentorshipModifier(context),
    computeRoleMinutesModifier(context),
    computePerformanceModifier(context),
    computeInjuryModifier(context),
    computeCoachingModifier(context),
    computeCultureModifier(context),
  ]

  for (const modifier of candidates) {
    if (modifier) {
      modifiers.push(modifier)
    }
  }

  return modifiers
}

export function buildDevelopmentContext(input: {
  player: Player
  team: import("@workspace/shared/types").TeamWithRoster
  season: number
  seasonStats?: PlayerSeasonStats
  seasonProfile?: PlayerSeasonProfile
  teammates: Player[]
  rng: Rng
  cultureScore?: number
  coachingLevel?: number
  developmentLevel?: number
}): DevelopmentContext {
  return input
}
