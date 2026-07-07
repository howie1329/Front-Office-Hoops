import type { Player } from "@workspace/shared/types"
import { PERFORMANCE_DRIFT_MAX } from "@workspace/shared/financialConstants"

export function estimatePerformanceDrift(
  player: Player,
  minutes: number,
  pointsPerGame: number,
): number {
  if (minutes < 500) {
    return player.performanceDrift ?? 0
  }

  const expectedPoints = player.ratings.overall * 0.28
  const delta = (pointsPerGame - expectedPoints) / 4
  const next = (player.performanceDrift ?? 0) + delta * 0.35
  return Math.max(-PERFORMANCE_DRIFT_MAX, Math.min(PERFORMANCE_DRIFT_MAX, next))
}

export function applyPerformanceDriftToTalent(
  overall: number,
  performanceDrift: number,
): number {
  return overall + performanceDrift
}
