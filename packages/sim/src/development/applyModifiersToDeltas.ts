import type { SkillKey } from "@workspace/shared/types"

import type { DevelopmentModifier, SkillDeltas } from "./types"

const MAX_GROWTH_MULTIPLIER = 1.5
const MIN_REGRESSION_MULTIPLIER = 0.5

export function applyModifiersToDeltas(
  deltas: SkillDeltas,
  modifiers: DevelopmentModifier[],
): SkillDeltas {
  const growthMultiplier = Math.min(
    MAX_GROWTH_MULTIPLIER,
    modifiers.reduce(
      (product, modifier) => product * (modifier.growthMultiplier ?? 1),
      1,
    ),
  )
  const regressionMultiplier = Math.max(
    MIN_REGRESSION_MULTIPLIER,
    modifiers.reduce(
      (product, modifier) => product * (modifier.regressionMultiplier ?? 1),
      1,
    ),
  )

  const adjusted = {} as SkillDeltas

  for (const skill of Object.keys(deltas) as SkillKey[]) {
    const delta = deltas[skill]
    let nextDelta = delta

    if (delta > 0) {
      nextDelta = delta * growthMultiplier
    } else if (delta < 0) {
      nextDelta = delta * regressionMultiplier
    }

    const skillBonus = modifiers.reduce(
      (sum, modifier) => sum + (modifier.skillBonuses?.[skill] ?? 0),
      0,
    )

    adjusted[skill] = nextDelta + skillBonus
  }

  return adjusted
}
