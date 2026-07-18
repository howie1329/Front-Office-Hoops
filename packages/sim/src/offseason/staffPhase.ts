import {
  COLLEGE_PROMOTION_THRESHOLD,
  STAFF_MINIMUM_SALARY,
  STAFF_RATING_MAX,
} from "@workspace/shared/constants"
import type {
  LeagueRecord,
  Rng,
  StaffMember,
  StaffRole,
} from "@workspace/shared/types"

import {
  generateAiStaffMarketOffers,
  resolveContractMarketDay,
} from "../contracts/offerMarket"
import { getCurrentCalendar } from "../calendar"
import { getStaffContractMarketValue } from "../contracts/marketValue"
import {
  STAFF_ROLES,
  syncLeagueStaffFinancials,
} from "../staff/deriveTeamStaff"
import {
  getStaffEmploymentSeason,
  getVacantStaffRoles,
  reconcileStaffEmployment,
} from "../staff/employmentLifecycle"
import { commitStaffHire } from "../staff/hireStaff"

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

export function processAiStaffMoves(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  const { collegeCoaches, promoted } = progressCollegeCoaches(
    league.collegeCoaches
  )
  return generateAiStaffMarketOffers(
    {
      ...league,
      collegeCoaches,
      staff: [...league.staff, ...promoted],
    },
    rng
  )
}

export function advanceToReSigningPhase(
  state: LeagueRecord["seasonState"]
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
  rng: Rng
): LeagueRecord {
  void rng
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Staff phase can only be completed during the offseason")
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    throw new Error("Staff phase is not active")
  }
  if (
    league.userTeamId &&
    getVacantStaffRoles(league, league.userTeamId).length > 0
  ) {
    throw new Error("Fill all staff roles before continuing")
  }

  const withResolvedOffers = resolveContractMarketDay(league, "staff")
  return finalizeStaffPhase(withResolvedOffers, false)
}

export function completeStaffPhaseAtDeadline(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  void rng
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Staff phase can only be completed during the offseason")
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    throw new Error("Staff phase is not active")
  }

  if (
    league.seasonState.currentDay <
    getCurrentCalendar(league.seasonState).milestones.staffPhaseEndDay
  ) {
    throw new Error("Staff phase deadline has not been reached")
  }

  const withResolvedOffers = resolveContractMarketDay(league, "staff")
  return finalizeStaffPhase(withResolvedOffers, true)
}

export function advanceStaffMarketDay(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "staff"
  ) {
    throw new Error("Staff market days can only advance during staff week")
  }

  const deadline = getCurrentCalendar(league.seasonState).milestones
    .staffPhaseEndDay
  if (league.seasonState.currentDay >= deadline) {
    return completeStaffPhaseAtDeadline(league, rng)
  }

  const resolved = resolveContractMarketDay(league, "staff")
  const nextDay = resolved.seasonState.currentDay + 1
  const advanced: LeagueRecord = {
    ...resolved,
    seasonState: {
      ...resolved.seasonState,
      currentDay: nextDay,
    },
  }
  if (nextDay >= deadline) {
    return finalizeStaffPhase(advanced, true)
  }

  return syncLeagueStaffFinancials(generateAiStaffMarketOffers(advanced, rng))
}

export function beginStaffMarket(league: LeagueRecord, rng: Rng): LeagueRecord {
  return processAiStaffMoves(reconcileStaffEmployment(league), rng)
}

function emergencyStaffMember(
  league: LeagueRecord,
  teamId: string,
  role: StaffRole
): StaffMember {
  const season = getStaffEmploymentSeason(league)
  const id = `staff_emergency_${season}_${teamId}_${role}`
  return {
    id,
    firstName: "Interim",
    lastName: "Coach",
    role,
    teamId: null,
    source: "market",
    ratings: {
      overall: 3,
      offense: role === "offensive_coordinator" ? 4 : 3,
      defense: role === "defensive_coordinator" ? 4 : 3,
      scouting: role === "scouting_head" ? 4 : 3,
      development: 3,
    },
    preferredOffense: "balanced",
    preferredDefense: "drop_coverage",
    ...(role === "head_coach"
      ? { pace: "balanced" as const, rotation: "standard" as const }
      : {}),
  }
}

function expireCompetingStaffOffers(
  league: LeagueRecord,
  staffId: string
): LeagueRecord {
  return {
    ...league,
    contractOffers: league.contractOffers.map((offer) =>
      offer.phase === "staff" &&
      offer.candidateType === "staff" &&
      offer.candidateId === staffId &&
      offer.status === "pending"
        ? {
            ...offer,
            status: "expired" as const,
            resolvedDay: league.seasonState.currentDay,
            decisionReason: "Candidate accepted an emergency staff position",
          }
        : offer
    ),
  }
}

function fillUserStaffVacancies(league: LeagueRecord): LeagueRecord {
  if (!league.userTeamId) {
    return league
  }

  let current = league
  for (const role of getVacantStaffRoles(current, league.userTeamId)) {
    const candidate = emergencyStaffMember(current, league.userTeamId, role)
    current = {
      ...current,
      staff: [...current.staff, candidate],
    }
    current = commitStaffHire(current, league.userTeamId, candidate.id, {
      years: 1,
      firstYearSalary: STAFF_MINIMUM_SALARY,
    })
    current = expireCompetingStaffOffers(current, candidate.id)
  }

  return current
}

function finalizeStaffPhase(
  league: LeagueRecord,
  fillUserVacancies: boolean
): LeagueRecord {
  const withUserStaff = fillUserVacancies
    ? fillUserStaffVacancies(league)
    : league
  const withCompleteAiStaff = fillAiStaffVacancies(withUserStaff)

  return {
    ...withCompleteAiStaff,
    seasonState: advanceToReSigningPhase(withCompleteAiStaff.seasonState),
  }
}

function fillAiStaffVacancies(league: LeagueRecord): LeagueRecord {
  let current = league

  for (const team of current.seasonState.teams) {
    if (team.id === current.userTeamId) {
      continue
    }

    for (const role of STAFF_ROLES) {
      if (!getVacantStaffRoles(current, team.id).includes(role)) {
        continue
      }

      let candidate = current.staff
        .filter((member) => member.teamId === null && member.role === role)
        .sort(
          (left, right) =>
            right.ratings.overall - left.ratings.overall ||
            left.id.localeCompare(right.id)
        )[0]

      if (!candidate) {
        candidate = emergencyStaffMember(current, team.id, role)
        current = { ...current, staff: [...current.staff, candidate] }
      }

      const market = getStaffContractMarketValue(candidate)
      current = commitStaffHire(current, team.id, candidate.id, {
        years: 1,
        firstYearSalary: market.expectedSalary,
      })
      current = expireCompetingStaffOffers(current, candidate.id)
    }
  }

  const missingRoles = current.seasonState.teams.flatMap((team) =>
    getVacantStaffRoles(current, team.id).map((role) => `${team.id}:${role}`)
  )
  if (missingRoles.length > 0) {
    throw new Error(`Staff vacancies remain: ${missingRoles.join(", ")}`)
  }

  return syncLeagueStaffFinancials(current)
}
