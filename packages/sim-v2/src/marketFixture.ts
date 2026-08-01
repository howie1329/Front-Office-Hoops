import type {
  ContractEntity,
  ContractMarketConfig,
  ContractMarketFixture,
  EconomySnapshot,
  FreeAgencyRights,
  PlayerEntity,
  PlayerPosition,
  ProjectedFreeAgent,
  ProjectedFreeAgencyView,
  TeamMarketContext,
  TeamMarketStrategy,
  UniversalPlayerValue,
} from "@workspace/domain-v2"

import { createStandardGameSimulationConfig } from "./gameConfig"
import { getPlayerCurrentAbility } from "./playerGeneration"
import { createDeterministicRandom } from "./randomness"
import { createDefaultSeasonFixture } from "./seasonFixture"
import {
  STANDARD_CONTRACT_MARKET_CONFIG,
  STANDARD_ECONOMY_CONFIG,
} from "./marketConfig"
import { createEconomySnapshot } from "./economy"

const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundMoney(value: number): number {
  return Math.round(value / 10_000) * 10_000
}

function getPlayerPosition(player: PlayerEntity): PlayerPosition {
  return player.profile.role.primaryPosition
}

function getTeamIdByPlayer(
  rosters: Record<string, string[]>,
  playerId: string
): string | null {
  for (const [teamId, playerIds] of Object.entries(rosters)) {
    if (playerIds.includes(playerId)) return teamId
  }
  return null
}

function getQualityTier(
  player: PlayerEntity,
  value: UniversalPlayerValue
): ProjectedFreeAgent["qualityTier"] {
  const ability = getPlayerCurrentAbility(player)
  if (value.rawValue >= 820 || ability >= 86) return "star"
  if (value.rawValue >= 700 || ability >= 75) return "starter"
  if (value.rawValue >= 570 || ability >= 64) return "rotation"
  return "depth"
}

function createRights(
  teamId: string | null,
  contract: ContractEntity | undefined
): FreeAgencyRights {
  if (!teamId || !contract) {
    return {
      level: "none",
      teamId: null,
      seasonsWithTeam: 0,
      lastContractId: null,
    }
  }

  return {
    level: contract.rights.level,
    teamId,
    seasonsWithTeam: contract.rights.seasonsWithTeam,
    lastContractId: contract.id,
  }
}

function createPreseasonValue(player: PlayerEntity): UniversalPlayerValue {
  const ability = getPlayerCurrentAbility(player)
  const potentialGap = Math.max(
    0,
    player.profile.development.potential - player.profile.development.rating
  )
  const projectionSignal = ability * 10 + potentialGap * 1.8
  const rawValue = projectionSignal * 0.88 + ability * 10 * 0.12

  return {
    playerId: player.id,
    evaluationPoint: "preseason",
    checkpointGamesPerTeam: 0,
    rawValue: Math.round(rawValue * 100) / 100,
    currentFormSignal: 0,
    projectionSignal: Math.round(projectionSignal * 100) / 100,
    confidence: "provisional",
    sample: { games: 0, minutes: 0, seasons: 0 },
    breakdown: {
      currentAbility: ability * 10,
      recentProduction: 0,
      projectedContribution: Math.round(projectionSignal * 100) / 100,
      ageTrajectory: 0,
      upside: potentialGap,
      durability: player.profile.injuryResistance,
      opportunity: 0,
      roleContext: 0,
      defensiveContribution: player.profile.skills.defense,
    },
    diagnostics: {
      percentile: 0,
      rank: 0,
      outlierFlags: ["preseason-fixture-value"],
    },
  }
}

function createContract(
  player: PlayerEntity,
  teamId: string,
  season: number,
  economy: EconomySnapshot,
  randomSeed: string
): ContractEntity {
  const random = createDeterministicRandom(randomSeed)
  const ability = getPlayerCurrentAbility(player)
  const normalizedAbility = clamp((ability - 45) / 45, 0, 1)
  const firstYearSalary = roundMoney(
    economy.minimumSalary +
      normalizedAbility * (economy.maximumSalary - economy.minimumSalary) * 0.4
  )
  const years = random.int(1, 4)
  const seasonsWithTeam = random.int(1, 4)
  const rightsLevel =
    seasonsWithTeam >= 3
      ? "bird"
      : seasonsWithTeam === 2
        ? "early-bird"
        : "non-bird"
  const annualSalary = Array.from({ length: years }, (_, index) =>
    roundMoney(
      firstYearSalary *
        (1 + economy.config.standardRaiseRate) ** index
    )
  )

  return {
    id: `${player.id}:contract:current`,
    playerId: player.id,
    teamId,
    startSeason: season,
    endSeason: season + years - 1,
    years,
    annualSalary,
    fullyGuaranteed: true,
    rights: {
      level: rightsLevel,
      teamId,
      seasonsWithTeam,
      lastContractId: `${player.id}:contract:current`,
    },
    source: "manual",
  }
}

function createTeamStrategy(index: number): TeamMarketStrategy {
  if (index % 7 === 0) return "financially-constrained"
  if (index % 5 === 0) return "rebuilding"
  if (index % 3 === 0) return "contender"
  if (index % 2 === 0) return "developing"
  return "middle"
}

