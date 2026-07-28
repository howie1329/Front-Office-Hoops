import type { Player, PlayerSeasonStats } from "@workspace/shared/types"
import { PERFORMANCE_DRIFT_MAX } from "@workspace/shared/financialConstants"

const MIN_QUALIFYING_MINUTES = 500

function per36(value: number, minutes: number): number {
  return (value / Math.max(1, minutes)) * 36
}

function expectedProduction(player: Player, stats: PlayerSeasonStats): number {
  const positionRebounding = player.position === "C" || player.position === "PF" ? 8 : 4.5
  const positionPassing = player.position === "PG" ? 7 : player.position === "SG" ? 4 : 2.5
  const defensiveEvents = player.ratings.defense * 0.07
  const roleUsage = Math.max(
    0.8,
    Math.min(1.2, (stats.fga + stats.fta * 0.44 + stats.tov) / Math.max(1, stats.min) * 2.4),
  )
  return (
    (player.ratings.overall * 0.23 +
      positionRebounding * 1.15 +
      positionPassing * 1.45 +
      defensiveEvents -
      2.4) *
    roleUsage
  )
}

export function getSeasonProductionSignal(
  player: Player,
  stats: PlayerSeasonStats | undefined,
): number {
  if (!stats || stats.min < MIN_QUALIFYING_MINUTES) {
    return 0
  }

  const shootingEfficiency =
    stats.pts / Math.max(1, 2 * (stats.fga + 0.44 * stats.fta))
  const weightedPer36 =
    per36(stats.pts, stats.min) +
    per36(stats.reb, stats.min) * 1.15 +
    per36(stats.ast, stats.min) * 1.45 +
    per36(stats.stl + stats.blk, stats.min) * 2 +
    (shootingEfficiency - 0.54) * 18 -
    per36(stats.tov, stats.min) * 1.2
  const expected = expectedProduction(player, stats)
  return Math.max(-1, Math.min(1, (weightedPer36 - expected) / Math.max(8, expected)))
}

export function estimatePerformanceDrift(
  player: Player,
  stats: PlayerSeasonStats | undefined,
): number {
  if (!stats || stats.min < MIN_QUALIFYING_MINUTES) {
    return player.performanceDrift ?? 0
  }

  const next =
    (player.performanceDrift ?? 0) + getSeasonProductionSignal(player, stats) * 0.9
  return Math.max(-PERFORMANCE_DRIFT_MAX, Math.min(PERFORMANCE_DRIFT_MAX, next))
}

export function applyPerformanceDriftToTalent(
  overall: number,
  performanceDrift: number,
): number {
  return overall + performanceDrift
}
