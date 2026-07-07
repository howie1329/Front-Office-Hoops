import type {
  GameSimSegmentMeta,
  Rng,
  RotationEntry,
  TeamMatchupInput,
} from "@workspace/shared/types"

import type { TeamStatComponents } from "../allocatePlayerStats"
import { buildOvertimeSegmentPlan, segmentPossessionCount } from "./segments"
import { emptyComponents, mergeComponents } from "./mergeComponents"
import { applySegmentRotation, accumulatePlayerMinutes } from "./segmentRotation"
import { addRebounds, buildScoringComponents } from "./buildScoringComponents"
import { buildSegmentModifiers } from "./situationalModifiers"
import { computeLineupSynergy } from "./synergy"

const OT_POSSESSIONS_PER_TEAM = 10
const MAX_OVERTIMES = 4

export type OvertimeResult = {
  homeScore: number
  awayScore: number
  homeOtStats: TeamStatComponents
  awayOtStats: TeamStatComponents
  overtimes: number
  segmentMeta: GameSimSegmentMeta[]
  playerMinutes: {
    home: Map<string, number>
    away: Map<string, number>
  }
}

function simulateOtSegment({
  otIndex,
  homeRotation,
  awayRotation,
  input,
  rng,
}: {
  otIndex: number
  homeRotation: RotationEntry[]
  awayRotation: RotationEntry[]
  input: TeamMatchupInput
  rng: Rng
}) {
  const plan = buildOvertimeSegmentPlan(otIndex, OT_POSSESSIONS_PER_TEAM, OT_POSSESSIONS_PER_TEAM * 2)
  const segPoss = segmentPossessionCount(OT_POSSESSIONS_PER_TEAM * 2, plan)

  const homeSegRotation = applySegmentRotation(
    homeRotation,
    plan,
    0,
    input.homePhilosophy,
  )
  const awaySegRotation = applySegmentRotation(
    awayRotation,
    plan,
    0,
    input.awayPhilosophy,
  )

  const homeSynergy = computeLineupSynergy(homeSegRotation)
  const awaySynergy = computeLineupSynergy(awaySegRotation)

  const homeMods = buildSegmentModifiers({
    philosophy: input.homePhilosophy,
    synergy: homeSynergy,
    momentum: input.homeMomentum,
    streak: input.homeStreak ?? 0,
    fatiguePenalty: (input.homeFatiguePenalty ?? 0) + 0.005 * otIndex,
    homeCourtPoints: 0,
    segment: "ot",
    margin: 0,
    teamMargin: 0,
    gameType: input.gameType,
    otIndex,
  })

  const awayMods = buildSegmentModifiers({
    philosophy: input.awayPhilosophy,
    synergy: awaySynergy,
    momentum: input.awayMomentum,
    streak: input.awayStreak ?? 0,
    fatiguePenalty: (input.awayFatiguePenalty ?? 0) + 0.005 * otIndex,
    homeCourtPoints: 0,
    segment: "ot",
    margin: 0,
    teamMargin: 0,
    gameType: input.gameType,
    otIndex,
  })

  const homeStats = buildScoringComponents({
    possessions: segPoss,
    offense: homeSegRotation,
    defense: awaySegRotation,
    modifiers: homeMods,
    rng,
  })
  const awayStats = buildScoringComponents({
    possessions: segPoss,
    offense: awaySegRotation,
    defense: homeSegRotation,
    modifiers: awayMods,
    rng,
  })

  addRebounds(homeStats, awayStats, homeSegRotation, awaySegRotation, rng)

  return {
    plan,
    segPoss,
    homeStats,
    awayStats,
    homeSegRotation,
    awaySegRotation,
  }
}

export function simulateOvertime(
  input: TeamMatchupInput,
  homeRotation: RotationEntry[],
  awayRotation: RotationEntry[],
  regulationHomeScore: number,
  regulationAwayScore: number,
  rng: Rng,
  existingSegments: GameSimSegmentMeta[],
  existingHomeMinutes: Map<string, number>,
  existingAwayMinutes: Map<string, number>,
): OvertimeResult {
  let homeScore = regulationHomeScore
  let awayScore = regulationAwayScore
  const homeOtStats = emptyComponents()
  const awayOtStats = emptyComponents()
  const segmentMeta = [...existingSegments]
  const homeMinutes = new Map(existingHomeMinutes)
  const awayMinutes = new Map(existingAwayMinutes)
  let overtimes = 0

  while (homeScore === awayScore && overtimes < MAX_OVERTIMES) {
    const segment = simulateOtSegment({
      otIndex: overtimes,
      homeRotation,
      awayRotation,
      input,
      rng,
    })

    mergeComponents(homeOtStats, segment.homeStats)
    mergeComponents(awayOtStats, segment.awayStats)
    accumulatePlayerMinutes(homeMinutes, segment.homeSegRotation)
    accumulatePlayerMinutes(awayMinutes, segment.awaySegRotation)

    homeScore += segment.homeStats.points
    awayScore += segment.awayStats.points
    overtimes += 1

    segmentMeta.push({
      kind: "ot",
      index: segment.plan.index,
      homePoints: segment.homeStats.points,
      awayPoints: segment.awayStats.points,
      homePossessions: segment.segPoss,
      awayPossessions: segment.segPoss,
    })
  }

  if (homeScore === awayScore) {
    const suddenDeath = simulateOtSegment({
      otIndex: overtimes,
      homeRotation,
      awayRotation,
      input,
      rng,
    })

    mergeComponents(homeOtStats, suddenDeath.homeStats)
    mergeComponents(awayOtStats, suddenDeath.awayStats)
    accumulatePlayerMinutes(homeMinutes, suddenDeath.homeSegRotation)
    accumulatePlayerMinutes(awayMinutes, suddenDeath.awaySegRotation)

    homeScore += suddenDeath.homeStats.points
    awayScore += suddenDeath.awayStats.points
    overtimes += 1

    if (homeScore === awayScore) {
      if (rng.next() >= 0.5) {
        homeScore += 1
        homeOtStats.points += 1
        homeOtStats.ftm += 1
        homeOtStats.fta = Math.max(homeOtStats.fta, homeOtStats.ftm)
      } else {
        awayScore += 1
        awayOtStats.points += 1
        awayOtStats.ftm += 1
        awayOtStats.fta = Math.max(awayOtStats.fta, awayOtStats.ftm)
      }
    }

    segmentMeta.push({
      kind: "ot",
      index: suddenDeath.plan.index,
      homePoints: suddenDeath.homeStats.points,
      awayPoints: suddenDeath.awayStats.points,
      homePossessions: suddenDeath.segPoss,
      awayPossessions: suddenDeath.segPoss,
    })
  }

  return {
    homeScore,
    awayScore,
    homeOtStats,
    awayOtStats,
    overtimes,
    segmentMeta,
    playerMinutes: { home: homeMinutes, away: awayMinutes },
  }
}
