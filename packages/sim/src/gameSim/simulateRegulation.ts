import type {
  GameSimSegmentMeta,
  QuarterScores,
  Rng,
  RotationEntry,
  SynergyBreakdown,
  TeamMatchupInput,
} from "@workspace/shared/types"
import {
  DEFAULT_HOME_COURT_ADVANTAGE,
  DEFAULT_PACE,
} from "@workspace/shared/constants"

import type { TeamStatComponents } from "../allocatePlayerStats"
import { addRebounds, buildScoringComponents } from "./buildScoringComponents"
import {
  accumulatePlayerMinutes,
  applySegmentRotation,
} from "./segmentRotation"
import {
  buildRegulationSegmentPlans,
  segmentPossessionCount,
  type SegmentPlan,
} from "./segments"
import { buildSegmentModifiers } from "./situationalModifiers"
import {
  combineSynergyBreakdowns,
  computeDefensiveSynergy,
  computeOffensiveSynergy,
} from "./synergy"
import { emptyComponents, mergeComponents } from "./mergeComponents"
import { estimatePossessions, rotationQuality } from "./ratingHelpers"
import { philosophyPaceModifier } from "./coachingPhilosophy"

const DEFAULT_PHILOSOPHY = {
  pace: "balanced" as const,
  offense: "balanced" as const,
  defense: "drop_coverage" as const,
  rotation: "standard" as const,
}

export type RegulationResult = {
  homeScore: number
  awayScore: number
  homeQuarterScores: QuarterScores
  awayQuarterScores: QuarterScores
  homeStats: TeamStatComponents
  awayStats: TeamStatComponents
  segmentMeta: GameSimSegmentMeta[]
  playerMinutes: {
    home: Map<string, number>
    away: Map<string, number>
  }
  homeSynergy: SynergyBreakdown
  awaySynergy: SynergyBreakdown
  homeOffSynergy: SynergyBreakdown
  awayOffSynergy: SynergyBreakdown
  homeDefSynergy: SynergyBreakdown
  awayDefSynergy: SynergyBreakdown
  totalPossessions: number
}

function simulateSegmentPair({
  plan,
  homeRotation,
  awayRotation,
  input,
  runningMargin,
  possessions,
  homeCourtPerSegment,
  rng,
}: {
  plan: SegmentPlan
  homeRotation: RotationEntry[]
  awayRotation: RotationEntry[]
  input: TeamMatchupInput
  runningMargin: number
  possessions: number
  homeCourtPerSegment: number
  rng: Rng
}) {
  const homePhilosophy = input.homePhilosophy ?? DEFAULT_PHILOSOPHY
  const awayPhilosophy = input.awayPhilosophy ?? DEFAULT_PHILOSOPHY

  const homeSegRotation = applySegmentRotation(
    homeRotation,
    plan,
    runningMargin,
    homePhilosophy,
  )
  const awaySegRotation = applySegmentRotation(
    awayRotation,
    plan,
    -runningMargin,
    awayPhilosophy,
  )

  const homeOffSynergy = computeOffensiveSynergy(
    homeSegRotation,
    homePhilosophy.offense,
  )
  const homeDefSynergy = computeDefensiveSynergy(
    homeSegRotation,
    homePhilosophy.defense,
  )
  const awayOffSynergy = computeOffensiveSynergy(
    awaySegRotation,
    awayPhilosophy.offense,
  )
  const awayDefSynergy = computeDefensiveSynergy(
    awaySegRotation,
    awayPhilosophy.defense,
  )

  const homeSynergy = combineSynergyBreakdowns(homeOffSynergy, homeDefSynergy)
  const awaySynergy = combineSynergyBreakdowns(awayOffSynergy, awayDefSynergy)

  const homeMods = buildSegmentModifiers({
    philosophy: homePhilosophy,
    offSynergy: homeOffSynergy,
    defSynergy: homeDefSynergy,
    staffAlignmentShift: input.homeStaffAlignmentShift ?? 0,
    coachingQualityShift: input.homeCoachingQualityShift ?? 0,
    momentum: input.homeMomentum,
    streak: input.homeStreak ?? 0,
    fatiguePenalty: input.homeFatiguePenalty ?? 0,
    homeCourtPoints: homeCourtPerSegment,
    segment: plan.kind,
    margin: runningMargin,
    teamMargin: runningMargin,
    gameType: input.gameType,
  })

  const awayMods = buildSegmentModifiers({
    philosophy: awayPhilosophy,
    offSynergy: awayOffSynergy,
    defSynergy: awayDefSynergy,
    staffAlignmentShift: input.awayStaffAlignmentShift ?? 0,
    coachingQualityShift: input.awayCoachingQualityShift ?? 0,
    momentum: input.awayMomentum,
    streak: input.awayStreak ?? 0,
    fatiguePenalty: input.awayFatiguePenalty ?? 0,
    homeCourtPoints: 0,
    segment: plan.kind,
    margin: runningMargin,
    teamMargin: -runningMargin,
    gameType: input.gameType,
  })

  const homeStats = buildScoringComponents({
    possessions,
    offense: homeSegRotation,
    defense: awaySegRotation,
    modifiers: homeMods,
    rng,
  })
  const awayStats = buildScoringComponents({
    possessions,
    offense: awaySegRotation,
    defense: homeSegRotation,
    modifiers: awayMods,
    rng,
  })

  addRebounds(homeStats, awayStats, homeSegRotation, awaySegRotation, rng)

  return {
    homeStats,
    awayStats,
    homeSegRotation,
    awaySegRotation,
    homeSynergy,
    awaySynergy,
    homeOffSynergy,
    awayOffSynergy,
    homeDefSynergy,
    awayDefSynergy,
  }
}

