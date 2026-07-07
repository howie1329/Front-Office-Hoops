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

export async function estimatePotentialFromCareerSim(
  overall: number,
  age: number,
  peakAge: number,
  rng: Rng,
): Promise<number> {
  const simulations = 24
  const outcomes: number[] = []

  for (let index = 0; index < simulations; index++) {
    let projectedOverall = overall
    let projectedAge = age

    while (projectedAge < 32) {
      const yearsToPeak = Math.max(0, peakAge - projectedAge)
      const growth =
        projectedAge < peakAge
          ? Math.min(4, yearsToPeak * 0.35 + rng.normal(0, 0.8))
          : rng.normal(-1.2, 0.6)

      projectedOverall = Math.max(
        RATING_MIN,
        Math.min(RATING_MAX, projectedOverall + growth),
      )
      projectedAge += 1
    }

    outcomes.push(projectedOverall)
  }

  outcomes.sort((a, b) => a - b)
  const percentileIndex = Math.floor(simulations * 0.75)
  return outcomes[percentileIndex] ?? estimatePotentialForecast(overall, age, rng)
}

export function estimatePotential(
  overall: number,
  age: number,
  _peakAge: number,
  rng: Rng,
): number {
  return estimatePotentialForecast(overall, age, rng)
}
