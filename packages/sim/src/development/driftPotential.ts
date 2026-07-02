import { RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import type { Player, Rng } from "@workspace/shared/types"

import type { DevelopmentModifier } from "./types"

export function driftPotential(
  player: Player,
  modifiers: DevelopmentModifier[],
  rng: Rng,
): number {
  const { age, peakAge, ratings } = player
  const { potential } = ratings
  const driftBias = modifiers.reduce(
    (sum, modifier) => sum + (modifier.potentialDriftBias ?? 0),
    0,
  )

  const roll = rng.next() + driftBias

  if (age < peakAge - 2) {
    if (roll < 0.2) return Math.max(RATING_MIN, potential - 1)
    if (roll < 0.6) return potential
    return Math.min(RATING_MAX, potential + 1)
  }

  if (age > peakAge + 2) {
    if (roll < 0.4) return Math.max(RATING_MIN, potential - 1)
    if (roll < 0.8) return potential
    return Math.min(RATING_MAX, potential + 1)
  }

  if (roll < 0.35) return Math.max(RATING_MIN, potential - 1)
  if (roll < 0.7) return potential
  return Math.min(RATING_MAX, potential + 1)
}
