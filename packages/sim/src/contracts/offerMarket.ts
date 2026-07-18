import type {
  ContractMarketPhase,
  ContractOffer,
  ExtensionOffer,
  FreeAgentOffer,
  LeagueRecord,
  Rng,
  StaffMember,
  StaffOffer,
} from "@workspace/shared/types"
import { ROSTER_MAX } from "@workspace/shared/constants"

import { getStaffByRole, STAFF_ROLES } from "../staff"
import { validateStaffHire, hireStaff } from "../staff/hireStaff"
import { findPlayer } from "../roster/ledger"
import {
  canExtendContract,
  extendContract,
} from "../financials/contractExtensions"
import {
  canSignPlayer,
  getExternalFreeAgents,
  getTeamExpiredFreeAgents,
  signFreeAgent,
} from "../financials/freeAgency"
import {
  calculateMinSalary,
  getSeasonFinancials,
  roundMoney,
} from "../financials/capMath"
import {
  buildExternalFaOffer,
  buildReSignOffer,
  canAffordOffer,
  getPriorContractSalary,
} from "../financials/ai/offers"
import { getTeamFinancialPosition } from "../financials/teamFinancialPosition"
import { getProjectedPlayerValue } from "../playerValue/projectedValue"
import {
  getPlayerContractMarketValue,
  getStaffContractMarketValue,
} from "./marketValue"
import {
  evaluatePlayerContractOffer,
  evaluateStaffContractOffer,
} from "./evaluateOffer"

const PLAYER_OFFER_MAX_ATTEMPTS = 3

function createOfferId(
  candidateId: string,
  teamId: string,
  phase: ContractMarketPhase
): string {
  return `offer_${phase}_${teamId}_${candidateId}_${crypto.randomUUID().slice(0, 8)}`
}

function asContractOffer(
  league: LeagueRecord,
  input: {
    candidateType: ContractOffer["candidateType"]
    candidateId: string
    teamId: string
    phase: ContractMarketPhase
    offer: FreeAgentOffer | StaffOffer | ExtensionOffer
    signingException?: ContractOffer["signingException"]
  }
): ContractOffer {
  return {
    id: createOfferId(input.candidateId, input.teamId, input.phase),
    candidateType: input.candidateType,
    candidateId: input.candidateId,
    teamId: input.teamId,
    phase: input.phase,
    years: input.offer.years,
    firstYearSalary: input.offer.firstYearSalary,
    signingException: input.signingException,
    status: "pending",
    createdDay: league.seasonState.currentDay,
  }
}

function withdrawExistingUserOffer(
  offers: ContractOffer[],
  nextOffer: ContractOffer
): ContractOffer[] {
  return offers.map((offer) =>
    offer.status === "pending" &&
    offer.phase === nextOffer.phase &&
    offer.candidateType === nextOffer.candidateType &&
    offer.candidateId === nextOffer.candidateId &&
    offer.teamId === nextOffer.teamId
      ? { ...offer, status: "withdrawn", resolvedDay: nextOffer.createdDay }
      : offer
  )
}

function getReSigningNegotiation(league: LeagueRecord, offer: ContractOffer) {
  return league.reSigningNegotiations.find(
    (entry) =>
      entry.candidateType === offer.candidateType &&
      entry.candidateId === offer.candidateId &&
      entry.teamId === offer.teamId &&
      entry.phase === offer.phase
  )
}

