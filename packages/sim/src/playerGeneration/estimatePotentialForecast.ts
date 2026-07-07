import { RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import type { Rng } from "@workspace/shared/types"

export function estimatePotentialForecast(
  overall: number,
  age: number,
  rng: Rng,
): number {
  if (age >= 29) {
    return Math.round(overall)
  }

  const noise = rng.int(-2, 2)
  const forecast =
    42 + -1.55 * age + 0.83 * overall + Math.max(0, (24 - age) * 0.8) + noise

  return Math.round(
    Math.max(RATING_MIN, Math.min(RATING_MAX, forecast)),
  )
}
