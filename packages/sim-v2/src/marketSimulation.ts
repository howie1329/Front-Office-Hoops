import type {
  ContractEntity,
  ContractMarketFixture,
  ContractOffer,
  ContractOfferDecision,
  ContractPhase,
  EconomyConfig,
  FreeAgencyRights,
} from "@workspace/domain-v2"

import { applyContractOfferDecision, calculateContractDemand, evaluateCompetitiveOffers, validateContractOffer } from "./marketEngine"
import { createEconomySnapshot } from "./economy"
import { STANDARD_ECONOMY_CONFIG } from "./marketConfig"

export type MarketRoundResult = {
  round: number
  offers: ContractOffer[]
  decisions: ContractOfferDecision[]
  acceptedPlayerIds: string[]
}

export type FreeAgencySimulationResult = {
  version: 1
  seed: string
  userTeamId: string | null
  rounds: MarketRoundResult[]
  signedContracts: ContractEntity[]
  unsignedPlayerIds: string[]
  finalFixture: ContractMarketFixture
}

export type EconomySimulationSeason = {
  season: number
  softCap: number
  taxLine: number
  maximumSalary: number
  minimumSalary: number
  rookieScaleTop: number
}

export type EconomySimulationResult = {
  version: 1
  seed: string
  seasons: EconomySimulationSeason[]
  harnessNote: string
}

function roundMoney(value: number): number {
  return Math.round(value / 10_000) * 10_000
}

function createAiOffer(
  fixture: ContractMarketFixture,
  playerId: string,
  teamId: string,
  round: number,
  phase: ContractPhase = "free-agency"
): ContractOffer | null {
  const team = fixture.teamContexts[teamId]
  if (!team) return null
  const demand = calculateContractDemand(fixture, playerId, phase)
  const strategyFactor =
    team.strategy === "financially-constrained"
      ? 0.86
      : team.strategy === "rebuilding"
        ? 0.92
        : team.strategy === "contender"
          ? 1.04
          : 0.98
  const patienceFactor = 1 - (round - 1) * 0.035
  const annualValue = roundMoney(
    demand.projectedAnnualValue *
      (0.91 + team.spendingTolerance / 1000) *
      strategyFactor *
      patienceFactor
  )
  const years = Math.min(
    4,
    Math.max(1, round === 3 ? Math.min(2, demand.preferredYears) : demand.preferredYears)
  )
  const offer: ContractOffer = {
    id: `${fixture.seed}:round-${round}:${teamId}:${playerId}`,
    playerId,
    teamId,
    season: fixture.season,
    phase,
    round,
    annualSalary: Array.from({ length: years }, (_, index) =>
      roundMoney(
        annualValue * (1 + fixture.economy.config.standardRaiseRate) ** index
      )
    ),
    years,
    fullyGuaranteed: true,
    source: "ai",
  }

  if (validateContractOffer(fixture, offer).valid) return offer

  const minimumOffer: ContractOffer = {
    ...offer,
    id: `${offer.id}:minimum`,
    years: 1,
    annualSalary: [fixture.economy.minimumSalary],
  }
  return validateContractOffer(fixture, minimumOffer).valid ? minimumOffer : null
}

function updateTeamPayroll(
  fixture: ContractMarketFixture,
  teamId: string,
  salary: number
) {
  const team = fixture.teamContexts[teamId]
  if (!team) return
  team.payroll += salary
  team.capRoom = Math.max(0, fixture.economy.softCap - team.payroll)
  team.taxRoom = fixture.economy.taxLine - team.payroll
  team.hardCapRoom = fixture.economy.hardCapLine - team.payroll
}

function removeFromProjectedFreeAgency(
  fixture: ContractMarketFixture,
  playerId: string
) {
  fixture.projectedFreeAgency.entries = fixture.projectedFreeAgency.entries.filter(
    (entry) => entry.playerId !== playerId
  )
  fixture.projectedFreeAgency.supplyByPosition = Object.fromEntries(
    ["PG", "SG", "SF", "PF", "C"].map((position) => [
      position,
      fixture.projectedFreeAgency.entries.filter(
        (entry) => entry.position === position
      ).length,
    ])
  ) as typeof fixture.projectedFreeAgency.supplyByPosition
  fixture.projectedFreeAgency.supplyByArchetype = Object.fromEntries(
    fixture.projectedFreeAgency.entries.map((entry) => entry.archetype).map(
      (archetype) => [
        archetype,
        fixture.projectedFreeAgency.entries.filter(
          (entry) => entry.archetype === archetype
        ).length,
      ]
    )
  )
}

