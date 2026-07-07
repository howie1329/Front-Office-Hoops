import type {
  CoachingPhilosophy,
  RotationEntry,
  SegmentKind,
} from "@workspace/shared/types"

import {
  applyBlowoutRotation,
  redistributeSegmentMinutes,
} from "./blowout"
import { rotationBenchBoost, segmentMinuteBudget, type SegmentPlan } from "./segments"

export function applySegmentRotation(
  baseRotation: RotationEntry[],
  plan: SegmentPlan,
  margin: number,
  philosophy: CoachingPhilosophy | undefined,
): RotationEntry[] {
  const budget = segmentMinuteBudget(plan)
  let rotation = baseRotation.map((entry) => ({ ...entry }))

  if (plan.benchBoost > 0 || rotationBenchBoost(philosophy, plan) > 0) {
    const boost = plan.benchBoost + rotationBenchBoost(philosophy, plan)
    const sorted = [...rotation].sort((a, b) => b.minutes - a.minutes)
    const starterIds = new Set(sorted.slice(0, 5).map((entry) => entry.player.id))

    rotation = rotation.map((entry) => {
      if (starterIds.has(entry.player.id)) {
        return {
          ...entry,
          minutes: Math.max(0, entry.minutes - Math.round(entry.minutes * boost * 0.15)),
        }
      }
      return {
        ...entry,
        minutes: entry.minutes + Math.round(entry.minutes * boost * 0.2),
      }
    })
  }

  rotation = applyBlowoutRotation(rotation, margin, plan.kind as SegmentKind)
  return redistributeSegmentMinutes(rotation, budget)
}

export function accumulatePlayerMinutes(
  totals: Map<string, number>,
  rotation: RotationEntry[],
): void {
  for (const entry of rotation) {
    totals.set(
      entry.player.id,
      (totals.get(entry.player.id) ?? 0) + entry.minutes,
    )
  }
}

export function mergeRotationsWithSegmentMinutes(
  baseRotation: RotationEntry[],
  segmentMinutes: Map<string, number>,
): RotationEntry[] {
  return baseRotation.map((entry) => ({
    ...entry,
    minutes: segmentMinutes.get(entry.player.id) ?? 0,
  }))
}
