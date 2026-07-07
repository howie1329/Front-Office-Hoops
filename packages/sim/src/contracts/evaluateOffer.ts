import type {
  ContractMarketPhase,
  ContractOffer,
  LeagueRecord,
  Player,
  PlayerMood,
  StaffMember,
} from "@workspace/shared/types"
import type { MarketTier, TeamMode } from "@workspace/shared/financialTypes"

import {
  getPlayerContractMarketValue,
  getStaffContractMarketValue,
} from "./marketValue"
import { getExtensionBounds } from "../financials/contractExtensions"
import { DEFAULT_PLAYER_MOOD } from "../playerValue/moodSeed"

export type ContractOfferDecision = {
  result: "accept" | "wait" | "decline"
  score: number
  reason: string
  breakdown: ContractOfferBreakdown
}

export type ContractOfferBreakdown = {
  salary: number
  years: number
  loyalty: number
  winning: number
  market: number
  role: number
  timing: number
}

type OfferTeamContext = {
  teamId: string
  marketTier: MarketTier
  teamMode: TeamMode
  teamOverall: number
  wins: number
  rosterRank: number | null
  isCurrentTeam: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function yearsScore(years: number): number {
  if (years >= 3) {
    return 10
  }
  if (years === 2) {
    return 6
  }
  return 2
}

function getOfferTeamContext(
  league: LeagueRecord,
  player: Player,
  offer: ContractOffer,
): OfferTeamContext {
  const team = league.seasonState.teams.find((entry) => entry.id === offer.teamId)
  const teamFinance = league.teamFinancials.find(
    (entry) => entry.teamId === offer.teamId,
  )
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === offer.teamId,
  )
  const isCurrentTeam =
    player.teamId === offer.teamId ||
    league.contracts.some(
      (contract) =>
        contract.playerId === player.id &&
        contract.teamId === offer.teamId &&
        contract.status === "expired",
    )

  const rosterRank = team
    ? [...team.players, player]
        .sort((a, b) => b.ratings.overall - a.ratings.overall)
        .findIndex((entry) => entry.id === player.id) + 1
    : null

  return {
    teamId: offer.teamId,
    marketTier: teamFinance?.spendingProfile.marketTier ?? "mid",
    teamMode: teamFinance?.strategy.mode ?? "buying",
    teamOverall: team?.overall ?? 50,
    wins: standing?.wins ?? Math.round((team?.overall ?? 50) * 0.65),
    rosterRank: rosterRank && rosterRank > 0 ? rosterRank : null,
    isCurrentTeam,
  }
}

function timingScore(phase: ContractMarketPhase, currentDay: number): number {
  if (phase === "re_signing" || phase === "extension") {
    return 8
  }
  return clamp(currentDay * 1.5, 0, 10)
}

function salaryScore(
  offerSalary: number,
  expectedSalary: number,
  mood: PlayerMood,
): number {
  const moneyPressure = 1 + (mood.money - 50) / 250
  const adjustedExpectation = Math.max(0.1, expectedSalary * moneyPressure)
  const ratio = offerSalary / adjustedExpectation
  const moneyWeight = 1 + (mood.money - 50) / 500
  return clamp(ratio * 70 * moneyWeight, 0, 76)
}

function loyaltyScore(
  mood: PlayerMood,
  context: OfferTeamContext,
  phase: ContractMarketPhase,
): number {
  if (!context.isCurrentTeam) {
    return phase === "free_agency" ? clamp((50 - mood.loyalty) * 0.04, -2, 2) : 0
  }

  const phaseWeight = phase === "extension" ? 0.12 : 0.16
  return clamp((mood.loyalty - 50) * phaseWeight + 4, -4, 10)
}

function winningScore(mood: PlayerMood, context: OfferTeamContext): number {
  const modeBonus =
    context.teamMode === "contending"
      ? 2
      : context.teamMode === "selling"
        ? -2
        : 0
  const quality = (context.teamOverall - 72) * 0.12 + (context.wins - 42) * 0.08 + modeBonus
  return clamp(quality * ((mood.winning - 50) / 35), -6, 8)
}

function marketScore(mood: PlayerMood, context: OfferTeamContext): number {
  const marketValue =
    context.marketTier === "large" ? 1 : context.marketTier === "small" ? -1 : 0
  return clamp(marketValue * ((mood.fame - 50) / 10), -4, 5)
}

function roleScore(mood: PlayerMood, context: OfferTeamContext): number {
  if (!context.rosterRank) {
    return 0
  }

  const roleValue =
    context.rosterRank <= 2
      ? 1.2
      : context.rosterRank <= 5
        ? 0.5
        : -0.8
  const roleDrive = (mood.fame + mood.winning) / 2
  return clamp(roleValue * ((roleDrive - 50) / 8), -6, 8)
}

function offerDecisionFromScore(
  offer: ContractOffer,
  score: number,
  breakdown: ContractOfferBreakdown,
): ContractOfferDecision {
  if (offer.phase === "re_signing" || offer.phase === "extension") {
    return score >= 78
      ? { result: "accept", score, reason: "Offer met player expectations", breakdown }
      : { result: "decline", score, reason: "Offer below player expectations", breakdown }
  }

  if (score >= 90) {
    return { result: "accept", score, reason: "Offer was strong enough to accept", breakdown }
  }
  if (score >= 68) {
    return { result: "wait", score, reason: "Candidate is waiting for the market", breakdown }
  }
  return { result: "decline", score, reason: "Offer was not competitive", breakdown }
}

export function evaluatePlayerContractOffer(
  league: LeagueRecord,
  player: Player,
  offer: ContractOffer,
): ContractOfferDecision {
  const mood = player.mood ?? DEFAULT_PLAYER_MOOD
  const context = getOfferTeamContext(league, player, offer)
  const market = getPlayerContractMarketValue(league, player)
  const expectedSalary =
    offer.phase === "extension"
      ? Math.min(
          market.expectedSalary,
          getExtensionBounds(league, player.id)?.maxSalary ?? market.expectedSalary,
        )
      : market.expectedSalary
  const breakdown: ContractOfferBreakdown = {
    salary: salaryScore(offer.firstYearSalary, expectedSalary, mood),
    years: yearsScore(offer.years),
    loyalty: loyaltyScore(mood, context, offer.phase),
    winning: winningScore(mood, context),
    market: marketScore(mood, context),
    role: roleScore(mood, context),
    timing: timingScore(offer.phase, league.seasonState.currentDay),
  }
  const score = clamp(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    0,
    115,
  )

  return offerDecisionFromScore(offer, score, breakdown)
}

export function evaluateStaffContractOffer(
  league: LeagueRecord,
  staff: StaffMember,
  offer: ContractOffer,
): ContractOfferDecision {
  const market = getStaffContractMarketValue(staff)
  const salaryRatio = market.expectedSalary > 0
    ? offer.firstYearSalary / market.expectedSalary
    : 1
  const breakdown: ContractOfferBreakdown = {
    salary: clamp(salaryRatio * 76, 0, 76),
    years: yearsScore(offer.years),
    loyalty: 0,
    winning: 0,
    market: 0,
    role: 0,
    timing: timingScore(offer.phase, league.seasonState.currentDay),
  }
  const score = clamp(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 0, 110)

  if (score >= 90) {
    return { result: "accept", score, reason: "Offer was strong enough to accept", breakdown }
  }
  if (score >= 68) {
    return { result: "wait", score, reason: "Candidate is waiting for the market", breakdown }
  }
  return { result: "decline", score, reason: "Offer was not competitive", breakdown }
}
