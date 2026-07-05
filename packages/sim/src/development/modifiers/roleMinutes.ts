import type { DevelopmentContext, DevelopmentModifier } from "../types"

export function computeRoleMinutesModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const profile = context.seasonProfile
  if (!profile) {
    return null
  }

  const age = context.player.age

  if (age <= 24) {
    if (profile.mpg >= 22 && profile.gp >= 20) {
      return {
        id: "performance:young_opportunity",
        source: "performance",
        growthMultiplier: 1.08,
        potentialDriftBias: 0.08,
      }
    }

    if (profile.gp <= 10 || profile.mpg < 8) {
      return {
        id: "performance:young_buried",
        source: "performance",
        growthMultiplier: 0.94,
        potentialDriftBias: -0.08,
      }
    }
  }

  if (age >= 30 && profile.mpg >= 32 && profile.gp >= 35) {
    return {
      id: "performance:veteran_workload",
      source: "performance",
      regressionMultiplier: 1.06,
      skillBonuses: {
        stamina: -0.25,
      },
    }
  }

  return null
}
