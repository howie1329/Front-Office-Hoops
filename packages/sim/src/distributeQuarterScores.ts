import type { QuarterScores, Rng } from "@workspace/shared/types"

const BASE_QUARTER_WEIGHTS = [1.05, 0.95, 0.95, 1.05] as const
const WEIGHT_NOISE_STDDEV = 0.08

function distributeRemainder(
  quarters: number[],
  rawValues: number[],
  finalScore: number,
): QuarterScores {
  let remainder = finalScore - quarters.reduce((sum, value) => sum + value, 0)

  const order = rawValues
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let pointer = 0
  while (remainder > 0) {
    const target = order[pointer % order.length]
    if (target) {
      quarters[target.index] = (quarters[target.index] ?? 0) + 1
    }
    remainder -= 1
    pointer += 1
  }

  return quarters as QuarterScores
}

export function distributeQuarterScores(
  finalScore: number,
  rng: Rng,
): QuarterScores {
  if (finalScore === 0) {
    return [0, 0, 0, 0]
  }

  const weights = BASE_QUARTER_WEIGHTS.map((weight) =>
    Math.max(0.01, weight * rng.normal(1, WEIGHT_NOISE_STDDEV)),
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  const rawValues = weights.map((weight) => (weight / totalWeight) * finalScore)
  const quarters = rawValues.map((value) => Math.floor(value))

  return distributeRemainder(quarters, rawValues, finalScore)
}
