import {
  MAX_GROWTH_MODIFIER,
  MIN_REGRESSION_MODIFIER,
} from "@workspace/shared/constants"
import type { SkillKey } from "@workspace/shared/types"

import type { DevelopmentModifier, SkillDeltas } from "./types"

const CATEGORY_CAPS: Record<string, { growth: number; regression: number }> = {
  culture: { growth: 0.15, regression: 0.1 },
  staff: { growth: 0.12, regression: 0.08 },
  mentorship: { growth: 0.15, regression: 0.1 },
  performance: { growth: 0.2, regression: 0.15 },
  injury: { growth: 0.3, regression: 0.3 },
  opportunity: { growth: 0.1, regression: 0.08 },
  event: { growth: 0.25, regression: 0.25 },
}

function sumBonuses(
  modifiers: DevelopmentModifier[],
  field: "growthBonus" | "regressionBonus",
  category?: string,
): number {
  return modifiers
    .filter((modifier) => !category || modifier.category === category)
    .reduce((sum, modifier) => sum + (modifier[field] ?? 0), 0)
}

function sumMultipliers(
  modifiers: DevelopmentModifier[],
  field: "growthMultiplier" | "regressionMultiplier",
): number {
  return modifiers.reduce(
    (product, modifier) => product * (modifier[field] ?? 1),
    1,
  )
}

export function applyModifiersToDeltas(
  deltas: SkillDeltas,
  modifiers: DevelopmentModifier[],
): SkillDeltas {
  let growthBonus = 0
  let regressionBonus = 0

  for (const [category, caps] of Object.entries(CATEGORY_CAPS)) {
    growthBonus += Math.min(
      caps.growth,
      sumBonuses(modifiers, "growthBonus", category),
    )
    regressionBonus += Math.min(
      caps.regression,
      sumBonuses(modifiers, "regressionBonus", category),
    )
  }

  growthBonus += sumBonuses(
    modifiers.filter((m) => !m.category),
    "growthBonus",
  )
  regressionBonus += sumBonuses(
    modifiers.filter((m) => !m.category),
    "regressionBonus",
  )

  const growthMultiplier = Math.min(
    MAX_GROWTH_MODIFIER,
    sumMultipliers(modifiers, "growthMultiplier") * (1 + growthBonus),
  )
  const regressionMultiplier = Math.max(
    MIN_REGRESSION_MODIFIER,
    sumMultipliers(modifiers, "regressionMultiplier") * (1 + regressionBonus),
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

export function sumPotentialDriftBias(
  modifiers: DevelopmentModifier[],
): number {
  return modifiers.reduce(
    (sum, modifier) => sum + (modifier.potentialDriftBias ?? 0),
    0,
  )
}