function createProjectedFreeAgency(
  season: number,
  players: Record<string, PlayerEntity>,
  rosters: Record<string, string[]>,
  contracts: Record<string, ContractEntity>,
  values: Record<string, UniversalPlayerValue>
): ProjectedFreeAgencyView {
  const entries: ProjectedFreeAgent[] = []
  const actualFreeAgentIds: string[] = []

  for (const player of Object.values(players)) {
    const currentTeamId = getTeamIdByPlayer(rosters, player.id)
    const contract = contracts[player.id]
    const isActualFreeAgent = player.leagueStatus.kind === "free-agent"
    const expiresAfterSeason = contract?.endSeason === season

    if (!isActualFreeAgent && !expiresAfterSeason) continue
    if (isActualFreeAgent) actualFreeAgentIds.push(player.id)

    entries.push({
      playerId: player.id,
      currentTeamId,
      projectedSeason: isActualFreeAgent ? season : season + 1,
      rights: createRights(currentTeamId, contract),
      position: getPlayerPosition(player),
      archetype: player.profile.role.primaryArchetype,
      qualityTier: getQualityTier(player, values[player.id]!),
    })
  }

  const supplyByPosition = Object.fromEntries(
    positions.map((position) => [
      position,
      entries.filter((entry) => entry.position === position).length,
    ])
  ) as Record<PlayerPosition, number>
  const supplyByArchetype = Object.fromEntries(
    entries.map((entry) => entry.archetype).map((archetype) => [
      archetype,
      entries.filter((entry) => entry.archetype === archetype).length,
    ])
  )

  return {
    version: 1,
    season,
    entries,
    supplyByPosition,
    supplyByArchetype,
  }
}

export type ContractMarketFixtureOptions = {
  season?: number
  economy?: EconomySnapshot
  config?: ContractMarketConfig
}

export function createDefaultContractMarketFixture(
  seed = "market-rules-lab",
  options: ContractMarketFixtureOptions = {}
): ContractMarketFixture {
  const season = options.season ?? 1
  const economy =
    options.economy ?? createEconomySnapshot(season, STANDARD_ECONOMY_CONFIG)
  const config = options.config
    ? structuredClone(options.config)
    : structuredClone(STANDARD_CONTRACT_MARKET_CONFIG)
  const seasonFixture = createDefaultSeasonFixture(`${seed}:season`, {
    runPreset: "smoke",
    gameConfig: createStandardGameSimulationConfig(),
  })
  const players = structuredClone(seasonFixture.players)
  const contracts: Record<string, ContractEntity> = {}
  const values = Object.fromEntries(
    Object.values(players).map((player) => [
      player.id,
      createPreseasonValue(player),
    ])
  ) as Record<string, UniversalPlayerValue>

  for (const [teamId, playerIds] of Object.entries(seasonFixture.rosters)) {
    for (const playerId of playerIds) {
      const player = players[playerId]
      if (!player) continue
      contracts[playerId] = createContract(
        player,
        teamId,
        season,
        economy,
        `${seed}:contract:${playerId}`
      )
    }
  }

  const teamContexts = Object.fromEntries(
    Object.entries(seasonFixture.teams).map(([teamId, team], index) => {
      const teamContracts = Object.values(contracts).filter(
        (contract) => contract.teamId === teamId
      )
      const payroll = teamContracts.reduce(
        (sum, contract) => sum + (contract.annualSalary[0] ?? 0),
        0
      )
      const random = createDeterministicRandom(`${seed}:team:${teamId}`)
      const positionalNeeds = Object.fromEntries(
        positions.map((position) => [position, random.int(20, 80)])
      ) as Partial<Record<PlayerPosition, number>>

      const context: TeamMarketContext = {
        team,
        payroll,
        reservedSalary: 0,
        capRoom: Math.max(0, economy.softCap - payroll),
        taxRoom: Math.max(0, economy.taxLine - payroll),
        hardCapRoom: Math.max(0, economy.hardCapLine - payroll),
        lastSeasonWins: random.int(20, 62),
        teamQuality: random.int(35, 85),
        marketSize: random.int(30, 90),
        roleOpportunity: random.int(35, 85),
        playingTimeProjection: random.int(35, 85),
        spendingTolerance: random.int(35, 85),
        strategy: createTeamStrategy(index),
        positionalNeeds,
      }
      return [teamId, context]
    })
  ) as Record<string, TeamMarketContext>

  const projectedFreeAgency = createProjectedFreeAgency(
    season,
    players,
    seasonFixture.rosters,
    contracts,
    values
  )

  return {
    version: 1,
    seed,
    season,
    economy,
    config,
    teams: structuredClone(seasonFixture.teams),
    players,
    contracts,
    offers: {},
    values,
    teamContexts,
    projectedFreeAgency,
    actualFreeAgentIds: projectedFreeAgency.entries
      .filter((entry) => entry.currentTeamId === null)
      .map((entry) => entry.playerId),
    negotiationStates: {},
  }
}
