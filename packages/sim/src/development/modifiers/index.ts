import type {
  Player,
  PlayerSeasonStats,
  SkillKey,
} from "@workspace/shared/types"

import type { DevelopmentContext, DevelopmentModifier, SkillDeltas } from "../types"

export function estimateExpectedProduction(player: Player): number {
  return player.ratings.overall * 0.28
}

export function computeProductionRatio(
  stats: PlayerSeasonStats | undefined,
  player: Player,
): number {
  if (!stats || stats.gp === 0) return 0.5

  const ppg = stats.pts / stats.gp
  const expected = estimateExpectedProduction(player)
  if (expected <= 0) return 0.5

  return Math.max(0.2, Math.min(1.8, ppg / expected))
}

export function computePerformanceModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const { player, seasonStats, seasonProfile } = context
  const ratio = computeProductionRatio(seasonStats, player)

  if (player.age <= 26 && ratio >= 1.15 && (seasonProfile?.mpg ?? 0) >= 18) {
    return {
      id: "performance:breakout_candidate",
      source: "performance",
      category: "performance",
      growthBonus: 0.12,
      potentialDriftBias: 0.06,
    }
  }

  if (ratio >= 1.05 && ratio < 1.15) {
    return {
      id: "performance:above_expectations",
      source: "performance",
      category: "performance",
      growthBonus: 0.06,
    }
  }

  if (ratio < 0.85 && player.age > player.peakAge) {
    return {
      id: "performance:below_expectations",
      source: "performance",
      category: "performance",
      regressionBonus: 0.08,
    }
  }

  if (ratio < 0.75 && player.age <= 26) {
    return {
      id: "performance:underdeveloped",
      source: "performance",
      category: "performance",
      growthBonus: -0.08,
      potentialDriftBias: -0.05,
    }
  }

  return null
}

export function computeMomentumFromStats(
  player: Player,
  stats: PlayerSeasonStats | undefined,
): number {
  if (!stats || stats.gp < 5) {
    return player.developmentMomentum ?? 0
  }

  const ratio = computeProductionRatio(stats, player)
  const delta = (ratio - 1) * 0.25
  const next = (player.developmentMomentum ?? 0) + delta * 0.35
  return Math.max(-1, Math.min(1, next))
}

export function computeInjuryModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const { player, seasonProfile } = context
  const history = player.injuryHistory

  if (!history) return null

  const missedRatio = seasonProfile
    ? seasonProfile.gamesMissed /
      Math.max(1, seasonProfile.gp + seasonProfile.gamesMissed)
    : 0

  if (history.lastMajorInjurySeason === context.season - 1 || missedRatio >= 0.35) {
    return {
      id: "injury:major_scar",
      source: "tag",
      category: "injury",
      growthBonus: -0.2,
      regressionBonus: 0.15,
      skillBonuses: { stamina: -0.5 },
      potentialDriftBias: -0.1,
    }
  }

  if (player.age <= 24 && seasonProfile && seasonProfile.gp < 15) {
    return {
      id: "injury:lost_development_year",
      source: "tag",
      category: "injury",
      growthBonus: -0.15,
      potentialDriftBias: -0.08,
    }
  }

  if (history.majorInjuryCount >= 2) {
    return {
      id: "injury:career_wear",
      source: "tag",
      category: "injury",
      regressionBonus: 0.1,
      skillBonuses: { stamina: -0.25, defense: -0.15 },
    }
  }

  return null
}

export function computeCoachingModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const coachingLevel = context.coachingLevel ?? 5
  const developmentLevel = context.developmentLevel ?? 5
  const normalized = (coachingLevel + developmentLevel) / 2
  const bonus = (normalized - 5) * 0.025

  if (Math.abs(bonus) < 0.005) return null

  return {
    id: "staff:coaching_development",
    source: "team",
    category: "staff",
    growthBonus: Math.max(0, bonus),
    regressionBonus: Math.max(0, -bonus * 0.6),
  }
}

export function computeCultureModifier(
  context: DevelopmentContext,
): DevelopmentModifier | null {
  const score = context.cultureScore
  if (score === undefined) return null

  const growthBonus = (score / 100) * 0.15
  const regressionBonus = (1 - score / 100) * 0.1

  return {
    id: "team:culture_environment",
    source: "team",
    category: "culture",
    growthBonus,
    regressionBonus,
  }
}

export type DevelopmentEventResult = {
  skillBonuses: Partial<Record<SkillKey, number>>
  events: string[]
  reinventionSeasons?: number
}

export function rollDevelopmentEvents(
  context: DevelopmentContext,
  _deltas: SkillDeltas,
): DevelopmentEventResult {
  const { player, rng, seasonProfile } = context
  const events: string[] = []
  const skillBonuses: Partial<Record<SkillKey, number>> = {}

  const momentum = player.developmentMomentum ?? 0
  const headroom = Math.max(0, player.ratings.potential - player.ratings.overall)

  if (
    player.age <= 26 &&
    headroom >= 5 &&
    momentum > 0.3 &&
    (seasonProfile?.mpg ?? 0) >= 20 &&
    rng.next() < 0.04
  ) {
    const skill =
      player.archetype === "scoring_guard" || player.archetype === "three_and_d_wing"
        ? "threePoint"
        : player.archetype === "rim_protector"
          ? "defense"
          : "inside"
    skillBonuses[skill] = rng.normal(2.5, 0.5)
    events.push(`event:breakout:${skill}`)
  }

  if (
    player.age > player.peakAge &&
    momentum < -0.25 &&
    rng.next() < 0.035
  ) {
    skillBonuses.stamina = (skillBonuses.stamina ?? 0) - rng.normal(1.2, 0.3)
    events.push("event:regression:stamina")
  }

  if (
    player.age >= 30 &&
    player.age <= 35 &&
    player.reinventionSeasonsRemaining <= 0 &&
    (seasonProfile?.primaryRole === "starter" ||
      seasonProfile?.primaryRole === "star") &&
    (seasonProfile?.mpg ?? 0) >= 24 &&
    player.ratings.overall < (player.careerPeakOverall ?? player.ratings.overall) - 3 &&
    rng.next() < 0.06
  ) {
    const targetSkill: SkillKey =
      player.archetype === "slasher" ? "threePoint" : "offensiveIQ"
    skillBonuses[targetSkill] = rng.normal(1.5, 0.4)
    events.push(`event:second_peak:${targetSkill}`)
    return { skillBonuses, events, reinventionSeasons: 3 }
  }

  return { skillBonuses, events }
}