function updateReSigningNegotiation(
  league: LeagueRecord,
  offer: ContractOffer,
  accepted: boolean
) {
  const existing = getReSigningNegotiation(league, offer)
  const attemptsUsed = accepted
    ? (existing?.attemptsUsed ?? 0)
    : (existing?.attemptsUsed ?? 0) + 1
  const status = accepted
    ? "accepted"
    : attemptsUsed >= PLAYER_OFFER_MAX_ATTEMPTS
      ? "failed"
      : "open"

  const next = {
    candidateType: offer.candidateType,
    candidateId: offer.candidateId,
    teamId: offer.teamId,
    phase: offer.phase,
    attemptsUsed,
    maxAttempts: PLAYER_OFFER_MAX_ATTEMPTS,
    status,
  } as const

  return [
    ...league.reSigningNegotiations.filter(
      (entry) =>
        !(
          entry.candidateType === offer.candidateType &&
          entry.candidateId === offer.candidateId &&
          entry.teamId === offer.teamId &&
          entry.phase === offer.phase
        )
    ),
    next,
  ]
}

function withUpdatedPlayerNegotiation(
  league: LeagueRecord,
  offer: ContractOffer,
  accepted: boolean
): LeagueRecord {
  if (offer.candidateType !== "player" || offer.phase === "staff") {
    return league
  }

  return {
    ...league,
    reSigningNegotiations: updateReSigningNegotiation(league, offer, accepted),
  }
}

function findStaffCandidate(
  league: LeagueRecord,
  staffId: string
): StaffMember | undefined {
  return (
    league.staff.find((entry) => entry.id === staffId) ??
    league.collegeCoaches.find((entry) => entry.id === staffId)
  )
}

export function getContractOffersForCandidate(
  league: LeagueRecord,
  candidateId: string,
  candidateType: ContractOffer["candidateType"],
  phase?: ContractMarketPhase
): ContractOffer[] {
  return league.contractOffers.filter(
    (offer) =>
      offer.candidateId === candidateId &&
      offer.candidateType === candidateType &&
      (!phase || offer.phase === phase)
  )
}

export function getReSigningAttemptsRemaining(
  league: LeagueRecord,
  candidateId: string,
  teamId: string
): number {
  return getPlayerOfferAttemptsRemaining(
    league,
    candidateId,
    teamId,
    "re_signing"
  )
}

export function getPlayerOfferAttemptsRemaining(
  league: LeagueRecord,
  candidateId: string,
  teamId: string,
  phase: ContractMarketPhase
): number {
  const negotiation = league.reSigningNegotiations.find(
    (entry) =>
      entry.candidateType === "player" &&
      entry.candidateId === candidateId &&
      entry.teamId === teamId &&
      entry.phase === phase
  )
  return Math.max(
    0,
    PLAYER_OFFER_MAX_ATTEMPTS - (negotiation?.attemptsUsed ?? 0)
  )
}

export function isPlayerOfferBlocked(
  league: LeagueRecord,
  candidateId: string,
  teamId: string,
  phase: ContractMarketPhase
): boolean {
  return league.reSigningNegotiations.some(
    (entry) =>
      entry.candidateType === "player" &&
      entry.candidateId === candidateId &&
      entry.teamId === teamId &&
      entry.phase === phase &&
      entry.status === "failed"
  )
}

export function resetPlayerOfferNegotiations(
  league: LeagueRecord,
  phases: ContractMarketPhase[]
): LeagueRecord {
  const phaseSet = new Set(phases)
  return {
    ...league,
    reSigningNegotiations: league.reSigningNegotiations.filter(
      (entry) => !phaseSet.has(entry.phase)
    ),
  }
}

