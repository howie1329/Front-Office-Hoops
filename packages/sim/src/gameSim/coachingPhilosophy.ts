import type { CoachingPhilosophy } from "@workspace/shared/types"

export function deriveCoachingPhilosophy(coachingLevel: number): CoachingPhilosophy {
  const level = Math.max(1, Math.min(10, Math.round(coachingLevel)))

  if (level <= 3) {
    return { pace: "slow", offense: "attack_rim", rotation: "tight" }
  }

  if (level <= 6) {
    return { pace: "balanced", offense: "balanced", rotation: "standard" }
  }

  if (level <= 8) {
    return { pace: "fast", offense: "perimeter", rotation: "standard" }
  }

  return { pace: "fast", offense: "balanced", rotation: "deep" }
}

export function philosophyPaceModifier(philosophy: CoachingPhilosophy): number {
  if (philosophy.pace === "fast") {
    return 2
  }
  if (philosophy.pace === "slow") {
    return -2
  }
  return 0
}
