import type { CoachingPace } from "@workspace/shared/types"

export function philosophyPaceModifier(pace: CoachingPace): number {
  if (pace === "fast") {
    return 4
  }
  if (pace === "slow") {
    return -4
  }
  return 0
}