export function simulateRegulation(
  input: TeamMatchupInput,
  homeRotation: RotationEntry[],
  awayRotation: RotationEntry[],
  rng: Rng,
): RegulationResult {
  const homeCourtAdvantage =
    input.homeCourtAdvantage ?? DEFAULT_HOME_COURT_ADVANTAGE
  const homeCourtPerSegment = homeCourtAdvantage / 4

  const homePhilosophy = input.homePhilosophy ?? DEFAULT_PHILOSOPHY
  const awayPhilosophy = input.awayPhilosophy ?? DEFAULT_PHILOSOPHY

  const paceModifier =
    (philosophyPaceModifier(homePhilosophy.pace) +
      philosophyPaceModifier(awayPhilosophy.pace)) /
    2

  const totalPossessions = estimatePossessions(DEFAULT_PACE, paceModifier, rng)

  const plans = buildRegulationSegmentPlans()
  const homeQuarterScores: QuarterScores = [0, 0, 0, 0]
  const awayQuarterScores: QuarterScores = [0, 0, 0, 0]
  const homeStats = emptyComponents()
  const awayStats = emptyComponents()
  const segmentMeta: GameSimSegmentMeta[] = []
  const homeMinutes = new Map<string, number>()
  const awayMinutes = new Map<string, number>()

  let runningMargin = 0
  const initialHomePhilosophy = input.homePhilosophy ?? DEFAULT_PHILOSOPHY
  const initialAwayPhilosophy = input.awayPhilosophy ?? DEFAULT_PHILOSOPHY
  let lastHomeSynergy = combineSynergyBreakdowns(
    computeOffensiveSynergy(homeRotation, initialHomePhilosophy.offense),
    computeDefensiveSynergy(homeRotation, initialHomePhilosophy.defense),
  )
  let lastAwaySynergy = combineSynergyBreakdowns(
    computeOffensiveSynergy(awayRotation, initialAwayPhilosophy.offense),
    computeDefensiveSynergy(awayRotation, initialAwayPhilosophy.defense),
  )
  let lastHomeOffSynergy = computeOffensiveSynergy(
    homeRotation,
    initialHomePhilosophy.offense,
  )
  let lastAwayOffSynergy = computeOffensiveSynergy(
    awayRotation,
    initialAwayPhilosophy.offense,
  )
  let lastHomeDefSynergy = computeDefensiveSynergy(
    homeRotation,
    initialHomePhilosophy.defense,
  )
  let lastAwayDefSynergy = computeDefensiveSynergy(
    awayRotation,
    initialAwayPhilosophy.defense,
  )

  for (const plan of plans) {
    const segPoss = segmentPossessionCount(totalPossessions, plan)
    const segment = simulateSegmentPair({
      plan,
      homeRotation,
      awayRotation,
      input,
      runningMargin,
      possessions: segPoss,
      homeCourtPerSegment,
      rng,
    })

    mergeComponents(homeStats, segment.homeStats)
    mergeComponents(awayStats, segment.awayStats)
    accumulatePlayerMinutes(homeMinutes, segment.homeSegRotation)
    accumulatePlayerMinutes(awayMinutes, segment.awaySegRotation)

    if (plan.quarterIndex >= 0) {
      homeQuarterScores[plan.quarterIndex] =
        (homeQuarterScores[plan.quarterIndex] ?? 0) + segment.homeStats.points
      awayQuarterScores[plan.quarterIndex] =
        (awayQuarterScores[plan.quarterIndex] ?? 0) + segment.awayStats.points
    }

    runningMargin += segment.homeStats.points - segment.awayStats.points
    lastHomeSynergy = segment.homeSynergy
    lastAwaySynergy = segment.awaySynergy
    lastHomeOffSynergy = segment.homeOffSynergy
    lastAwayOffSynergy = segment.awayOffSynergy
    lastHomeDefSynergy = segment.homeDefSynergy
    lastAwayDefSynergy = segment.awayDefSynergy

    segmentMeta.push({
      kind: plan.kind,
      index: plan.index,
      homePoints: segment.homeStats.points,
      awayPoints: segment.awayStats.points,
      homePossessions: segPoss,
      awayPossessions: segPoss,
    })
  }

  return {
    homeScore: homeStats.points,
    awayScore: awayStats.points,
    homeQuarterScores,
    awayQuarterScores,
    homeStats,
    awayStats,
    segmentMeta,
    playerMinutes: { home: homeMinutes, away: awayMinutes },
    homeSynergy: lastHomeSynergy,
    awaySynergy: lastAwaySynergy,
    homeOffSynergy: lastHomeOffSynergy,
    awayOffSynergy: lastAwayOffSynergy,
    homeDefSynergy: lastHomeDefSynergy,
    awayDefSynergy: lastAwayDefSynergy,
    totalPossessions,
  }
}

export { rotationQuality }
