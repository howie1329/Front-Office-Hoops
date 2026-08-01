import type {
  PlayerEntity,
  PlayerSeasonProduction,
  SeasonFixture,
  SeasonPopulationKind,
  UniversalPlayerValue,
  UniversalPlayerValueConfig,
} from "@workspace/domain-v2"

import type { ProductionAggregation } from "./production"
import { getPlayerCurrentAbility } from "./playerGeneration"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function weighted(value: number, emphasis: number): number {
  return value * (0.5 + emphasis / 100)
}

function valueConfidence(
  production: PlayerSeasonProduction
): UniversalPlayerValue["confidence"] {
  switch (production.sampleState) {
    case "full":
      return "full"
    case "established":
      return "established"
    case "early":
      return "early"
    default:
      return "provisional"
  }
}

function productionSignal(production: PlayerSeasonProduction): number {
  if (production.gamesPlayed === 0) return 0
  const scoring = production.pointsPerGame * 6
  const efficiency = (production.trueShootingPercentage - 50) * 2.5
  const playmaking =
    production.assistsPerGame * 5 - production.turnoversPerGame * 4
  const rebounding = production.reboundsPerGame * 2.5
  const defense =
    ((production.steals + production.blocks) /
      Math.max(1, production.gamesPlayed)) *
    9
  const availability = (production.availabilityRate - 70) * 0.3
  return scoring + efficiency + playmaking + rebounding + defense + availability
}

function teamContextSignal(
  production: PlayerSeasonProduction,
  aggregation: ProductionAggregation,
  config: UniversalPlayerValueConfig
): number {
  if (!production.teamId) return 0
  const team = aggregation.teams[production.teamId]
  if (!team) return 0
  const teams = Object.values(aggregation.teams)
  const averageOffense = teams.length
    ? teams.reduce((sum, item) => sum + item.offensiveEfficiency, 0) /
      teams.length
    : team.offensiveEfficiency
  const averageDefense = teams.length
    ? teams.reduce((sum, item) => sum + item.defensiveEfficiency, 0) /
      teams.length
    : team.defensiveEfficiency
  const environmentAdjustment =
    (averageOffense - team.offensiveEfficiency) * 0.25 +
    (team.defensiveEfficiency - averageDefense) * 0.25
  return clamp(
    environmentAdjustment * (config.teamContextNormalization / 35),
    -12,
    12
  )
}

function roleSignal(production: PlayerSeasonProduction): number {
  if (production.gamesPlayed === 0) return 0
  const minutesPerGame = production.minutes / production.gamesPlayed
  const startRate =
    (production.starts / Math.max(1, production.gamesPlayed)) * 100
  const opportunitiesPerGame =
    production.opportunities / Math.max(1, production.gamesPlayed)
  return clamp(
    (minutesPerGame - 16) * 1.1 +
      (production.usageRate - 15) * 0.4 +
      (startRate - 50) * 0.1 +
      (opportunitiesPerGame - 8) * 0.5,
    -30,
    30
  )
}

function ageTrajectorySignal(player: PlayerEntity): number {
  return clamp((27 - player.age) * 2.5, -20, 20)
}

function upsideSignal(player: PlayerEntity): number {
  const headroom = player.profile.development.potential
  const ageFactor = player.age <= 24 ? 1.1 : player.age <= 28 ? 0.6 : 0.2
  return headroom * ageFactor
}

function durabilitySignal(
  player: PlayerEntity,
  production: PlayerSeasonProduction
): number {
  const availability =
    production.gamesScheduled > 0
      ? (production.availabilityRate - 75) * 0.35
      : 0
  const resistance = (player.profile.injuryResistance - 60) * 0.15
  return availability + resistance
}

function defensiveSignal(production: PlayerSeasonProduction): number {
  const eventRate =
    ((production.steals + production.blocks) /
      Math.max(1, production.gamesPlayed)) *
    8
  return eventRate
}

