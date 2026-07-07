import type { RotationEntry, RotationQuality } from "@workspace/shared/types"

export const RATING_CENTER = 60
export const POSSESSION_NOISE_STDDEV = 3

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function round(value: number): number {
  return Math.max(0, Math.round(value))
}

export function ratingFactor(value: number): number {
  return (value - RATING_CENTER) / 20
}

export function weightedAverage(
  rotation: RotationEntry[],
  getValue: (entry: RotationEntry) => number,
): number {
  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0)

  if (totalMinutes === 0) {
    return RATING_CENTER
  }

  return (
    rotation.reduce((sum, entry) => sum + getValue(entry) * entry.minutes, 0) /
    totalMinutes
  )
}

export function rotationQuality(rotation: RotationEntry[]): RotationQuality {
  const byMinutes = [...rotation].sort((a, b) => b.minutes - a.minutes)
  const average = (entries: RotationEntry[]) =>
    entries.length === 0
      ? 0
      : entries.reduce((sum, entry) => sum + entry.player.ratings.overall, 0) /
        entries.length

  return {
    top2: average(byMinutes.slice(0, 2)),
    starters: average(byMinutes.slice(0, 5)),
    bench: average(byMinutes.slice(5)),
    fullRotation: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.overall,
    ),
  }
}

export function averageRatings(rotation: RotationEntry[]) {
  return {
    threePoint: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.threePoint,
    ),
    midRange: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.midRange,
    ),
    freeThrow: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.freeThrow,
    ),
    inside: weightedAverage(rotation, (entry) => entry.player.ratings.inside),
    passing: weightedAverage(rotation, (entry) => entry.player.ratings.passing),
    ballHandling: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.ballHandling,
    ),
    offensiveIQ: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.offensiveIQ,
    ),
    defensiveIQ: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.defensiveIQ,
    ),
    rebounding: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.rebounding,
    ),
    defense: weightedAverage(rotation, (entry) => entry.player.ratings.defense),
    stamina: weightedAverage(rotation, (entry) => entry.player.ratings.stamina),
    usage: weightedAverage(rotation, (entry) => entry.player.ratings.usage),
  }
}

export function estimatePossessions(
  homePace: number,
  awayPace: number,
  paceModifier: number,
  rng: { normal: (mean?: number, stdDev?: number) => number },
): number {
  const pace = (homePace + awayPace) / 2 + paceModifier
  return Math.max(
    80,
    Math.round(pace + rng.normal(0, POSSESSION_NOISE_STDDEV)),
  )
}