export function submitPlayerContractOffer(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: FreeAgentOffer
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Contract offers are only allowed during the offseason")
  }

  const phase =
    league.seasonState.offseasonPhase === "re_signing"
      ? "re_signing"
      : league.seasonState.offseasonPhase === "free_agency"
        ? "free_agency"
        : null

  if (!phase) {
    throw new Error(
      "Player contract offers are only allowed during re-signing or free agency"
    )
  }

  const validation = canSignPlayer(league, teamId, playerId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const player = findPlayer(league, playerId)
  if (!player) {
    throw new Error("Player not found")
  }

  const nextOffer = asContractOffer(league, {
    candidateType: "player",
    candidateId: playerId,
    teamId,
    phase,
    offer,
    signingException: validation.signingException,
  })

  if (phase === "re_signing") {
    const negotiation = getReSigningNegotiation(league, nextOffer)
    if (negotiation?.status === "failed") {
      throw new Error("This player will no longer negotiate during re-signing")
    }

    const decision = evaluatePlayerContractOffer(league, player, nextOffer)
    const resolvedOffer: ContractOffer = {
      ...nextOffer,
      status: decision.result === "accept" ? "accepted" : "declined",
      resolvedDay: league.seasonState.currentDay,
      decisionReason: decision.reason,
    }

    if (decision.result === "accept") {
      const signed = signFreeAgent(league, teamId, playerId, {
        ...offer,
        signingException: validation.signingException,
      })
      return {
        ...signed,
        contractOffers: [...signed.contractOffers, resolvedOffer],
        reSigningNegotiations: updateReSigningNegotiation(
          signed,
          nextOffer,
          true
        ),
      }
    }

    return {
      ...league,
      contractOffers: [...league.contractOffers, resolvedOffer],
      reSigningNegotiations: updateReSigningNegotiation(
        league,
        nextOffer,
        false
      ),
    }
  }

  if (isPlayerOfferBlocked(league, playerId, teamId, phase)) {
    throw new Error("This player will not consider another offer right now")
  }

  return {
    ...league,
    contractOffers: [
      ...withdrawExistingUserOffer(league.contractOffers, nextOffer),
      nextOffer,
    ],
  }
}