function createSignedContract(
  offer: ContractOffer,
  rights: FreeAgencyRights
): ContractEntity {
  return {
    id: `${offer.id}:contract`,
    playerId: offer.playerId,
    teamId: offer.teamId,
    startSeason: offer.season,
    endSeason: offer.season + offer.years - 1,
    years: offer.years,
    annualSalary: offer.annualSalary,
    fullyGuaranteed: true,
    rights,
    source: offer.phase === "extension" ? "extension" : "free-agent",
  }
}

function targetTeams(
  fixture: ContractMarketFixture,
  playerId: string,
  maxTeams = 3
): string[] {
  const player = fixture.players[playerId]
  if (!player) return []
  const position = player.profile.role.primaryPosition
  return Object.values(fixture.teamContexts)
    .map((team) => ({
      teamId: team.team.id,
      score:
        (team.positionalNeeds[position] ?? 0) * 0.45 +
        team.teamQuality * 0.2 +
        team.spendingTolerance * 0.15 +
        team.playingTimeProjection * 0.2,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxTeams)
    .map((entry) => entry.teamId)
}

export function runFreeAgencySimulation(
  fixture: ContractMarketFixture,
  options: { userTeamId?: string | null; maxTeamsPerPlayer?: number } = {}
): FreeAgencySimulationResult {
  const working = structuredClone(fixture)
  const rounds: MarketRoundResult[] = []
  const available = new Set(working.actualFreeAgentIds)
  const signedContracts: ContractEntity[] = []

  for (let round = 1; round <= working.config.freeAgencyRounds; round += 1) {
    const offers: ContractOffer[] = []
    for (const playerId of available) {
      for (const teamId of targetTeams(
        working,
        playerId,
        options.maxTeamsPerPlayer ?? 3
      )) {
        const offer = createAiOffer(working, playerId, teamId, round)
        if (offer) offers.push(offer)
      }
    }

    const decisions = evaluateCompetitiveOffers(working, offers)
    const acceptedPlayerIds: string[] = []
    for (const decision of decisions) {
      if (decision.decision !== "accept" || acceptedPlayerIds.includes(decision.playerId)) continue
      const offer = offers.find((candidate) => candidate.id === decision.offerId)
      if (!offer) continue
      const before = working.contracts[offer.playerId]
      const nextRights: FreeAgencyRights = {
        level: "none",
        teamId: null,
        seasonsWithTeam: 0,
        lastContractId: before?.id ?? null,
      }
      const contract = createSignedContract(offer, nextRights)
      working.contracts[offer.playerId] = contract
      working.players[offer.playerId] = {
        ...working.players[offer.playerId]!,
        leagueStatus: { kind: "rostered", teamId: offer.teamId },
      }
      updateTeamPayroll(working, offer.teamId, offer.annualSalary[0] ?? 0)
      working.actualFreeAgentIds = working.actualFreeAgentIds.filter(
        (playerId) => playerId !== offer.playerId
      )
      removeFromProjectedFreeAgency(working, offer.playerId)
      available.delete(offer.playerId)
      signedContracts.push(contract)
      acceptedPlayerIds.push(offer.playerId)
      const statefulFixture = applyContractOfferDecision(
        working,
        offer,
        decision
      )
      working.offers = statefulFixture.offers
      working.negotiationStates = statefulFixture.negotiationStates
    }

    rounds.push({ round, offers, decisions, acceptedPlayerIds })
    if (available.size === 0) break
  }

  return {
    version: 1,
    seed: fixture.seed,
    userTeamId: options.userTeamId ?? null,
    rounds,
    signedContracts,
    unsignedPlayerIds: [...available],
    finalFixture: working,
  }
}

export function runEconomySimulation(
  seed: string,
  seasons = 10,
  config: EconomyConfig = STANDARD_ECONOMY_CONFIG
): EconomySimulationResult {
  if (!Number.isInteger(seasons) || seasons < 1 || seasons > 100) {
    throw new RangeError("Economy simulations must run from one to 100 seasons.")
  }
  const snapshots = Array.from({ length: seasons }, (_, index) =>
    createEconomySnapshot(index + 1, config)
  )
  return {
    version: 1,
    seed,
    seasons: snapshots.map((snapshot) => ({
      season: snapshot.season,
      softCap: snapshot.softCap,
      taxLine: snapshot.taxLine,
      maximumSalary: snapshot.maximumSalary,
      minimumSalary: snapshot.minimumSalary,
      rookieScaleTop: snapshot.rookieScale[0]?.salary ?? 0,
    })),
    harnessNote:
      "This first economy mode validates cap and salary growth. Draft, retirement, development, and roster turnover remain a later integrated loop.",
  }
}
