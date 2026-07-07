import { COLLEGE_PROMOTION_THRESHOLD, STAFF_RATING_MAX } from "@workspace/shared/constants"
import type { LeagueRecord, Rng, StaffMember } from "@workspace/shared/types"

import { generateAiStaffMarketOffers, resolveContractMarketDay } from "../contracts/offerMarket"

function clampRating(value: number): number {
  return Math.max(1, Math.min(STAFF_RATING_MAX, Math.round(value)))
}

export function progressCollegeCoaches(collegeCoaches: StaffMember[]): {
  collegeCoaches: StaffMember[]
  promoted: StaffMember[]
} {
  const remaining: StaffMember[] = []
  const promoted: StaffMember[] = []

  for (const coach of collegeCoaches) {
    const seasonsInCollege = (coach.seasonsInCollege ?? 0) + 1
    const growth = (coach.potential ?? 6) > coach.ratings.overall ? 1 : 0
    const nextOverall = clampRating(coach.ratings.overall + growth)
    const updated: StaffMember = {
      ...coach,
      seasonsInCollege,
      ratings: {
        ...coach.ratings,
        overall: nextOverall,
        offense: clampRating(coach.ratings.offense + (growth ? 1 : 0)),
        defense: clampRating(coach.ratings.defense + (growth ? 1 : 0)),
        scouting: clampRating(coach.ratings.scouting + (growth ? 1 : 0)),
        development: clampRating(coach.ratings.development + (growth ? 1 : 0)),
      },
    }

    if (updated.ratings.overall >= COLLEGE_PROMOTION_THRESHOLD) {
      promoted.push({
        ...updated,
        source: "market",
        teamId: null,
      })
    } else {
      remaining.push(updated)
    }
  }

  return { collegeCoaches: remaining, promoted }
}

export function processAiStaffMoves(league: LeagueRecord, rng: Rng): LeagueRecord {
  const { collegeCoaches, promoted } = progressCollegeCoaches(league.collegeCoaches)
  return generateAiStaffMarketOffers({
    ...league,
    collegeCoaches,
    staff: [...league.staff, ...promoted],
  }, rng)
}

export function advanceToReSigningPhase(
  state: LeagueRecord["seasonState"],
): LeagueRecord["seasonState"] {
  if (state.phase !== "offseason") {
    throw new Error("Re-signing phase can only start during the offseason")
  }

  if ((state.offseasonPhase ?? "staff") !== "staff") {
    throw new Error("Re-signing phase can only follow the staff phase")
  }

  return {
    ...state,
    offseasonPhase: "re_signing",
  }
}

export function completeStaffPhase(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  void rng
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Staff phase can only be completed during the offseason")
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    throw new Error("Staff phase is not active")
  }

  const withResolvedOffers = resolveContractMarketDay(league, "staff")

  return {
    ...withResolvedOffers,
    seasonState: advanceToReSigningPhase(withResolvedOffers.seasonState),
  }
}

export function beginStaffMarket(league: LeagueRecord, rng: Rng): LeagueRecord {
  return processAiStaffMoves(league, rng)
}