export function submitPlayerExtensionOffer(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: ExtensionOffer
): LeagueRecord {
  const validation = canExtendContract(league, teamId, playerId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  if (isPlayerOfferBlocked(league, playerId, teamId, "extension")) {
    throw new Error(
      "This player will not discuss an extension until the offseason"
    )
  }

  const player = findPlayer(league, playerId)
  if (!player) {
    throw new Error("Player not found")
  }

  const nextOffer = asContractOffer(league, {
    candidateType: "player",
    candidateId: playerId,
    teamId,
    phase: "extension",
    offer,
  })
  const decision = evaluatePlayerContractOffer(league, player, nextOffer)
  const resolvedOffer: ContractOffer = {
    ...nextOffer,
    status: decision.result === "accept" ? "accepted" : "declined",
    resolvedDay: league.seasonState.currentDay,
    decisionReason: decision.reason,
  }

  if (decision.result === "accept") {
    const extended = extendContract(league, teamId, playerId, offer)
    return {
      ...extended,
      contractOffers: [...extended.contractOffers, resolvedOffer],
      reSigningNegotiations: updateReSigningNegotiation(
        extended,
        nextOffer,
        true
      ),
    }
  }

  return {
    ...league,
    contractOffers: [...league.contractOffers, resolvedOffer],
    reSigningNegotiations: updateReSigningNegotiation(league, nextOffer, false),
  }
}

export function submitStaffContractOffer(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
  offer: StaffOffer
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "staff"
  ) {
    throw new Error("Staff offers are only allowed during staff week")
  }

  const validation = validateStaffHire(league, teamId, staffId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const nextOffer = asContractOffer(league, {
    candidateType: "staff",
    candidateId: staffId,
    teamId,
    phase: "staff",
    offer,
  })

  return {
    ...league,
    contractOffers: [
      ...withdrawExistingUserOffer(league.contractOffers, nextOffer),
      nextOffer,
    ],
  }
}

function resolvePlayerOffers(
  league: LeagueRecord,
  candidateId: string,
  offers: ContractOffer[]
): LeagueRecord {
  const player = findPlayer(league, candidateId)
  if (!player || player.teamId) {
    return expireOffers(league, offers, "Player is no longer available")
  }

  const ranked = offers
    .map((offer) => ({
      offer,
      decision: evaluatePlayerContractOffer(league, player, offer),
    }))
    .sort((a, b) => b.decision.score - a.decision.score)
  const best = ranked[0]
  if (!best) {
    return league
  }

  if (best.decision.result !== "accept") {
    const nextLeague: LeagueRecord = {
      ...league,
      contractOffers: league.contractOffers.map((offer) => {
        const rankedOffer = ranked.find((entry) => entry.offer.id === offer.id)
        if (!rankedOffer || rankedOffer.decision.result === "wait") {
          return offer
        }
        return {
          ...offer,
          status: "declined" as const,
          resolvedDay: league.seasonState.currentDay,
          decisionReason: rankedOffer.decision.reason,
        }
      }),
    }
    return ranked.reduce((current, entry) => {
      if (entry.decision.result !== "decline") {
        return current
      }
      return withUpdatedPlayerNegotiation(current, entry.offer, false)
    }, nextLeague)
  }

  const validation = canSignPlayer(league, best.offer.teamId, candidateId, {
    years: best.offer.years,
    firstYearSalary: best.offer.firstYearSalary,
    signingException: best.offer.signingException,
  })
  if (!validation.ok) {
    return expireOffers(league, [best.offer], validation.reason)
  }

  const signed = signFreeAgent(league, best.offer.teamId, candidateId, {
    years: best.offer.years,
    firstYearSalary: best.offer.firstYearSalary,
    signingException: validation.signingException,
  })

  const withResolvedOffers: LeagueRecord = {
    ...signed,
    contractOffers: signed.contractOffers.map((offer) => {
      if (!offers.some((entry) => entry.id === offer.id)) {
        return offer
      }
      return {
        ...offer,
        status: offer.id === best.offer.id ? "accepted" : "expired",
        resolvedDay: signed.seasonState.currentDay,
        decisionReason:
          offer.id === best.offer.id
            ? best.decision.reason
            : "Candidate accepted another offer",
      }
    }),
  }
  return withUpdatedPlayerNegotiation(withResolvedOffers, best.offer, true)
}

function resolveStaffOffers(
  league: LeagueRecord,
  candidateId: string,
  offers: ContractOffer[]
): LeagueRecord {
  const staff = findStaffCandidate(league, candidateId)
  if (!staff || staff.teamId) {
    return expireOffers(league, offers, "Staff member is no longer available")
  }

  const ranked = offers
    .map((offer) => ({
      offer,
      decision: evaluateStaffContractOffer(league, staff, offer),
    }))
    .sort((a, b) => b.decision.score - a.decision.score)
  const best = ranked[0]
  if (!best) {
    return league
  }

  if (best.decision.result !== "accept") {
    return {
      ...league,
      contractOffers: league.contractOffers.map((offer) => {
        const rankedOffer = ranked.find((entry) => entry.offer.id === offer.id)
        if (!rankedOffer || rankedOffer.decision.result === "wait") {
          return offer
        }
        return {
          ...offer,
          status: "declined",
          resolvedDay: league.seasonState.currentDay,
          decisionReason: rankedOffer.decision.reason,
        }
      }),
    }
  }

  const result = hireStaff(league, best.offer.teamId, candidateId, {
    years: best.offer.years,
    firstYearSalary: best.offer.firstYearSalary,
  })
  if (!result.ok) {
    return expireOffers(league, [best.offer], result.reason)
  }

  return {
    ...result.league,
    contractOffers: result.league.contractOffers.map((offer) => {
      if (!offers.some((entry) => entry.id === offer.id)) {
        return offer
      }
      return {
        ...offer,
        status: offer.id === best.offer.id ? "accepted" : "expired",
        resolvedDay: result.league.seasonState.currentDay,
        decisionReason:
          offer.id === best.offer.id
            ? best.decision.reason
            : "Candidate accepted another offer",
      }
    }),
  }
}

function expireOffers(
  league: LeagueRecord,
  offers: ContractOffer[],
  reason: string
): LeagueRecord {
  const ids = new Set(offers.map((offer) => offer.id))
  return {
    ...league,
    contractOffers: league.contractOffers.map((offer) =>
      ids.has(offer.id)
        ? {
            ...offer,
            status: "expired",
            resolvedDay: league.seasonState.currentDay,
            decisionReason: reason,
          }
        : offer
    ),
  }
}

export function resolveContractMarketDay(
  league: LeagueRecord,
  phase: Exclude<ContractMarketPhase, "re_signing">
): LeagueRecord {
  const keys = new Set(
    league.contractOffers
      .filter((offer) => offer.phase === phase && offer.status === "pending")
      .map((offer) => `${offer.candidateType}:${offer.candidateId}`)
  )

  let current = league
  for (const key of keys) {
    const [candidateType, candidateId] = key.split(":") as [
      ContractOffer["candidateType"],
      string,
    ]
    const offers = current.contractOffers.filter(
      (offer) =>
        offer.phase === phase &&
        offer.status === "pending" &&
        offer.candidateType === candidateType &&
        offer.candidateId === candidateId
    )
    current =
      candidateType === "player"
        ? resolvePlayerOffers(current, candidateId, offers)
        : resolveStaffOffers(current, candidateId, offers)
  }

  return current
}

function getAiTeams(league: LeagueRecord): string[] {
  return league.seasonState.teams
    .map((team) => team.id)
    .filter((teamId) => teamId !== league.userTeamId)
}

function hasPendingTeamOffer(
  league: LeagueRecord,
  phase: ContractMarketPhase,
  candidateId: string,
  candidateType: ContractOffer["candidateType"],
  teamId: string
): boolean {
  return league.contractOffers.some(
    (offer) =>
      offer.status === "pending" &&
      offer.phase === phase &&
      offer.candidateId === candidateId &&
      offer.candidateType === candidateType &&
      offer.teamId === teamId
  )
}

export function generateAiStaffMarketOffers(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "staff"
  ) {
    return league
  }

  let current = league
  for (const teamId of getAiTeams(current)) {
    for (const role of STAFF_ROLES) {
      if (getStaffByRole(current.staff, teamId, role)) {
        continue
      }

      const pool = [...current.staff, ...current.collegeCoaches]
        .filter((staff) => staff.teamId === null && staff.role === role)
        .sort((a, b) => b.ratings.overall - a.ratings.overall)
        .slice(0, 6)
      const candidate = pool[rng.int(0, Math.max(0, pool.length - 1))]
      if (
        !candidate ||
        hasPendingTeamOffer(current, "staff", candidate.id, "staff", teamId)
      ) {
        continue
      }

      const market = getStaffContractMarketValue(candidate)
      const offer: StaffOffer = {
        years: rng.int(1, 3),
        firstYearSalary: roundMoney(
          market.expectedSalary * (0.9 + rng.next() * 0.25)
        ),
      }
      const validation = validateStaffHire(current, teamId, candidate.id, offer)
      if (!validation.ok) {
        continue
      }
      current = submitStaffContractOffer(current, teamId, candidate.id, offer)
    }
  }

  return current
}

