import {
  POTENTIAL_OVERSHOOT_ALLOWANCE,
  RATING_MAX,
  RATING_MIN,
  SKILL_KEYS,
} from "@workspace/shared/constants"
import type { Player, SkillKey } from "@workspace/shared/types"

import { clampRating } from "../playerRatings"
import type { SkillDeltas } from "./types"

export function applySkillDeltas(player: Player, deltas: SkillDeltas): Player {
  const potentialCeiling = player.ratings.potential + POTENTIAL_OVERSHOOT_ALLOWANCE
  const nextRatings = { ...player.ratings }

  for (const skill of SKILL_KEYS) {
    const current = player.ratings[skill]
    const raw = current + deltas[skill]
    const capped = Math.min(potentialCeiling, raw)
    nextRatings[skill] = clampRating(capped)
  }

  return {
    ...player,
    ratings: nextRatings,
  }
}
