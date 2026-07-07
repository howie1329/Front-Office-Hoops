import {
  COLLEGE_COACH_POOL_SIZE,
  COLLEGE_PROMOTION_THRESHOLD,
  MARKET_COACH_POOL_SIZE,
  STAFF_RATING_MAX,
  STAFF_RATING_MIN,
} from "@workspace/shared/constants"
import type { StaffContract } from "@workspace/shared/types"
import type {
  LeagueRecord,
  Rng,
  StaffMember,
  StaffRatings,
  StaffRole,
  TeamWithRoster,
} from "@workspace/shared/types"

import { FIRST_NAMES, LAST_NAMES } from "../namePools"
import { staffBudgetForOwner } from "./staffBudget"
import {
  COACHING_PACES,
  COACHING_ROTATIONS,
  DEFENSIVE_SCHEMES,
  OFFENSIVE_SCHEMES,
  pickRandomScheme,
  STAFF_ROLES,
  syncLeagueStaffFinancials,
} from "./deriveTeamStaff"
import { getStaffPayroll } from "./staffPayroll"

type StaffTier = "elite" | "mid" | "poor"

function clampStaffRating(value: number): number {
  return Math.max(STAFF_RATING_MIN, Math.min(STAFF_RATING_MAX, Math.round(value)))
}

function ratingForTier(tier: StaffTier, rng: Rng): number {
  switch (tier) {
    case "elite":
      return clampStaffRating(rng.int(8, 10))
    case "mid":
      return clampStaffRating(rng.int(5, 7))
    case "poor":
      return clampStaffRating(rng.int(2, 4))
  }
}

function salaryForTier(tier: StaffTier, rng: Rng): number {
  switch (tier) {
    case "elite":
      return Math.round((2 + rng.next() * 1.5) * 10) / 10
    case "mid":
      return Math.round((1 + rng.next() * 1) * 10) / 10
    case "poor":
      return Math.round((0.4 + rng.next() * 0.6) * 10) / 10
  }
}

function buildTierQueue(teamCount: number, rng: Rng): StaffTier[] {
  const slots = teamCount * STAFF_ROLES.length
  const eliteCount = Math.round(slots * 0.15)
  const poorCount = Math.round(slots * 0.3)
  const midCount = slots - eliteCount - poorCount

  const tiers: StaffTier[] = [
    ...Array.from({ length: eliteCount }, () => "elite" as const),
    ...Array.from({ length: midCount }, () => "mid" as const),
    ...Array.from({ length: poorCount }, () => "poor" as const),
  ]

  for (let index = tiers.length - 1; index > 0; index--) {
    const swapIndex = rng.int(0, index)
    const current = tiers[index]!
    tiers[index] = tiers[swapIndex]!
    tiers[swapIndex] = current
  }

  return tiers
}

function pickName(used: Set<string>, rng: Rng): { firstName: string; lastName: string } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const firstName = FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]!
    const lastName = LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]!
    const key = `${firstName}:${lastName}`
    if (!used.has(key)) {
      used.add(key)
      return { firstName, lastName }
    }
  }

  const firstName = FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]!
  const lastName = `${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}-${rng.int(1, 99)}`
  return { firstName, lastName }
}

function buildRatingsForRole(
  role: StaffRole,
  overall: number,
  rng: Rng,
): StaffRatings {
  const jitter = () => clampStaffRating(overall + rng.int(-1, 1))

  switch (role) {
    case "head_coach":
      return {
        overall,
        offense: jitter(),
        defense: jitter(),
        scouting: jitter(),
        development: jitter(),
      }
    case "offensive_coordinator":
      return {
        overall: jitter(),
        offense: clampStaffRating(overall + rng.int(0, 1)),
        defense: jitter(),
        scouting: jitter(),
        development: jitter(),
      }
    case "defensive_coordinator":
      return {
        overall: jitter(),
        offense: jitter(),
        defense: clampStaffRating(overall + rng.int(0, 1)),
        scouting: jitter(),
        development: jitter(),
      }
    case "scouting_head":
      return {
        overall: jitter(),
        offense: jitter(),
        defense: jitter(),
        scouting: clampStaffRating(overall + rng.int(0, 1)),
        development: jitter(),
      }
  }
}

function createStaffMember({
  role,
  tier,
  teamId,
  source,
  rng,
  usedNames,
  idSuffix,
}: {
  role: StaffRole
  tier: StaffTier
  teamId: string | null
  source: StaffMember["source"]
  rng: Rng
  usedNames: Set<string>
  idSuffix: string
}): StaffMember {
  const { firstName, lastName } = pickName(usedNames, rng)
  const overall = ratingForTier(tier, rng)
  const preferredOffense = pickRandomScheme(OFFENSIVE_SCHEMES, rng)
  const preferredDefense = pickRandomScheme(DEFENSIVE_SCHEMES, rng)

  const member: StaffMember = {
    id: `staff_${idSuffix}`,
    firstName,
    lastName,
    role,
    teamId,
    source,
    ratings: buildRatingsForRole(role, overall, rng),
    preferredOffense,
    preferredDefense,
  }

  if (role === "head_coach") {
    member.pace = pickRandomScheme(COACHING_PACES, rng)
    member.rotation = pickRandomScheme(COACHING_ROTATIONS, rng)
  }

  return member
}

