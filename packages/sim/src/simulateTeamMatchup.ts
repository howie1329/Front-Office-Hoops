import { DEFAULT_HOME_COURT_ADVANTAGE } from "@workspace/shared/constants"
import type {
  Rng,
  RotationEntry,
  RotationQuality,
  TeamGameStats,
  TeamMatchupInput,
  TeamMatchupResult,
} from "@workspace/shared/types"

import {
  allocatePlayerStats,
  type TeamStatComponents,
} from "./allocatePlayerStats"
import { distributeQuarterScores } from "./distributeQuarterScores"
import { selectRotation } from "./selectRotation"

const POSSESSION_NOISE_STDDEV = 3
const RATING_CENTER = 60

function estimatePossessions(
  homePace: number,
  awayPace: number,
  rng: Rng
): number {
  const pace = (homePace + awayPace) / 2
  return Math.max(80, Math.round(pace + rng.normal(0, POSSESSION_NOISE_STDDEV)))
}

function weightedAverage(
  rotation: RotationEntry[],
  getValue: (entry: RotationEntry) => number
): number {
  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0)

  if (totalMinutes === 0) {
    return RATING_CENTER
  }

  return (
    rotation.reduce((sum, entry) => sum + getValue(entry) * entry.minutes, 0) /
    totalMinutes
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function ratingFactor(value: number): number {
  return (value - RATING_CENTER) / 20
}

function round(value: number): number {
  return Math.max(0, Math.round(value))
}

function rotationQuality(rotation: RotationEntry[]): RotationQuality {
  const byMinutes = [...rotation].sort((a, b) => b.minutes - a.minutes)
  const average = (entries: RotationEntry[]) =>
    entries.length === 0
      ? 0
      : entries.reduce((sum, entry) => sum + entry.player.ratings.overall, 0) /
        entries.length

  return {
    top2: average(byMinutes.slice(0, 2)),
    starters: average(byMinutes.slice(0, 5)),
    bench: average(byMinutes.slice(5)),
    fullRotation: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.overall
    ),
  }
}

function averageRatings(rotation: RotationEntry[]) {
  return {
    threePoint: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.threePoint,
    ),
    midRange: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.midRange,
    ),
    freeThrow: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.freeThrow,
    ),
    inside: weightedAverage(rotation, (entry) => entry.player.ratings.inside),
    passing: weightedAverage(rotation, (entry) => entry.player.ratings.passing),
    ballHandling: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.ballHandling,
    ),
    offensiveIQ: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.offensiveIQ,
    ),
    defensiveIQ: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.defensiveIQ,
    ),
    rebounding: weightedAverage(
      rotation,
      (entry) => entry.player.ratings.rebounding,
    ),
    defense: weightedAverage(rotation, (entry) => entry.player.ratings.defense),
    stamina: weightedAverage(rotation, (entry) => entry.player.ratings.stamina),
    usage: weightedAverage(rotation, (entry) => entry.player.ratings.usage),
  }
}

function buildScoringComponents({
  possessions,
  offense,
  defense,
  homeCourtPoints,
  fatiguePenalty = 0,
  rng,
}: {
  possessions: number
  offense: RotationEntry[]
  defense: RotationEntry[]
  homeCourtPoints: number
  fatiguePenalty?: number
  rng: Rng
}): TeamStatComponents {
  const off = averageRatings(offense)
  const def = averageRatings(defense)
  const quality = rotationQuality(offense)
  const benchDrag = clamp((quality.bench - quality.starters) / 80, -0.14, 0.04)
  const staminaFactor = ratingFactor(off.stamina)
  const defenseFactor = ratingFactor(def.defense)

  const tovRate = clamp(
    0.13 -
      ratingFactor(off.passing + off.ballHandling * 0.4 + off.offensiveIQ * 0.2) *
        0.018 +
      defenseFactor * 0.015 +
      rng.normal(0, 0.008),
    0.09,
    0.18
  )
  const perimeterSkill = off.threePoint + (off.threePoint - off.inside) * 0.35
  const tpaRate = clamp(
    0.38 + ratingFactor(perimeterSkill) * 0.055 + rng.normal(0, 0.025),
    0.27,
    0.52
  )
  const ftaRate = clamp(
    0.22 +
      ratingFactor(off.inside) * 0.03 -
      defenseFactor * 0.012 +
      rng.normal(0, 0.015),
    0.14,
    0.34
  )

  const tov = round(possessions * tovRate)
  const fta = round(possessions * ftaRate)
  const fga = Math.max(70, round(possessions - tov - fta * 0.32 + 10))
  const tpa = clamp(round(fga * tpaRate), 18, fga - 20)
  const twoPa = fga - tpa

  const twoPct = clamp(
    0.535 +
      ratingFactor(off.inside) * 0.035 +
      ratingFactor(off.passing) * 0.012 -
      defenseFactor * 0.035 +
      staminaFactor * 0.008 +
      benchDrag -
      fatiguePenalty +
      rng.normal(0, 0.018),
    0.44,
    0.62
  )
  const threePct = clamp(
    0.355 +
      ratingFactor(off.threePoint) * 0.035 +
      ratingFactor(off.offensiveIQ) * 0.012 -
      defenseFactor * 0.018 +
      staminaFactor * 0.006 +
      benchDrag * 0.55 -
      fatiguePenalty * 0.8 +
      rng.normal(0, 0.022),
    0.28,
    0.45
  )
  const ftPct = clamp(
    0.76 + ratingFactor(off.freeThrow) * 0.025,
    0.68,
    0.86,
  )

  const twoPm = clamp(round(twoPa * twoPct), 0, twoPa)
  const tpm = clamp(round(tpa * threePct), 0, tpa)
  const ftm = clamp(round(fta * ftPct), 0, fta)
  const fgm = twoPm + tpm
  const points = twoPm * 2 + tpm * 3 + ftm + homeCourtPoints

  const ast = clamp(
    round(
      fgm *
        (0.58 +
          ratingFactor(off.passing + off.ballHandling * 0.35) * 0.06 +
          rng.normal(0, 0.025)),
    ),
    0,
    fgm,
  )
  const stl = round(
    possessions * clamp(0.073 + defenseFactor * 0.01, 0.05, 0.1)
  )
  const blk = round(twoPa * clamp(0.07 + defenseFactor * 0.012, 0.035, 0.1))

  return {
    points,
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
    orb: 0,
    drb: 0,
    ast,
    stl,
    blk,
    tov,
  }
}

