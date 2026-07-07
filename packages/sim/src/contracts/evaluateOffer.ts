import type {
  ContractMarketPhase,
  ContractOffer,
  LeagueRecord,
  Player,
  StaffMember,
} from "@workspace/shared/types"

import {
  getPlayerContractMarketValue,
  getStaffContractMarketValue,
} from "./marketValue"
import { getExtensionBounds } from "../financials/contractExtensions"

export type ContractOfferDecision = {
  result: "accept" | "wait" | "decline"
  score: number
  reason: string
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

function playerFitScore(
  league: LeagueRecord,
  player: Player,
  offer: ContractOffer,
): number {
  const isCurrentTeam =
    player.teamId === offer.teamId ||
    league.contracts.some(
      (contract) =>
        contract.playerId === player.id &&
        contract.teamId === offer.teamId &&
        contract.status === "expired",
    )

  return isCurrentTeam ? 8 : 0
}

function timingScore(phase: ContractMarketPhase, currentDay: number): number {
  if (phase === "re_signing" || phase === "extension") {
    return 8
  }
  return clamp(currentDay * 1.5, 0, 10)
}

export function evaluatePlayerContractOffer(
  league: LeagueRecord,
  player: Player,
  offer: ContractOffer,
): ContractOfferDecision {
  const market = getPlayerContractMarketValue(league, player)
  const expectedSalary =
    offer.phase === "extension"
      ? Math.min(
          market.expectedSalary,
          getExtensionBounds(league, player.id)?.maxSalary ?? market.expectedSalary,
        )
      : market.expectedSalary
  const salaryRatio = expectedSalary > 0
    ? offer.firstYearSalary / expectedSalary
    : 1
  const score = clamp(
    salaryRatio * 70 +
      yearsScore(offer.years) +
      playerFitScore(league, player, offer) +
      timingScore(offer.phase, league.seasonState.currentDay),
    0,
    110,
  )

  if (offer.phase === "re_signing" || offer.phase === "extension") {
    return score >= 78
      ? { result: "accept", score, reason: "Offer met player expectations" }
      : { result: "decline", score, reason: "Offer below player expectations" }
  }

  if (score >= 90) {
    return { result: "accept", score, reason: "Offer was strong enough to accept" }
  }
  if (score >= 68) {
    return { result: "wait", score, reason: "Candidate is waiting for the market" }
  }
  return { result: "decline", score, reason: "Offer was not competitive" }
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
  const score = clamp(
    salaryRatio * 76 + yearsScore(offer.years) + timingScore(offer.phase, league.seasonState.currentDay),
    0,
    110,
  )

  if (score >= 90) {
    return { result: "accept", score, reason: "Offer was strong enough to accept" }
  }
  if (score >= 68) {
    return { result: "wait", score, reason: "Candidate is waiting for the market" }
  }
  return { result: "decline", score, reason: "Offer was not competitive" }
}
