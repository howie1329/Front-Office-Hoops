import type {
  DefensiveScheme,
  LineupSynergyGrade,
  OffensiveScheme,
  PlayerArchetype,
  RotationEntry,
  SynergyBreakdown,
} from "@workspace/shared/types"

import {
  archetypeFitsDefensiveScheme,
  archetypeFitsOffensiveScheme,
} from "../staff/schemeFit"
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

function schemeFitScore(
  onCourt: RotationEntry[],
  fits: (archetype: PlayerArchetype) => boolean,
  label: string,
): { score: number; bonuses: string[]; penalties: string[] } {
  const bonuses: string[] = []
  const penalties: string[] = []
  const totalMinutes = onCourt.reduce((sum, entry) => sum + entry.minutes, 0)

  if (totalMinutes === 0) {
    return { score: 50, bonuses, penalties }
  }

  const fitMinutes = onCourt.reduce((sum, entry) => {
    return sum + (fits(entry.player.archetype) ? entry.minutes : 0)
  }, 0)

  const fitRatio = fitMinutes / totalMinutes
  let score = 50 + Math.round((fitRatio - 0.5) * 40)

  if (fitRatio >= 0.7) {
    bonuses.push(`${label}: strong scheme fit`)
  } else if (fitRatio >= 0.55) {
    bonuses.push(`${label}: good scheme fit`)
  } else if (fitRatio < 0.35) {
    penalties.push(`${label}: poor scheme fit`)
    score -= 8
  }

  return { score, bonuses, penalties }
}

export function computeOffensiveSynergy(
  rotation: RotationEntry[],
  offensiveScheme: OffensiveScheme,
): SynergyBreakdown {
  if (offensiveScheme === "balanced") {
    return { grade: gradeFromScore(50), score: 50, bonuses: [], penalties: [] }
  }
  const onCourt = topRotation(rotation)
  const bonuses: string[] = []
  const penalties: string[] = []

  const fit = schemeFitScore(onCourt, (archetype) =>
    archetypeFitsOffensiveScheme(archetype, offensiveScheme),
  "offense",
  )
  let score = fit.score
  bonuses.push(...fit.bonuses)
  penalties.push(...fit.penalties)

  const archetypes = onCourt.map((entry) => entry.player.archetype)
  const has = (archetype: string) => archetypes.includes(archetype as never)

  if (has("lead_guard") && has("stretch_big")) {
    score += 6
    bonuses.push("lead_guard+stretch_big: spacing & passing")
  }

  const highUsage = onCourt.filter((entry) => entry.player.ratings.usage >= 70)
  if (highUsage.length >= 3) {
    score -= 10
    penalties.push("too_many_usage_players: turnover risk")
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

export function computeDefensiveSynergy(
  rotation: RotationEntry[],
  defensiveScheme: DefensiveScheme,
): SynergyBreakdown {
  const onCourt = topRotation(rotation)
  const bonuses: string[] = []
  const penalties: string[] = []

  const fit = schemeFitScore(onCourt, (archetype) =>
    archetypeFitsDefensiveScheme(archetype, defensiveScheme),
  "defense",
  )
  let score = fit.score
  bonuses.push(...fit.bonuses)
  penalties.push(...fit.penalties)

  const archetypes = onCourt.map((entry) => entry.player.archetype)
  const has = (archetype: string) => archetypes.includes(archetype as never)

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

  const wings = onCourt.filter((entry) =>
    ["three_and_d_wing", "defensive_specialist"].includes(entry.player.archetype),
  )
  if (wings.length >= 2) {
    score += 5
    bonuses.push("multiple_wings: perimeter defense")
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

  return {
    grade: gradeFromScore(score),
    score: Math.max(0, Math.min(100, score)),
    bonuses,
    penalties,
  }
}

export function combineSynergyBreakdowns(
  offensive: SynergyBreakdown,
  defensive: SynergyBreakdown,
): SynergyBreakdown {
  const score = Math.round((offensive.score + defensive.score) / 2)
  return {
    grade: gradeFromScore(score),
    score,
    bonuses: [...offensive.bonuses, ...defensive.bonuses],
    penalties: [...offensive.penalties, ...defensive.penalties],
  }
}

/** @deprecated Use computeOffensiveSynergy / computeDefensiveSynergy */
export function computeLineupSynergy(
  rotation: RotationEntry[],
): SynergyBreakdown {
  const offensive = computeOffensiveSynergy(rotation, "balanced")
  const defensive = computeDefensiveSynergy(rotation, "drop_coverage")
  return combineSynergyBreakdowns(offensive, defensive)
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

export function mergeOffDefSynergyModifiers(
  offensive: SynergyBreakdown,
  defensive: SynergyBreakdown,
): SegmentModifiers {
  const offMods = synergyToModifiers(offensive)
  const defMods = synergyToModifiers(defensive)

  return {
    efficiencyShift: offMods.efficiencyShift + defMods.efficiencyShift,
    tpaRateShift: offMods.tpaRateShift + defMods.tpaRateShift,
    ftaRateShift: offMods.ftaRateShift + defMods.ftaRateShift,
    tovRateShift: offMods.tovRateShift + defMods.tovRateShift,
    homeCourtPoints: 0,
    fatiguePenalty: 0,
    benchDragMultiplier: 1,
  }
}
