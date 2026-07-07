import type { CoachingPhilosophy, SegmentKind } from "@workspace/shared/types"
import { TEAM_MINUTES } from "@workspace/shared/constants"

export type SegmentPlan = {
  kind: SegmentKind
  quarterIndex: number
  index: number
  possessionShare: number
  minuteShare: number
  benchBoost: number
}

const REGULATION_SHARES: Array<{
  kind: SegmentKind
  possessionShare: number
  benchBoost: number
}> = [
  { kind: "q1", possessionShare: 0.26, benchBoost: 0 },
  { kind: "q2", possessionShare: 0.24, benchBoost: 0.1 },
  { kind: "q3", possessionShare: 0.24, benchBoost: 0 },
  { kind: "q4", possessionShare: 0.26, benchBoost: 0 },
]

export function buildRegulationSegmentPlans(): SegmentPlan[] {
  return REGULATION_SHARES.map((segment, index) => ({
    kind: segment.kind,
    quarterIndex: index,
    index,
    possessionShare: segment.possessionShare,
    minuteShare: segment.possessionShare,
    benchBoost: segment.benchBoost,
  }))
}

export function buildOvertimeSegmentPlan(
  otIndex: number,
  possessionsPerTeam = 10,
  totalPossessions: number,
): SegmentPlan {
  const share = possessionsPerTeam / totalPossessions
  return {
    kind: "ot",
    quarterIndex: -1,
    index: 4 + otIndex,
    possessionShare: share,
    minuteShare: share,
    benchBoost: 0,
  }
}

export function segmentPossessionCount(
  totalPossessions: number,
  plan: SegmentPlan,
): number {
  return Math.max(1, Math.round(totalPossessions * plan.possessionShare))
}

export function segmentMinuteBudget(plan: SegmentPlan): number {
  return Math.max(1, Math.round(TEAM_MINUTES * plan.minuteShare))
}

export function rotationBenchBoost(
  philosophy: CoachingPhilosophy | undefined,
  plan: SegmentPlan,
): number {
  let boost = plan.benchBoost

  if (plan.kind === "q2") {
    if (philosophy?.rotation === "deep") {
      boost += 0.15
    } else if (philosophy?.rotation === "tight") {
      boost -= 0.15
    }
  }

  return boost
}