function createStaffContract(
  staffId: string,
  teamId: string,
  tier: StaffTier,
  season: number,
  rng: Rng,
  contractIndex: number,
): StaffContract {
  const years = rng.int(1, 3)
  const firstYearSalary = salaryForTier(tier, rng)
  const yearlySalaries = Array.from({ length: years }, (_, index) =>
    Math.round(firstYearSalary * (1 + index * 0.05) * 10) / 10,
  )

  return {
    id: `staff_contract_${contractIndex}`,
    staffId,
    teamId,
    startSeason: season,
    endSeason: season + years - 1,
    yearlySalaries,
    status: "active",
    signedSeason: season,
  }
}

function generateEmployedStaff(
  teams: TeamWithRoster[],
  rng: Rng,
): { staff: StaffMember[]; staffContracts: StaffContract[] } {
  const tiers = buildTierQueue(teams.length, rng)
  const usedNames = new Set<string>()
  const staff: StaffMember[] = []
  const staffContracts: StaffContract[] = []
  let tierIndex = 0
  let contractIndex = 0

  for (const team of teams) {
    for (const role of STAFF_ROLES) {
      const tier = tiers[tierIndex]!
      tierIndex += 1
      const idSuffix = `${team.id}_${role}`
      const member = createStaffMember({
        role,
        tier,
        teamId: team.id,
        source: "employed",
        rng,
        usedNames,
        idSuffix,
      })
      staff.push(member)
      staffContracts.push(
        createStaffContract(
          member.id,
          team.id,
          tier,
          1,
          rng,
          contractIndex++,
        ),
      )
    }
  }

  return { staff, staffContracts }
}

function generateMarketPool(
  rng: Rng,
  usedNames: Set<string>,
  startIndex: number,
): StaffMember[] {
  const coaches: StaffMember[] = []

  for (let index = 0; index < MARKET_COACH_POOL_SIZE; index++) {
    const role = STAFF_ROLES[rng.int(0, STAFF_ROLES.length - 1)]!
    const tierRoll = rng.next()
    const tier: StaffTier =
      tierRoll < 0.15 ? "elite" : tierRoll < 0.7 ? "mid" : "poor"

    coaches.push(
      createStaffMember({
        role,
        tier,
        teamId: null,
        source: "market",
        rng,
        usedNames,
        idSuffix: `market_${startIndex + index}`,
      }),
    )
  }

  return coaches
}

function generateCollegePool(
  rng: Rng,
  usedNames: Set<string>,
  startIndex: number,
): StaffMember[] {
  const coaches: StaffMember[] = []

  for (let index = 0; index < COLLEGE_COACH_POOL_SIZE; index++) {
    const role = STAFF_ROLES[rng.int(0, STAFF_ROLES.length - 1)]!
    const overall = clampStaffRating(rng.int(2, 5))
    const potential = clampStaffRating(rng.int(6, 9))
    const { firstName, lastName } = pickName(usedNames, rng)

    const member: StaffMember = {
      id: `college_staff_${startIndex + index}`,
      firstName,
      lastName,
      role,
      teamId: null,
      source: "college",
      ratings: buildRatingsForRole(role, overall, rng),
      preferredOffense: pickRandomScheme(OFFENSIVE_SCHEMES, rng),
      preferredDefense: pickRandomScheme(DEFENSIVE_SCHEMES, rng),
      potential,
      seasonsInCollege: 0,
    }

    if (role === "head_coach") {
      member.pace = pickRandomScheme(COACHING_PACES, rng)
      member.rotation = pickRandomScheme(COACHING_ROTATIONS, rng)
    }

    coaches.push(member)
  }

  return coaches
}

export function generateLeagueStaffForTeams(
  teams: TeamWithRoster[],
  rng: Rng,
): {
  staff: StaffMember[]
  staffContracts: StaffContract[]
  collegeCoaches: StaffMember[]
} {
  const usedNames = new Set<string>()
  const employed = generateEmployedStaff(teams, rng)
  const market = generateMarketPool(rng, usedNames, employed.staff.length)
  const collegeCoaches = generateCollegePool(
    rng,
    usedNames,
    employed.staff.length + market.length,
  )

  return {
    staff: [...employed.staff, ...market],
    staffContracts: employed.staffContracts,
    collegeCoaches,
  }
}

export function applyStaffBudgetsFromOwners(
  league: LeagueRecord,
): LeagueRecord {
  const teamFinancials = league.teamFinancials.map((teamFinance) => {
    const owner = league.owners.find((entry) => entry.teamId === teamFinance.teamId)
    return {
      ...teamFinance,
      staffBudget: staffBudgetForOwner(owner),
      staffPayroll: getStaffPayroll(
        teamFinance.teamId,
        league.staffContracts,
        league.seasonState.season,
      ),
    }
  })

  return syncLeagueStaffFinancials({
    ...league,
    teamFinancials,
  })
}

export function initializeStaffForLeague(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  const generated = generateLeagueStaffForTeams(league.seasonState.teams, rng)
  const withStaff = {
    ...league,
    staff: generated.staff,
    staffContracts: generated.staffContracts,
    collegeCoaches: generated.collegeCoaches,
  }

  return applyStaffBudgetsFromOwners(withStaff)
}

export { COLLEGE_PROMOTION_THRESHOLD }