export function generateAiFreeAgencyMarketOffers(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "free_agency"
  ) {
    return league
  }

  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.leagueFinancials.currentCapSeason
  )

  for (const teamFinance of current.teamFinancials) {
    if (teamFinance.teamId === current.userTeamId) {
      continue
    }

    const candidates = getExternalFreeAgents(current, teamFinance.teamId)
      .sort(
        (a, b) =>
          getProjectedPlayerValue(b, { league: current }) -
          getProjectedPlayerValue(a, { league: current })
      )
      .slice(0, 12)
    const player = candidates[rng.int(0, Math.max(0, candidates.length - 1))]
    if (
      !player ||
      hasPendingTeamOffer(
        current,
        "free_agency",
        player.id,
        "player",
        teamFinance.teamId
      )
    ) {
      continue
    }

    const offer = buildExternalFaOffer(
      player,
      teamFinance,
      seasonFinancials,
      rng
    )
    const position = getTeamFinancialPosition(
      current,
      teamFinance.teamId,
      seasonFinancials.season
    )
    if (
      !canAffordOffer(
        teamFinance,
        position.taxPayroll,
        offer.firstYearSalary,
        seasonFinancials
      )
    ) {
      continue
    }
    const validation = canSignPlayer(
      current,
      teamFinance.teamId,
      player.id,
      offer
    )
    if (!validation.ok) {
      continue
    }

    current = submitPlayerContractOffer(
      current,
      teamFinance.teamId,
      player.id,
      {
        ...offer,
        signingException: validation.signingException,
      }
    )
  }

  return current
}

