import type {
  ContractEntity,
  ContractMarketFixture,
  ContractOffer,
  ContractOfferDecision,
  ContractPhase,
  EconomyConfig,
  FreeAgencyRights,
} from "@workspace/domain-v2"

import {
  calculateContractDemand,
  evaluateCompetitiveOffers,
  validateContractOffer,
} from "./marketEngine"
import { createEconomySnapshot } from "./economy"
import { STANDARD_ECONOMY_CONFIG } from "./marketConfig"

export type MarketRoundResult = {
  round: number
  offers: ContractOffer[]
  decisions: ContractOfferDecision[]
  acceptedPlayerIds: string[]
  teamActivity: MarketTeamRoundResult[]
}

export type MarketTeamRoundResult = {
  teamId: string
  targetPlayerIds: string[]
  activeOfferCount: number
  rejectedOfferCount: number
  payrollBefore: number
  payrollAfter: number
  reservedSalary: number
  rosteredPlayerCountBefore: number
  rosteredPlayerCountAfter: number
  marketRosterSlotsBefore: number
  marketRosterSlotsAfter: number
  reservedRosterSlots: number
}

export type MarketCleanupResult = {
  enabled: boolean
  consideredPlayerIds: string[]
  offers: ContractOffer[]
  decisions: ContractOfferDecision[]
  acceptedPlayerIds: string[]
}

export type MarketPlayerCoverage = {
  playerId: string
  targetedRounds: number[]
  offerCount: number
  teamCount: number
  acceptCount: number
  waitCount: number
  declineCount: number
  lockoutCount: number
  cleanupConsidered: boolean
  finalStatus: "signed" | "unsigned"
  finalReason: string
}

export type FreeAgencySimulationProgress = {
  phase: "preparing" | "offering" | "resolving" | "finalizing"
  round: number | null
  totalRounds: number
  availablePlayers: number
  offerCount: number
  label: string
}

export type FreeAgencySimulationOptions = {
  userTeamId?: string | null
  onProgress?: (progress: FreeAgencySimulationProgress) => void
}

export type FreeAgencySimulationResult = {
  version: 1
  seed: string
  userTeamId: string | null
  rounds: MarketRoundResult[]
  cleanup: MarketCleanupResult
  playerCoverage: MarketPlayerCoverage[]
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
    Math.max(
      1,
      round === 3 ? Math.min(2, demand.preferredYears) : demand.preferredYears
    )
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
  return validateContractOffer(fixture, minimumOffer).valid
    ? minimumOffer
    : null
}

function refreshTeamFinancials(
  fixture: ContractMarketFixture,
  teamId: string
) {
  const team = fixture.teamContexts[teamId]
  if (!team) return
  const committedPayroll = team.payroll + team.reservedSalary
  team.capRoom = Math.max(0, fixture.economy.softCap - committedPayroll)
  team.taxRoom = fixture.economy.taxLine - committedPayroll
  team.hardCapRoom = fixture.economy.hardCapLine - committedPayroll
}

function reserveTeamSalary(
  fixture: ContractMarketFixture,
  teamId: string,
  salary: number
): boolean {
  const team = fixture.teamContexts[teamId]
  if (!team || team.marketRosterSlots <= team.reservedRosterSlots) {
    return false
  }
  team.reservedSalary += salary
  team.reservedRosterSlots += 1
  refreshTeamFinancials(fixture, teamId)
  return true
}

function releaseTeamSalary(
  fixture: ContractMarketFixture,
  teamId: string,
  salary: number
) {
  const team = fixture.teamContexts[teamId]
  if (!team) return
  team.reservedSalary = Math.max(0, team.reservedSalary - salary)
  team.reservedRosterSlots = Math.max(0, team.reservedRosterSlots - 1)
  refreshTeamFinancials(fixture, teamId)
}

function commitTeamPayroll(
  fixture: ContractMarketFixture,
  teamId: string,
  salary: number
) {
  const team = fixture.teamContexts[teamId]
  if (!team) return
  team.reservedSalary = Math.max(0, team.reservedSalary - salary)
  team.reservedRosterSlots = Math.max(0, team.reservedRosterSlots - 1)
  team.marketRosterSlots = Math.max(0, team.marketRosterSlots - 1)
  team.rosteredPlayerCount += 1
  team.payroll += salary
  refreshTeamFinancials(fixture, teamId)
}