function addRebounds(
  team: TeamStatComponents,
  opponent: TeamStatComponents,
  teamRotation: RotationEntry[],
  opponentRotation: RotationEntry[],
  rng: Rng
) {
  const teamReb = averageRatings(teamRotation).rebounding
  const oppReb = averageRatings(opponentRotation).rebounding
  const teamMisses = team.fga - team.fgm
  const oppMisses = opponent.fga - opponent.fgm
  const orbRate = clamp(
    0.25 +
      ratingFactor(teamReb) * 0.025 -
      ratingFactor(oppReb) * 0.02 +
      rng.normal(0, 0.012),
    0.18,
    0.34
  )
  const oppOrbRate = clamp(
    0.25 +
      ratingFactor(oppReb) * 0.025 -
      ratingFactor(teamReb) * 0.02 +
      rng.normal(0, 0.012),
    0.18,
    0.34
  )

  team.orb = round(teamMisses * orbRate)
  opponent.orb = round(oppMisses * oppOrbRate)
  team.drb = Math.max(0, oppMisses - opponent.orb)
  opponent.drb = Math.max(0, teamMisses - team.orb)
}

function resolveTie(
  homeScore: number,
  awayScore: number,
  homeTeamId: string,
  awayTeamId: string,
  rng: Rng
): { homeScore: number; awayScore: number; winnerId: string } {
  if (homeScore === awayScore) {
    const homeWinsTiebreak = rng.next() >= 0.5
    const bonus = rng.int(1, 4)

    if (homeWinsTiebreak) {
      return { homeScore: homeScore + bonus, awayScore, winnerId: homeTeamId }
    }

    return { homeScore, awayScore: awayScore + bonus, winnerId: awayTeamId }
  }

  return {
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? homeTeamId : awayTeamId,
  }
}

function toTeamGameStats(
  stats: TeamStatComponents,
  possessions: number
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
  rng: Rng
): TeamMatchupResult {
  const { home, away } = input
  const homeCourtAdvantage =
    input.homeCourtAdvantage ?? DEFAULT_HOME_COURT_ADVANTAGE

  const homeRotation = applyMinuteReduction(
    selectRotation(home.players),
    input.homeMinuteReduction ?? 0,
  )
  const awayRotation = applyMinuteReduction(
    selectRotation(away.players),
    input.awayMinuteReduction ?? 0,
  )
  const possessions = estimatePossessions(home.pace, away.pace, rng)

  const homeStats = buildScoringComponents({
    possessions,
    offense: homeRotation,
    defense: awayRotation,
    homeCourtPoints: homeCourtAdvantage,
    fatiguePenalty: input.homeFatiguePenalty ?? 0,
    rng,
  })
  const awayStats = buildScoringComponents({
    possessions,
    offense: awayRotation,
    defense: homeRotation,
    homeCourtPoints: 0,
    fatiguePenalty: input.awayFatiguePenalty ?? 0,
    rng,
  })

  addRebounds(homeStats, awayStats, homeRotation, awayRotation, rng)

  let homeScore = homeStats.points
  let awayScore = awayStats.points
  const resolved = resolveTie(homeScore, awayScore, home.id, away.id, rng)
  homeScore = resolved.homeScore
  awayScore = resolved.awayScore

  if (homeScore !== homeStats.points) {
    homeStats.ftm += homeScore - homeStats.points
    homeStats.fta = Math.max(homeStats.fta, homeStats.ftm)
    homeStats.points = homeScore
  }

  if (awayScore !== awayStats.points) {
    awayStats.ftm += awayScore - awayStats.points
    awayStats.fta = Math.max(awayStats.fta, awayStats.ftm)
    awayStats.points = awayScore
  }

  const homeQuarterScores = distributeQuarterScores(homeScore, rng)
  const awayQuarterScores = distributeQuarterScores(awayScore, rng)
  const homePlayerStats = allocatePlayerStats(
    homeRotation,
    homeStats,
    home.id,
    rng
  )
  const awayPlayerStats = allocatePlayerStats(
    awayRotation,
    awayStats,
    away.id,
    rng
  )

  return {
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore,
    awayScore,
    winnerId: resolved.winnerId,
    meta: {
      homePossessions: possessions,
      awayPossessions: possessions,
      homeOffRtg: (homeScore / possessions) * 100,
      awayOffRtg: (awayScore / possessions) * 100,
      homeRotationQuality: rotationQuality(homeRotation),
      awayRotationQuality: rotationQuality(awayRotation),
      homeTeamStats: toTeamGameStats(homeStats, possessions),
      awayTeamStats: toTeamGameStats(awayStats, possessions),
    },
    homeQuarterScores,
    awayQuarterScores,
    homePlayerStats,
    awayPlayerStats,
  }
}