export function processAiReSigningOffers(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.leagueFinancials.currentCapSeason
  )

  for (const teamId of getAiTeams(current)) {
    const teamFinance = current.teamFinancials.find(
      (entry) => entry.teamId === teamId
    )
    if (!teamFinance) {
      continue
    }
    const candidates = getTeamExpiredFreeAgents(current, teamId).sort(
      (a, b) =>
        getProjectedPlayerValue(b, { league: current }) -
        getProjectedPlayerValue(a, { league: current })
    )
    for (const player of candidates.slice(0, 4)) {
      const priorSalary = getPriorContractSalary(current.contracts, player)
      const market = getPlayerContractMarketValue(current, player)
      const offer = buildReSignOffer(
        player,
        teamFinance,
        seasonFinancials,
        priorSalary,
        rng
      )
      offer.firstYearSalary = Math.max(offer.firstYearSalary, market.lowSalary)
      try {
        current = submitPlayerContractOffer(current, teamId, player.id, offer)
      } catch {
        // Skip invalid AI offers.
      }
    }
  }

  return current
}

export function advanceFreeAgencyMarketDay(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "free_agency"
  ) {
    throw new Error(
      "Free-agency market days can only advance during free agency"
    )
  }

  const resolved = resolveContractMarketDay(league, "free_agency")
  const advanced: LeagueRecord = {
    ...resolved,
    seasonState: {
      ...resolved.seasonState,
      currentDay: resolved.seasonState.currentDay + 1,
    },
  }
  return generateAiFreeAgencyMarketOffers(advanced, rng)
}

export function fillAiRostersAfterFreeAgency(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.leagueFinancials.currentCapSeason
  )

  for (const teamFinance of current.teamFinancials) {
    if (teamFinance.teamId === current.userTeamId) {
      continue
    }

    const skipped = new Set<string>()
    while (true) {
      const team = current.seasonState.teams.find(
        (entry) => entry.id === teamFinance.teamId
      )
      if (!team || team.players.length >= ROSTER_MAX) {
        break
      }

      const candidate = getExternalFreeAgents(current, teamFinance.teamId)
        .filter((player) => !skipped.has(player.id))
        .sort((a, b) => b.ratings.overall - a.ratings.overall)[0]
      if (!candidate) {
        break
      }

      let offer = buildExternalFaOffer(
        candidate,
        teamFinance,
        seasonFinancials,
        rng
      )
      let validation = canSignPlayer(
        current,
        teamFinance.teamId,
        candidate.id,
        offer
      )
      if (!validation.ok) {
        offer = {
          years: 1,
          firstYearSalary: calculateMinSalary(
            seasonFinancials,
            candidate.yearsOfService
          ),
        }
        validation = canSignPlayer(
          current,
          teamFinance.teamId,
          candidate.id,
          offer
        )
        if (!validation.ok) {
          skipped.add(candidate.id)
          continue
        }
      }

      try {
        current = signFreeAgent(current, teamFinance.teamId, candidate.id, {
          ...offer,
          signingException: validation.signingException,
        })
      } catch {
        skipped.add(candidate.id)
      }
    }
  }

  return current
}
