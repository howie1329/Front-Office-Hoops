import type {
  CoachingPhilosophy,
  GameType,
  SegmentKind,
  SynergyBreakdown,
  TeamMomentumState,
} from "@workspace/shared/types"

import { momentumEfficiencyModifier } from "./momentum"
import { blowoutEfficiencyPenalty } from "./blowout"
import { mergeOffDefSynergyModifiers, synergyToModifiers } from "./synergy"
import type { SegmentModifiers } from "./types"
import { EMPTY_SEGMENT_MODIFIERS } from "./types"

export function philosophyModifiers(
  philosophy: CoachingPhilosophy | undefined,
): SegmentModifiers {
  if (!philosophy) {
    return { ...EMPTY_SEGMENT_MODIFIERS }
  }

  const mods: SegmentModifiers = { ...EMPTY_SEGMENT_MODIFIERS }

  if (philosophy.offense === "attack_rim" || philosophy.offense === "pace_space") {
    mods.ftaRateShift += 0.03
    mods.tpaRateShift -= 0.02
  } else if (
    philosophy.offense === "perimeter" ||
    philosophy.offense === "post_hub"
  ) {
    mods.tpaRateShift += philosophy.offense === "perimeter" ? 0.05 : 0.02
    mods.ftaRateShift -= 0.02
  }

  if (philosophy.rotation === "tight") {
    mods.benchDragMultiplier = 1.1
  } else if (philosophy.rotation === "deep") {
    mods.benchDragMultiplier = 0.8
  }

  return mods
}

export function crunchTimeModifiers(
  segment: SegmentKind,
  margin: number,
  teamMargin: number,
): SegmentModifiers {
  if (segment !== "q4") {
    return { ...EMPTY_SEGMENT_MODIFIERS }
  }

  const mods: SegmentModifiers = { ...EMPTY_SEGMENT_MODIFIERS }

  if (teamMargin <= -6) {
    mods.tpaRateShift += 0.04
  } else if (teamMargin <= -3) {
    mods.tpaRateShift += 0.06
  } else if (teamMargin >= 6) {
    mods.tpaRateShift -= 0.03
    mods.efficiencyShift -= 0.01
  }

  if (Math.abs(margin) <= 8 && teamMargin <= -3) {
    mods.tpaRateShift += 0.02
  }

  return mods
}

export function buildSegmentModifiers({
  philosophy,
  synergy,
  offSynergy,
  defSynergy,
  staffAlignmentShift = 0,
  coachingQualityShift = 0,
  momentum,
  streak,
  fatiguePenalty,
  homeCourtPoints,
  segment,
  margin,
  teamMargin,
  gameType,
  otIndex,
}: {
  philosophy?: CoachingPhilosophy
  synergy?: SynergyBreakdown
  offSynergy?: SynergyBreakdown
  defSynergy?: SynergyBreakdown
  staffAlignmentShift?: number
  coachingQualityShift?: number
  momentum?: TeamMomentumState
  streak: number
  fatiguePenalty: number
  homeCourtPoints: number
  segment: SegmentKind
  margin: number
  teamMargin: number
  gameType?: GameType
  otIndex?: number
}): SegmentModifiers {
  let mods = philosophyModifiers(philosophy)

  const synergyMods =
    offSynergy && defSynergy
      ? mergeOffDefSynergyModifiers(offSynergy, defSynergy)
      : synergy
        ? synergyToModifiers(synergy)
        : EMPTY_SEGMENT_MODIFIERS

  mods = {
    ...mods,
    ...synergyMods,
    efficiencyShift:
      mods.efficiencyShift +
      synergyMods.efficiencyShift +
      staffAlignmentShift +
      coachingQualityShift +
      momentumEfficiencyModifier(momentum, streak) +
      crunchTimeModifiers(segment, margin, teamMargin).efficiencyShift,
    tpaRateShift:
      mods.tpaRateShift +
      synergyMods.tpaRateShift +
      crunchTimeModifiers(segment, margin, teamMargin).tpaRateShift,
    ftaRateShift: mods.ftaRateShift + synergyMods.ftaRateShift,
    tovRateShift: mods.tovRateShift + synergyMods.tovRateShift,
    fatiguePenalty,
    homeCourtPoints,
  }

  if (teamMargin >= 15 && segment === "q4") {
    mods.efficiencyShift -= blowoutEfficiencyPenalty(teamMargin)
  }

  if (gameType === "playoff") {
    mods.efficiencyShift -= 0.003
  }

  if (segment === "ot" && otIndex && otIndex > 0) {
    mods.fatiguePenalty += 0.005 * otIndex
  }

  return mods
}

export function combineModifiers(
  ...modifierSets: SegmentModifiers[]
): SegmentModifiers {
  return modifierSets.reduce(
    (combined, next) => ({
      efficiencyShift: combined.efficiencyShift + next.efficiencyShift,
      tpaRateShift: combined.tpaRateShift + next.tpaRateShift,
      ftaRateShift: combined.ftaRateShift + next.ftaRateShift,
      tovRateShift: combined.tovRateShift + next.tovRateShift,
      homeCourtPoints: combined.homeCourtPoints + next.homeCourtPoints,
      fatiguePenalty: combined.fatiguePenalty + next.fatiguePenalty,
      benchDragMultiplier:
        combined.benchDragMultiplier * next.benchDragMultiplier,
    }),
    { ...EMPTY_SEGMENT_MODIFIERS },
  )
}
