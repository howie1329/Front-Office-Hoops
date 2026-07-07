import { COLLEGE_PROMOTION_THRESHOLD, STAFF_RATING_MAX } from "@workspace/shared/constants"
import type { LeagueRecord, Rng, StaffMember, StaffOffer, StaffRole } from "@workspace/shared/types"

import { hireStaff } from "../staff/hireStaff"
import { getStaffByRole, STAFF_ROLES, syncLeagueStaffFinancials } from "../staff/deriveTeamStaff"
import { getStaffPayroll } from "../staff/staffPayroll"
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

function cheapestOfferForCoach(coach: StaffMember): StaffOffer {
  const base = 0.5 + coach.ratings.overall * 0.15
  return {
    years: 1,
    firstYearSalary: Math.round(base * 10) / 10,
  }
}

function pickCandidateForRole(
  league: LeagueRecord,
  role: StaffRole,
  rng: Rng,
): StaffMember | undefined {
  const market = league.staff.filter(
    (entry) => entry.teamId === null && entry.role === role,
  )
  const college = league.collegeCoaches.filter(
    (entry) =>
      entry.role === role && entry.ratings.overall >= COLLEGE_PROMOTION_THRESHOLD,
  )

  const pool = [...market, ...college]
  if (pool.length === 0) {
    return undefined
  }

  pool.sort((a, b) => b.ratings.overall - a.ratings.overall)
  const top = pool.slice(0, Math.min(5, pool.length))
  return top[rng.int(0, top.length - 1)]
}

export function processAiStaffMoves(league: LeagueRecord, rng: Rng): LeagueRecord {
  let current = league

  const { collegeCoaches, promoted } = progressCollegeCoaches(current.collegeCoaches)
  current = {
    ...current,
    collegeCoaches,
    staff: [...current.staff, ...promoted],
  }

  for (const team of current.seasonState.teams) {
    if (team.id === current.userTeamId) {
      continue
    }

    for (const role of STAFF_ROLES) {
      if (getStaffByRole(current.staff, team.id, role)) {
        continue
      }

      const candidate = pickCandidateForRole(current, role, rng)
      if (!candidate) {
        continue
      }

      const teamFinance = current.teamFinancials.find(
        (entry) => entry.teamId === team.id,
      )
      if (!teamFinance) {
        continue
      }

      const offer = cheapestOfferForCoach(candidate)
      const payroll = getStaffPayroll(
        team.id,
        current.staffContracts,
        current.seasonState.season,
      )
      const offerTotal = offer.firstYearSalary

      if (payroll + offerTotal > teamFinance.staffBudget) {
        continue
      }

      const result = hireStaff(current, team.id, candidate.id, offer)
      if (result.ok) {
        current = result.league
      }
    }
  }

  return syncLeagueStaffFinancials(current)
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
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Staff phase can only be completed during the offseason")
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    throw new Error("Staff phase is not active")
  }

  const withResolvedOffers = resolveContractMarketDay(league, "staff")
  const withAiMoves = processAiStaffMoves(withResolvedOffers, rng)

  return {
    ...withAiMoves,
    seasonState: advanceToReSigningPhase(withAiMoves.seasonState),
  }
}

export function beginStaffMarket(league: LeagueRecord, rng: Rng): LeagueRecord {
  return generateAiStaffMarketOffers(league, rng)
}