function updateTeamNeedsAfterSigning(
  fixture: ContractMarketFixture,
  teamId: string,
  playerId: string
) {
  const team = fixture.teamContexts[teamId]
  const player = fixture.players[playerId]
  if (!team || !player) return
  const position = player.profile.role.primaryPosition
  team.positionalNeeds[position] = Math.max(
    0,
    (team.positionalNeeds[position] ?? 0) - 20
  )
}

function removeFromProjectedFreeAgency(
  fixture: ContractMarketFixture,
  playerId: string
) {
  fixture.projectedFreeAgency.entries =
    fixture.projectedFreeAgency.entries.filter(
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
    fixture.projectedFreeAgency.entries
      .map((entry) => entry.archetype)
      .map((archetype) => [
        archetype,
        fixture.projectedFreeAgency.entries.filter(
          (entry) => entry.archetype === archetype
        ).length,
      ])
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

function targetBoardScore(
  fixture: ContractMarketFixture,
  playerId: string,
  teamId: string
): number {
  const player = fixture.players[playerId]
  const team = fixture.teamContexts[teamId]
  if (!player || !team) return Number.NEGATIVE_INFINITY
  const position = player.profile.role.primaryPosition
  const playerQuality = Math.min(
    100,
    Math.max(0, (fixture.values[playerId]?.rawValue ?? 0) / 10)
  )
  return (
    (team.positionalNeeds[position] ?? 0) * 0.35 +
    playerQuality * 0.25 +
    team.teamQuality * 0.12 +
    team.roleOpportunity * 0.12 +
    team.playingTimeProjection * 0.1 +
    team.spendingTolerance * 0.08
  )
}

function buildTargetBoard(
  fixture: ContractMarketFixture,
  teamId: string,
  availablePlayerIds: Iterable<string>,
  round: number,
  teamHistory: Set<string>,
  exposureCounts: Map<string, number>
): string[] {
  const scored = [...availablePlayerIds]
    .map((playerId) => ({
      playerId,
      score:
        targetBoardScore(fixture, playerId, teamId) +
        ((exposureCounts.get(playerId) ?? 0) === 0
          ? 10
          : (exposureCounts.get(playerId) ?? 0) < 3
            ? 4
            : 0),
      carryover: teamHistory.has(playerId),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort(
      (left, right) =>
        right.score - left.score || left.playerId.localeCompare(right.playerId)
    )
  const carryoverSlots = round === 1 ? 0 : round === 2 ? 4 : 2
  const carryovers = scored
    .filter((entry) => entry.carryover)
    .slice(0, Math.min(carryoverSlots, fixture.config.targetBoardSize))
  const selectedIds = new Set(carryovers.map((entry) => entry.playerId))
  const discovery = scored
    .filter((entry) => !selectedIds.has(entry.playerId))
    .sort(
      (left, right) =>
        Number(right.carryover) - Number(left.carryover) ||
        right.score - left.score ||
        left.playerId.localeCompare(right.playerId)
    )
    .slice(0, fixture.config.targetBoardSize - carryovers.length)
  return [...carryovers, ...discovery]
    .map((entry) => entry.playerId)
}

function resolveOfferCycle(
  working: ContractMarketFixture,
  offers: ContractOffer[],
  available: Set<string>,
  signedContracts: ContractEntity[]
): { decisions: ContractOfferDecision[]; acceptedPlayerIds: string[] } {
  const decisions = evaluateCompetitiveOffers(working, offers, {
    offersHaveReservations: true,
  })
  const acceptedPlayerIds: string[] = []
  const pendingAcceptedDecisions = decisions.filter(
    (decision) => decision.decision === "accept"
  )
  for (let index = 0; index < pendingAcceptedDecisions.length; index += 1) {
    const decision = pendingAcceptedDecisions[index]!
    if (
      decision.decision !== "accept" ||
      acceptedPlayerIds.includes(decision.playerId)
    ) {
      continue
    }
    const offer = offers.find((candidate) => candidate.id === decision.offerId)
    if (!offer) continue
    const firstYearSalary = offer.annualSalary[0] ?? 0
    const legality = validateContractOffer(working, offer, {
      reservedSalaryExclusion: firstYearSalary,
    })
    if (!legality.valid) {
      decision.decision = "decline"
      decision.legal = legality
      decision.reasonCodes = [
        "offer-invalidated-by-current-capacity",
        "league-legality-failed",
      ]
      decision.summary =
        "The team no longer has legal payroll or roster capacity for this offer."
      const fallback = decisions
        .filter(
          (candidate) =>
            candidate.playerId === decision.playerId &&
            candidate.offerId !== decision.offerId &&
            candidate.decision !== "refuse-further-negotiation"
        )
        .sort((left, right) => right.utility.total - left.utility.total)
        .map((candidate) => ({
          candidate,
          offer: offers.find((candidateOffer) => candidateOffer.id === candidate.offerId),
        }))
        .find(({ candidate, offer: fallbackOffer }) => {
          if (
            !fallbackOffer ||
            candidate.utility.total < working.config.minimumAcceptableUtility
          ) {
            return false
          }
          return validateContractOffer(working, fallbackOffer, {
            reservedSalaryExclusion: fallbackOffer.annualSalary[0] ?? 0,
          }).valid
        })
      if (fallback) {
        fallback.candidate.decision = "accept"
        fallback.candidate.reasonCodes = [
          "accepted-after-capacity-recheck",
        ]
        fallback.candidate.summary =
          "The next-best legal offer was accepted after the leading offer lost capacity."
        pendingAcceptedDecisions.push(fallback.candidate)
      }
      continue
    }
    decision.legal = legality
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
    commitTeamPayroll(working, offer.teamId, firstYearSalary)
    updateTeamNeedsAfterSigning(working, offer.teamId, offer.playerId)
    working.actualFreeAgentIds = working.actualFreeAgentIds.filter(
      (playerId) => playerId !== offer.playerId
    )
    removeFromProjectedFreeAgency(working, offer.playerId)
    available.delete(offer.playerId)
    signedContracts.push(contract)
    acceptedPlayerIds.push(offer.playerId)
  }

  const acceptedOfferIds = new Set(
    decisions
      .filter((decision) => decision.decision === "accept")
      .map((decision) => decision.offerId)
  )
  for (const offer of offers) {
    if (!acceptedOfferIds.has(offer.id)) {
      releaseTeamSalary(working, offer.teamId, offer.annualSalary[0] ?? 0)
    }
  }
  for (const decision of decisions.filter(
    (candidate) => candidate.decision === "accept"
  )) {
    const offer = offers.find((candidate) => candidate.id === decision.offerId)
    if (!offer) continue
    const periodKey = `${offer.playerId}:${offer.teamId}:${offer.season}:${offer.phase}`
    const previousState = working.negotiationStates[periodKey]
    working.offers[offer.id] = structuredClone(offer)
    working.negotiationStates[periodKey] = {
      playerId: offer.playerId,
      teamId: offer.teamId,
      periodKey,
      willingness: decision.willingnessAfter,
      status: "active",
      offersSubmitted: (previousState?.offersSubmitted ?? 0) + 1,
      lastOfferId: offer.id,
      reasonCodes: decision.reasonCodes,
    }
  }

  return { decisions, acceptedPlayerIds }
}

export function runFreeAgencySimulation(
  fixture: ContractMarketFixture,
  options: FreeAgencySimulationOptions = {}
): FreeAgencySimulationResult {
  const working = structuredClone(fixture)
  const rounds: MarketRoundResult[] = []
  const available = new Set(working.actualFreeAgentIds)
  const signedContracts: ContractEntity[] = []
  const totalRounds = working.config.freeAgencyRounds
  const targetHistory = new Map<string, Set<string>>()
  const exposureCounts = new Map<string, number>()

  options.onProgress?.({
    phase: "preparing",
    round: null,
    totalRounds,
    availablePlayers: available.size,
    offerCount: 0,
    label: "Preparing free agency",
  })

  for (let round = 1; round <= totalRounds; round += 1) {
    const offers: ContractOffer[] = []
    const teamActivity = new Map<string, MarketTeamRoundResult>()
    options.onProgress?.({
      phase: "offering",
      round,
      totalRounds,
      availablePlayers: available.size,
      offerCount: 0,
      label: `Generating round ${round} offers`,
    })
    for (const teamId of Object.keys(working.teamContexts).sort()) {
      const team = working.teamContexts[teamId]!
      const targetPlayerIds = buildTargetBoard(
        working,
        teamId,
        available,
        round,
        targetHistory.get(teamId) ?? new Set<string>(),
        exposureCounts
      )
      targetHistory.set(teamId, new Set(targetPlayerIds))
      for (const playerId of targetPlayerIds) {
        exposureCounts.set(playerId, (exposureCounts.get(playerId) ?? 0) + 1)
      }
      const activity: MarketTeamRoundResult = {
        teamId,
        targetPlayerIds,
        activeOfferCount: 0,
        rejectedOfferCount: 0,
        payrollBefore: team.payroll,
        payrollAfter: team.payroll,
        reservedSalary: team.reservedSalary,
        rosteredPlayerCountBefore: team.rosteredPlayerCount,
        rosteredPlayerCountAfter: team.rosteredPlayerCount,
        marketRosterSlotsBefore: team.marketRosterSlots,
        marketRosterSlotsAfter: team.marketRosterSlots,
        reservedRosterSlots: team.reservedRosterSlots,
      }
      teamActivity.set(teamId, activity)

      for (const playerId of targetPlayerIds) {
        const offer = createAiOffer(working, playerId, teamId, round)
        if (!offer) {
          activity.rejectedOfferCount += 1
          continue
        }
        const legality = validateContractOffer(working, offer)
        if (!legality.valid) {
          activity.rejectedOfferCount += 1
          continue
        }
        if (!reserveTeamSalary(working, teamId, offer.annualSalary[0] ?? 0)) {
          activity.rejectedOfferCount += 1
          continue
        }
        activity.activeOfferCount += 1
        offers.push(offer)
      }
      activity.reservedSalary = working.teamContexts[teamId]!.reservedSalary
      activity.reservedRosterSlots =
        working.teamContexts[teamId]!.reservedRosterSlots
    }

    options.onProgress?.({
      phase: "resolving",
      round,
      totalRounds,
      availablePlayers: available.size,
      offerCount: offers.length,
      label: `Resolving round ${round}`,
    })
    const { decisions, acceptedPlayerIds } = resolveOfferCycle(
      working,
      offers,
      available,
      signedContracts
    )
    for (const activity of teamActivity.values()) {
      const team = working.teamContexts[activity.teamId]!
      activity.payrollAfter = team.payroll
      activity.reservedSalary = team.reservedSalary
      activity.rosteredPlayerCountAfter = team.rosteredPlayerCount
      activity.marketRosterSlotsAfter = team.marketRosterSlots
      activity.reservedRosterSlots = team.reservedRosterSlots
    }

    rounds.push({
      round,
      offers,
      decisions,
      acceptedPlayerIds,
      teamActivity: [...teamActivity.values()],
    })
    options.onProgress?.({
      phase: "resolving",
      round,
      totalRounds,
      availablePlayers: available.size,
      offerCount: offers.length,
      label: `Round ${round} complete`,
    })
    if (available.size === 0) break
  }

  const cleanup: MarketCleanupResult = {
    enabled: working.config.lateMarketCleanup,
    consideredPlayerIds: working.config.lateMarketCleanup ? [...available] : [],
    offers: [],
    decisions: [],
    acceptedPlayerIds: [],
  }
  if (cleanup.enabled && available.size > 0) {
    options.onProgress?.({
      phase: "finalizing",
      round: rounds.at(-1)?.round ?? null,
      totalRounds,
      availablePlayers: available.size,
      offerCount: rounds.reduce((sum, round) => sum + round.offers.length, 0),
      label: "Running late-market cleanup",
    })
    for (const teamId of Object.keys(working.teamContexts).sort()) {
      const team = working.teamContexts[teamId]!
      const candidates = [...available]
        .map((playerId) => ({
          playerId,
          score:
            targetBoardScore(working, playerId, teamId) +
            ((exposureCounts.get(playerId) ?? 0) === 0
              ? 10
              : (exposureCounts.get(playerId) ?? 0) < 3
                ? 4
                : 0),
        }))
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.playerId.localeCompare(right.playerId)
        )
        .slice(0, Math.min(working.config.targetBoardSize, team.marketRosterSlots))
      for (const { playerId } of candidates) {
        const baseOffer = createAiOffer(
          working,
          playerId,
          teamId,
          totalRounds
        )
        if (!baseOffer) continue
        const offer = { ...baseOffer, id: `${baseOffer.id}:cleanup` }
        if (!validateContractOffer(working, offer).valid) continue
        if (!reserveTeamSalary(working, teamId, offer.annualSalary[0] ?? 0)) {
          continue
        }
        cleanup.offers.push(offer)
      }
    }
    const resolvedCleanup = resolveOfferCycle(
      working,
      cleanup.offers,
      available,
      signedContracts
    )
    cleanup.decisions = resolvedCleanup.decisions
    cleanup.acceptedPlayerIds = resolvedCleanup.acceptedPlayerIds
  }

  const cleanupConsidered = new Set(cleanup.consideredPlayerIds)
  const signedIds = new Set(signedContracts.map((contract) => contract.playerId))
  const cleanupSignedIds = new Set(cleanup.acceptedPlayerIds)
  const allOffers = [...rounds.flatMap((round) => round.offers), ...cleanup.offers]
  const allDecisions = [
    ...rounds.flatMap((round) => round.decisions),
    ...cleanup.decisions,
  ]
  const playerCoverage: MarketPlayerCoverage[] = fixture.actualFreeAgentIds.map(
    (playerId) => {
      const playerOffers = allOffers.filter((offer) => offer.playerId === playerId)
      const playerDecisions = allDecisions.filter(
        (decision) => decision.playerId === playerId
      )
      const targetedRounds = rounds
        .filter((round) =>
          round.teamActivity.some((activity) =>
            activity.targetPlayerIds.includes(playerId)
          )
        )
        .map((round) => round.round)
      const teamCount = new Set(playerOffers.map((offer) => offer.teamId)).size
      let finalReason = "market-closed-without-signing"
      if (signedIds.has(playerId)) {
        finalReason = cleanupSignedIds.has(playerId)
          ? "signed-during-late-market-cleanup"
          : "signed-during-market-round"
      } else if (playerOffers.length === 0 && cleanupConsidered.has(playerId)) {
        finalReason = "no-eligible-offer"
      } else if (playerOffers.length === 0) {
        finalReason = "not-targeted"
      } else if (
        playerDecisions.some(
          (decision) => decision.decision === "refuse-further-negotiation"
        )
      ) {
        finalReason = "negotiation-locked"
      } else if (
        playerDecisions.some((decision) => decision.decision === "decline")
      ) {
        finalReason = "offers-declined"
      } else if (
        playerDecisions.some((decision) => decision.decision === "wait")
      ) {
        finalReason = "market-closed-after-wait"
      }
      return {
        playerId,
        targetedRounds,
        offerCount: playerOffers.length,
        teamCount,
        acceptCount: playerDecisions.filter(
          (decision) => decision.decision === "accept"
        ).length,
        waitCount: playerDecisions.filter(
          (decision) => decision.decision === "wait"
        ).length,
        declineCount: playerDecisions.filter(
          (decision) => decision.decision === "decline"
        ).length,
        lockoutCount: playerDecisions.filter(
          (decision) => decision.decision === "refuse-further-negotiation"
        ).length,
        cleanupConsidered: cleanupConsidered.has(playerId),
        finalStatus: signedIds.has(playerId) ? "signed" : "unsigned",
        finalReason,
      }
    }
  )

  options.onProgress?.({
    phase: "finalizing",
    round: rounds.at(-1)?.round ?? null,
    totalRounds,
    availablePlayers: available.size,
    offerCount:
      rounds.reduce((sum, round) => sum + round.offers.length, 0) +
      cleanup.offers.length,
    label: "Finalizing market report",
  })

  return {
    version: 1,
    seed: fixture.seed,
    userTeamId: options.userTeamId ?? null,
    rounds,
    cleanup,
    playerCoverage,
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
    throw new RangeError(
      "Economy simulations must run from one to 100 seasons."
    )
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