function buildValue(
  player: PlayerEntity,
  production: PlayerSeasonProduction,
  aggregation: ProductionAggregation,
  config: UniversalPlayerValueConfig,
  checkpointGamesPerTeam: number,
  evaluationPoint: UniversalPlayerValue["evaluationPoint"]
): UniversalPlayerValue {
  const ability = getPlayerCurrentAbility(player)
  const ageTrajectory = ageTrajectorySignal(player)
  const upside = upsideSignal(player)
  const durability = durabilitySignal(player, production)
  const roleContext = roleSignal(production)
  const opportunityImpact =
    production.gamesPlayed === 0
      ? 0
      : weighted(roleContext, config.productionEmphasis)
  const defensiveContribution = weighted(
    defensiveSignal(production),
    config.defenseEmphasis
  )
  const baseProjection =
    weighted(ability * 10, config.currentAbilityEmphasis) +
    weighted(ageTrajectory, config.trajectoryEmphasis) +
    weighted(upside, config.upsideEmphasis) +
    weighted(durability, config.durabilityImpact)
  const currentForm =
    production.gamesPlayed === 0
      ? 0
      : weighted(productionSignal(production), config.productionEmphasis) +
        defensiveContribution +
        teamContextSignal(production, aggregation, config)
  const sampleProgress = clamp(production.gamesPlayed / 25, 0, 1)
  const evidenceWeight = clamp(
    (config.currentFormResponsiveness / 100) *
      (0.25 + sampleProgress * (0.75 * (config.sampleConfidence / 100))),
    0,
    0.8
  )
  const projectionWeight = 1 - evidenceWeight
  const horizonMultiplier = config.horizonSeasons / 3
  const projectionSignal = baseProjection * horizonMultiplier
  const rawValue =
    projectionSignal * projectionWeight +
    currentForm * evidenceWeight +
    opportunityImpact
  const minutesPerGame = production.gamesPlayed
    ? production.minutes / production.gamesPlayed
    : 0

  return {
    playerId: player.id,
    evaluationPoint,
    checkpointGamesPerTeam,
    rawValue: round(rawValue),
    currentFormSignal: round(currentForm),
    projectionSignal: round(projectionSignal),
    confidence: valueConfidence(production),
    sample: {
      games: production.gamesPlayed,
      minutes: production.minutes,
      seasons: 0,
    },
    breakdown: {
      currentAbility: round(
        weighted(ability * 10, config.currentAbilityEmphasis)
      ),
      recentProduction: round(currentForm * evidenceWeight),
      projectedContribution: round(projectionSignal * projectionWeight),
      ageTrajectory: round(weighted(ageTrajectory, config.trajectoryEmphasis)),
      upside: round(weighted(upside, config.upsideEmphasis)),
      durability: round(weighted(durability, config.durabilityImpact)),
      opportunity: round(opportunityImpact),
      roleContext: round(roleContext),
      defensiveContribution: round(defensiveContribution),
    },
    diagnostics: {
      percentile: 0,
      rank: 0,
      outlierFlags: [
        ...(production.gamesPlayed === 0 ? ["no-production-sample"] : []),
        ...(production.availabilityRate < 60 && production.gamesScheduled > 0
          ? ["limited-availability"]
          : []),
        ...(production.gamesPlayed > 0 && minutesPerGame < 12
          ? ["limited-opportunity"]
          : []),
      ],
    },
  }
}

export function calculateUniversalPlayerValues(
  fixture: SeasonFixture,
  aggregation: ProductionAggregation,
  config: UniversalPlayerValueConfig,
  checkpointGamesPerTeam: number,
  evaluationPoint: UniversalPlayerValue["evaluationPoint"] = checkpointGamesPerTeam ===
  0
    ? "preseason"
    : "checkpoint"
): Record<string, UniversalPlayerValue> {
  const values = Object.fromEntries(
    Object.values(fixture.players).map((player) => {
      const production = aggregation.players[player.id]!
      return [
        player.id,
        buildValue(
          player,
          production,
          aggregation,
          config,
          checkpointGamesPerTeam,
          evaluationPoint
        ),
      ]
    })
  ) as Record<string, UniversalPlayerValue>
  const populationByPlayerId = new Map<string, SeasonPopulationKind>()
  const populationGroups: Record<SeasonPopulationKind, UniversalPlayerValue[]> =
    {
      rostered: [],
      "free-agent": [],
      "draft-prospect": [],
    }
  const populations: Array<[SeasonPopulationKind, string[]]> = [
    ["rostered", fixture.populations.rostered],
    ["free-agent", fixture.populations.freeAgents],
    ["draft-prospect", fixture.populations.draftProspects],
  ]
  for (const [population, playerIds] of populations) {
    for (const playerId of playerIds) {
      populationByPlayerId.set(playerId, population)
    }
  }
  for (const value of Object.values(values)) {
    populationGroups[
      populationByPlayerId.get(value.playerId) ?? "rostered"
    ].push(value)
  }
  for (const ordered of Object.values(populationGroups)) {
    ordered.sort((left, right) => right.rawValue - left.rawValue)
    const total = Math.max(1, ordered.length)
    ordered.forEach((value, index) => {
      value.diagnostics.rank = index + 1
      value.diagnostics.percentile = round(((total - index) / total) * 100)
    })
  }
  return values
}
