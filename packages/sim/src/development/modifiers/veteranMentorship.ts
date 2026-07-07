import {
  DEVELOPMENT_START_AGE,
  VETERAN_GROWTH_BONUS,
  VETERAN_REGRESSION_BONUS,
  VETERAN_TAG,
} from "@workspace/shared/constants"

import type { DevelopmentContext, DevelopmentModifier } from "../types"

export function computeVeteranMentorshipModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const veteranCount = context.teammates.filter((teammate) =>
    teammate.tags.includes(VETERAN_TAG),
  ).length

  if (veteranCount === 0) {
    return null
  }

  const mentorStrength = Math.min(1, veteranCount * 0.4)
  const { age, peakAge } = context.player

  if (age < peakAge) {
    const yearsToPeak = peakAge - age
    const developmentWindow = Math.max(1, peakAge - DEVELOPMENT_START_AGE)
    const intensity = Math.max(0, Math.min(1, yearsToPeak / developmentWindow))

    if (intensity <= 0) {
      return null
    }

    return {
      id: "team:veteran_mentorship_growth",
      source: "team",
      category: "mentorship",
      growthMultiplier: 1 + VETERAN_GROWTH_BONUS * mentorStrength * intensity,
    }
  }

  if (age >= peakAge) {
    return {
      id: "team:veteran_mentorship_regression",
      source: "team",
      category: "mentorship",
      regressionMultiplier: 1 - VETERAN_REGRESSION_BONUS * mentorStrength,
    }
  }

  return null
}
