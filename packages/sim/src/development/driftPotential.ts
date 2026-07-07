import { RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import type { Player, Rng } from "@workspace/shared/types"

import { estimatePotential } from "../playerGeneration/estimatePotential"
import type { DevelopmentModifier } from "./types"

export function refreshPotentialProjection(
  player: Player,
  _modifiers: DevelopmentModifier[],
  rng: Rng,
): number {
  const next = estimatePotential(
    player.ratings.overall,
    player.age,
    player.peakAge,
    rng,
  )

  const drift = rng.int(-1, 1)
  return Math.max(RATING_MIN, Math.min(RATING_MAX, next + drift))
}

// Backwards-compatible alias while callers migrate.
export const driftPotential = refreshPotentialProjection
