import { BASE_OFF_RATING } from "@workspace/shared/constants"
import type { Rng, RotationEntry } from "@workspace/shared/types"

const RATING_CENTER = 50
const OFF_RATING_MULTIPLIER = 8
const DEF_RATING_MULTIPLIER = 6
const OFF_RATING_NOISE_STDDEV = 2

function weightedAverage(
  rotation: RotationEntry[],
  getValue: (entry: RotationEntry) => number,
): number {
  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0)

  if (totalMinutes === 0) {
    return RATING_CENTER
  }

  const weighted = rotation.reduce(
    (sum, entry) => sum + getValue(entry) * entry.minutes,
    0,
  )

  return weighted / totalMinutes
}

export function estimateTeamOffFactor(rotation: RotationEntry[]): number {
  const offensiveRating = weightedAverage(
    rotation,
    (entry) =>
      (entry.player.ratings.shooting +
        entry.player.ratings.inside +
        entry.player.ratings.passing) /
      3,
  )

  return (offensiveRating - RATING_CENTER) / RATING_CENTER
}

export function estimateTeamDefFactor(rotation: RotationEntry[]): number {
  const defensiveRating = weightedAverage(
    rotation,
    (entry) => entry.player.ratings.defense,
  )

  return (defensiveRating - RATING_CENTER) / RATING_CENTER
}

export function estimateOffRtg(
  rotation: RotationEntry[],
  oppDefenseFactor: number,
  rng: Rng,
): number {
  const offFactor = estimateTeamOffFactor(rotation)
  const noise = rng.normal(0, OFF_RATING_NOISE_STDDEV)

  return (
    BASE_OFF_RATING +
    offFactor * OFF_RATING_MULTIPLIER -
    oppDefenseFactor * DEF_RATING_MULTIPLIER +
    noise
  )
}
