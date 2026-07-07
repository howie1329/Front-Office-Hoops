import { SKILL_KEYS } from "@workspace/shared/constants"
import type { Player } from "@workspace/shared/types"

import { clampRating } from "../playerRatings"
import type { SkillDeltas } from "./types"

export function applySkillDeltas(player: Player, deltas: SkillDeltas): Player {
  const nextRatings = { ...player.ratings }

  for (const skill of SKILL_KEYS) {
    const current = player.ratings[skill]
    const raw = current + deltas[skill]
    nextRatings[skill] = clampRating(raw)
  }

  return {
    ...player,
    ratings: nextRatings,
  }
}
