import type {
  GameSimSegmentMeta,
  QuarterScores,
  Rng,
  RotationEntry,
  TeamMatchupInput,
} from "@workspace/shared/types"
import { DEFAULT_HOME_COURT_ADVANTAGE } from "@workspace/shared/constants"

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
import { computeLineupSynergy } from "./synergy"
import { emptyComponents, mergeComponents } from "./mergeComponents"
import { estimatePossessions, rotationQuality } from "./ratingHelpers"
import { philosophyPaceModifier } from "./coachingPhilosophy"

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
  homeSynergy: ReturnType<typeof computeLineupSynergy>
  awaySynergy: ReturnType<typeof computeLineupSynergy>
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
  const homeSegRotation = applySegmentRotation(
    homeRotation,
    plan,
    runningMargin,
    input.homePhilosophy,
  )
  const awaySegRotation = applySegmentRotation(
    awayRotation,
    plan,
    -runningMargin,
    input.awayPhilosophy,
  )

  const homeSynergy = computeLineupSynergy(homeSegRotation)
  const awaySynergy = computeLineupSynergy(awaySegRotation)

  const homeMods = buildSegmentModifiers({
    philosophy: input.homePhilosophy,
    synergy: homeSynergy,
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
    philosophy: input.awayPhilosophy,
    synergy: awaySynergy,
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

  const paceModifier =
    (philosophyPaceModifier(
      input.homePhilosophy ?? {
        pace: "balanced",
        offense: "balanced",
        rotation: "standard",
      },
    ) +
      philosophyPaceModifier(
        input.awayPhilosophy ?? {
          pace: "balanced",
          offense: "balanced",
          rotation: "standard",
        },
      )) /
    2

  const totalPossessions = estimatePossessions(
    input.home.pace,
    input.away.pace,
    paceModifier,
    rng,
  )

  const plans = buildRegulationSegmentPlans()
  const homeQuarterScores: QuarterScores = [0, 0, 0, 0]
  const awayQuarterScores: QuarterScores = [0, 0, 0, 0]
  const homeStats = emptyComponents()
  const awayStats = emptyComponents()
  const segmentMeta: GameSimSegmentMeta[] = []
  const homeMinutes = new Map<string, number>()
  const awayMinutes = new Map<string, number>()

  let runningMargin = 0
  let lastHomeSynergy = computeLineupSynergy(homeRotation)
  let lastAwaySynergy = computeLineupSynergy(awayRotation)

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
    totalPossessions,
  }
}

export { rotationQuality }
