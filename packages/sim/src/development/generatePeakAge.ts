import { PEAK_AGE_MAX, PEAK_AGE_MIN } from "@workspace/shared/constants"
import type { Rng } from "@workspace/shared/types"

export function generatePeakAge(
  age: number,
  overall: number,
  potential: number,
  rng: Rng
): number {
  const potentialGap = potential - overall
  let peakAge: number

  if (age <= 22 && potentialGap >= 8) {
    peakAge = rng.int(29, 32)
  } else if (age <= 22 && potentialGap <= 3) {
    peakAge = rng.int(25, 28)
  } else if (age >= 30) {
    peakAge = rng.int(28, Math.min(age, PEAK_AGE_MAX))
  } else {
    peakAge = rng.int(27, 31)
  }

  peakAge = Math.max(PEAK_AGE_MIN, Math.min(PEAK_AGE_MAX, peakAge))

  if (age < 30) {
    peakAge = Math.max(peakAge, age - 1)
  }

  return peakAge
}

export function derivePeakAgeFallback(
  age: number,
  overall: number,
  potential: number
): number {
  const potentialGap = potential - overall
  let peakAge = 28 + Math.round(potentialGap / 3)

  peakAge = Math.max(PEAK_AGE_MIN, Math.min(PEAK_AGE_MAX, peakAge))

  if (age < 30) {
    peakAge = Math.max(peakAge, age - 1)
  }

  return peakAge
}
