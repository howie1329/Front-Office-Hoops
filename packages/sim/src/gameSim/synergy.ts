import type {
  LineupSynergyGrade,
  RotationEntry,
  SynergyBreakdown,
} from "@workspace/shared/types"

import type { SegmentModifiers } from "./types"

function gradeFromScore(score: number): LineupSynergyGrade {
  if (score >= 80) return "A"
  if (score >= 65) return "B"
  if (score >= 50) return "C"
  if (score >= 35) return "D"
  return "F"
}

function topRotation(rotation: RotationEntry[], count = 5): RotationEntry[] {
  return [...rotation].sort((a, b) => b.minutes - a.minutes).slice(0, count)
}

export function computeLineupSynergy(
  rotation: RotationEntry[],
): SynergyBreakdown {
  const onCourt = topRotation(rotation)
  const archetypes = onCourt.map((entry) => entry.player.archetype)
  const bonuses: string[] = []
  const penalties: string[] = []
  let score = 50

  const has = (archetype: string) => archetypes.includes(archetype as never)

  if (has("lead_guard") && has("stretch_big")) {
    score += 12
    bonuses.push("lead_guard+stretch_big: spacing & passing")
  }

  if (has("rim_protector")) {
    const guardDefense = onCourt.some(
      (entry) =>
        (entry.player.position === "PG" || entry.player.position === "SG") &&
        entry.player.ratings.defense >= 65,
    )
    if (guardDefense) {
      score += 8
      bonuses.push("rim_protector+perimeter_defense: paint protection")
    }
  }

  if (has("point_forward") && has("scoring_guard")) {
    score += 6
    bonuses.push("point_forward+scoring_guard: ball movement")
  }

  const wings = onCourt.filter((entry) =>
    ["three_and_d_wing", "defensive_specialist"].includes(entry.player.archetype),
  )
  if (wings.length >= 2) {
    score += 5
    bonuses.push("multiple_wings: perimeter defense")
  }

  const highUsage = onCourt.filter((entry) => entry.player.ratings.usage >= 70)
  if (highUsage.length >= 3) {
    score -= 10
    penalties.push("too_many_usage_players: turnover risk")
  }

  const hasInterior = onCourt.some((entry) =>
    ["rim_protector", "rebounding_big", "post_scorer"].includes(
      entry.player.archetype,
    ),
  )
  if (!hasInterior) {
    score -= 8
    penalties.push("no_interior_presence: paint vulnerable")
  }

  if (has("lead_guard") && has("slasher")) {
    score += 4
    bonuses.push("lead_guard+slasher: drive & kick")
  }

  return {
    grade: gradeFromScore(score),
    score: Math.max(0, Math.min(100, score)),
    bonuses,
    penalties,
  }
}

export function synergyToModifiers(synergy: SynergyBreakdown): SegmentModifiers {
  const normalized = (synergy.score - 50) / 50

  return {
    efficiencyShift: normalized * 0.02,
    tpaRateShift: synergy.penalties.some((p) => p.includes("paint")) ? 0 : 0,
    ftaRateShift: synergy.penalties.some((p) => p.includes("paint")) ? 0.02 : 0,
    tovRateShift: synergy.penalties.some((p) => p.includes("usage")) ? 0.015 : 0,
    homeCourtPoints: 0,
    fatiguePenalty: 0,
    benchDragMultiplier: 1,
  }
}

export function mergeSynergyModifiers(
  base: SegmentModifiers,
  synergy: SegmentModifiers,
): SegmentModifiers {
  return {
    efficiencyShift: base.efficiencyShift + synergy.efficiencyShift,
    tpaRateShift: base.tpaRateShift + synergy.tpaRateShift,
    ftaRateShift: base.ftaRateShift + synergy.ftaRateShift,
    tovRateShift: base.tovRateShift + synergy.tovRateShift,
    homeCourtPoints: base.homeCourtPoints + synergy.homeCourtPoints,
    fatiguePenalty: base.fatiguePenalty + synergy.fatiguePenalty,
    benchDragMultiplier: base.benchDragMultiplier * synergy.benchDragMultiplier,
  }
}
