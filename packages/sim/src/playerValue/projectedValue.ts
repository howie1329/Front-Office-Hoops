import { RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import type { LeagueRecord, Player } from "@workspace/shared/types"

import { getArchetypeMarketPremium } from "./archetypeMarket"
import { applyPerformanceDriftToTalent } from "./performanceDrift"

/**
 * Trade values use the same roughly 40–100 scale as player ratings and pick
 * values. One point represents meaningful rotation value; salary effects are
 * intentionally smaller so a few million dollars cannot buy a major downgrade.
 */
const SEASON_WEIGHTS = [0.55, 0.3, 0.15] as const
const MAX_PERFORMANCE_DRIFT = 3
const MAX_MARKET_PREMIUM = 2
const MAX_DURABILITY_PENALTY = 5
const MAX_AGE_RUNWAY_PENALTY = 10

export type ProjectedPlayerSeason = {
  seasonOffset: number
  projectedOverall: number
  value: number
}

export type ProjectedPlayerValueBreakdown = {
  talent: number
  ageCurve: number
  production: number
  currentContribution: number
  futureContribution: number
  developmentOrDecline: number
  durabilityRisk: number
  archetypeMarket: number
  projectedSeasons: ProjectedPlayerSeason[]
  total: number
}

export type ProjectedPlayerValueContext = {
  league?: LeagueRecord
}

function clampRating(value: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, value))
}

function durabilityRisk(player: Player): number {
  const history = player.injuryHistory
  const missedGames = Math.min(2, (history?.totalGamesMissed ?? 0) / 100)
  const majorInjuries = Math.min(2.5, (history?.majorInjuryCount ?? 0) * 0.9)
  const currentInjury = player.status === "injured" || player.injury ? 1.5 : 0
  return Math.min(MAX_DURABILITY_PENALTY, missedGames + majorInjuries + currentInjury)
}

function archetypeSignal(player: Player): number {
  const { threePoint, defense, passing, rebounding } = player.ratings
  if (player.archetype === "three_and_d_wing") return threePoint >= 64 && defense >= 64 ? 1.5 : -0.5
  if (player.archetype === "stretch_big") return threePoint >= 62 && rebounding >= 58 ? 1.25 : 0
  if (player.archetype === "lead_guard") return passing >= 64 ? 1 : 0
  if (player.archetype === "rim_protector") return defense >= 66 && rebounding >= 64 ? 1.25 : 0
  return 0
}

function ageRunwayPenalty(player: Player): number {
  const yearsPastPeak = Math.max(0, player.age - player.peakAge)
  const starProtection = player.ratings.overall >= 78 ? 0.72 : 1
  return Math.min(MAX_AGE_RUNWAY_PENALTY, yearsPastPeak * 1.3 * starProtection)
}

function nextSeasonOverall(player: Player, overall: number, seasonOffset: number): number {
  const age = player.age + seasonOffset
  const momentum = Math.max(-2, Math.min(2, player.developmentMomentum ?? 0))

  if (age < player.peakAge) {
    const yearsToPeak = player.peakAge - age
    const headroom = Math.max(0, player.ratings.potential - overall)
    const approach = Math.min(1, yearsToPeak / Math.max(1, player.peakAge - 19))
    return clampRating(overall + Math.min(3.5, headroom * 0.12 * approach + momentum * 0.3))
  }

  if (age === player.peakAge) {
    return clampRating(overall + momentum * 0.1)
  }

  const yearsPastPeak = age - player.peakAge
  // Stars decline more gradually, but never receive a flat age curve after peak.
  const starProtection = player.ratings.overall >= 78 ? 0.72 : 1
  const injuryAcceleration = Math.min(0.45, (player.injuryHistory?.majorInjuryCount ?? 0) * 0.15)
  const decline = (0.65 + yearsPastPeak * 0.3 + injuryAcceleration) * starProtection
  return clampRating(overall - decline + Math.min(0, momentum) * 0.15)
}

function projectSeasons(player: Player, performanceDrift: number): number[] {
  const seasonZero = clampRating(
    applyPerformanceDriftToTalent(player.ratings.overall, performanceDrift),
  )
  const seasonOne = nextSeasonOverall(player, seasonZero, 1)
  const seasonTwo = nextSeasonOverall(player, seasonOne, 2)
  return [seasonZero, seasonOne, seasonTwo]
}

function weightedContribution(projected: number[]): number {
  return projected.reduce(
    (total, overall, offset) => total + overall * SEASON_WEIGHTS[offset]!,
    0,
  )
}

export function getProjectedPlayerValueBreakdown(
  player: Player,
  context: ProjectedPlayerValueContext = {},
): ProjectedPlayerValueBreakdown {
  const drift = Math.max(
    -MAX_PERFORMANCE_DRIFT,
    Math.min(MAX_PERFORMANCE_DRIFT, player.performanceDrift ?? 0),
  )
  const projected = projectSeasons(player, drift)
  const baselineProjected = projectSeasons(player, 0)
  const projectedSeasons = projected.map((projectedOverall, seasonOffset) => ({
    seasonOffset,
    projectedOverall,
    value: projectedOverall * SEASON_WEIGHTS[seasonOffset]!,
  }))
  const currentContribution = projectedSeasons[0]!.value
  const futureContribution = projectedSeasons.slice(1).reduce((total, season) => total + season.value, 0)
  const developmentOrDecline =
    (projected[1]! - projected[0]!) * 0.35 +
    (projected[2]! - projected[1]!) * 0.15
  const marketPremium = context.league ? (getArchetypeMarketPremium(player, context.league) - 1) * 2 : 0
  const archetypeMarket = Math.max(-MAX_MARKET_PREMIUM, Math.min(MAX_MARKET_PREMIUM, archetypeSignal(player) + marketPremium))
  const risk = durabilityRisk(player)
  const talent = player.ratings.overall
  const production = weightedContribution(projected) - weightedContribution(baselineProjected)
  const ageCurve = weightedContribution(baselineProjected) - talent - ageRunwayPenalty(player)
  const total = talent + production + ageCurve + archetypeMarket - risk

  return {
    talent,
    ageCurve,
    production,
    currentContribution,
    futureContribution,
    developmentOrDecline,
    durabilityRisk: risk,
    archetypeMarket,
    projectedSeasons,
    total,
  }
}

export function getProjectedPlayerValue(
  player: Player,
  context: ProjectedPlayerValueContext = {},
): number {
  return getProjectedPlayerValueBreakdown(player, context).total
}
