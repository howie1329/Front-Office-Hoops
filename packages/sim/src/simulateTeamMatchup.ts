import type {
  Rng,
  RotationEntry,
  TeamGameStats,
  TeamMatchupInput,
  TeamMatchupResult,
} from "@workspace/shared/types"

import {
  allocatePlayerStats,
  type TeamStatComponents,
} from "./allocatePlayerStats"
import { simulateOvertime } from "./gameSim/overtime"
import { rotationQuality, simulateRegulation } from "./gameSim/simulateRegulation"
import { mergeRotationsWithSegmentMinutes } from "./gameSim/segmentRotation"
import { mergeComponents } from "./gameSim/mergeComponents"
import { momentumEfficiencyModifier } from "./gameSim/momentum"
import { selectRotation } from "./selectRotation"

function toTeamGameStats(
  stats: TeamStatComponents,
  possessions: number,
): TeamGameStats {
  return {
    possessions,
    fgm: stats.fgm,
    fga: stats.fga,
    tpm: stats.tpm,
    tpa: stats.tpa,
    ftm: stats.ftm,
    fta: stats.fta,
    orb: stats.orb,
    drb: stats.drb,
    ast: stats.ast,
    stl: stats.stl,
    blk: stats.blk,
    tov: stats.tov,
  }
}

function applyMinuteReduction(
  rotation: RotationEntry[],
  reduction: number,
): RotationEntry[] {
  if (reduction <= 0) {
    return rotation
  }

  return rotation.map((entry, index) => {
    const isStarter = index < 5
    const minuteCut = isStarter ? reduction : Math.round(reduction * 0.35)
    return {
      ...entry,
      minutes: Math.max(0, entry.minutes - minuteCut),
    }
  })
}

export function simulateTeamMatchup(
  input: TeamMatchupInput,
  rng: Rng,
): TeamMatchupResult {
  const { home, away } = input

  const homeRotation = applyMinuteReduction(
    selectRotation(home.players),
    input.homeMinuteReduction ?? 0,
  )
  const awayRotation = applyMinuteReduction(
    selectRotation(away.players),
    input.awayMinuteReduction ?? 0,
  )

  const regulation = simulateRegulation(input, homeRotation, awayRotation, rng)

  let homeScore = regulation.homeScore
  let awayScore = regulation.awayScore
  let homeStats = { ...regulation.homeStats }
  let awayStats = { ...regulation.awayStats }
  let segmentMeta = regulation.segmentMeta
  let homeMinutes = regulation.playerMinutes.home
  let awayMinutes = regulation.playerMinutes.away
  let overtimes = 0

  if (homeScore === awayScore) {
    const ot = simulateOvertime(
      input,
      homeRotation,
      awayRotation,
      homeScore,
      awayScore,
      rng,
      segmentMeta,
      homeMinutes,
      awayMinutes,
    )

    homeScore = ot.homeScore
    awayScore = ot.awayScore
    overtimes = ot.overtimes
    segmentMeta = ot.segmentMeta
    homeMinutes = ot.playerMinutes.home
    awayMinutes = ot.playerMinutes.away
    mergeComponents(homeStats, ot.homeOtStats)
    mergeComponents(awayStats, ot.awayOtStats)
  }

  const totalPossessions = regulation.totalPossessions + overtimes * 20

  const finalHomeRotation = mergeRotationsWithSegmentMinutes(
    homeRotation,
    homeMinutes,
  )
  const finalAwayRotation = mergeRotationsWithSegmentMinutes(
    awayRotation,
    awayMinutes,
  )

  const homePlayerStats = allocatePlayerStats(
    finalHomeRotation,
    homeStats,
    home.id,
    rng,
  )
  const awayPlayerStats = allocatePlayerStats(
    finalAwayRotation,
    awayStats,
    away.id,
    rng,
  )

  const winnerId =
    homeScore > awayScore ? home.id : awayScore > homeScore ? away.id : home.id

  return {
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore,
    awayScore,
    winnerId,
    meta: {
      homePossessions: totalPossessions,
      awayPossessions: totalPossessions,
      homeOffRtg: totalPossessions > 0 ? (homeScore / totalPossessions) * 100 : 0,
      awayOffRtg: totalPossessions > 0 ? (awayScore / totalPossessions) * 100 : 0,
      homeRotationQuality: rotationQuality(finalHomeRotation),
      awayRotationQuality: rotationQuality(finalAwayRotation),
      homeTeamStats: toTeamGameStats(homeStats, totalPossessions),
      awayTeamStats: toTeamGameStats(awayStats, totalPossessions),
      overtimes,
      segments: segmentMeta,
      homeSynergy: regulation.homeSynergy,
      awaySynergy: regulation.awaySynergy,
      homeOffSynergy: regulation.homeOffSynergy,
      awayOffSynergy: regulation.awayOffSynergy,
      homeDefSynergy: regulation.homeDefSynergy,
      awayDefSynergy: regulation.awayDefSynergy,
      homeMomentumApplied: momentumEfficiencyModifier(
        input.homeMomentum,
        input.homeStreak ?? 0,
      ),
      awayMomentumApplied: momentumEfficiencyModifier(
        input.awayMomentum,
        input.awayStreak ?? 0,
      ),
    },
    homeQuarterScores: regulation.homeQuarterScores,
    awayQuarterScores: regulation.awayQuarterScores,
    homePlayerStats,
    awayPlayerStats,
  }
}
