import type {
  CoachingPhilosophy,
  CoachingPace,
  CoachingRotation,
  DefensiveScheme,
  LeagueRecord,
  OffensiveScheme,
  StaffMember,
  StaffRole,
  TeamFinancials,
} from "@workspace/shared/types"

import { getStaffPayroll } from "./staffPayroll"

const STAFF_ROLES: StaffRole[] = [
  "head_coach",
  "offensive_coordinator",
  "defensive_coordinator",
  "scouting_head",
]

export function getTeamStaff(
  staff: StaffMember[],
  teamId: string
): StaffMember[] {
  return staff.filter((member) => member.teamId === teamId)
}

export function getStaffByRole(
  staff: StaffMember[],
  teamId: string,
  role: StaffRole
): StaffMember | undefined {
  return staff.find(
    (member) => member.teamId === teamId && member.role === role
  )
}

export function deriveCoachingLevel(teamStaff: StaffMember[]): number {
  const hc = teamStaff.find((member) => member.role === "head_coach")
  const oc = teamStaff.find((member) => member.role === "offensive_coordinator")
  const dc = teamStaff.find((member) => member.role === "defensive_coordinator")

  if (!hc) {
    return 5
  }

  const weighted =
    hc.ratings.overall * 0.5 +
    (oc?.ratings.offense ?? 5) * 0.25 +
    (dc?.ratings.defense ?? 5) * 0.25

  return Math.max(1, Math.min(10, Math.round(weighted)))
}

export function deriveScoutingLevel(teamStaff: StaffMember[]): number {
  const head = teamStaff.find((member) => member.role === "scouting_head")
  const hc = teamStaff.find((member) => member.role === "head_coach")

  if (!head) {
    return 5
  }

  const blended =
    head.ratings.scouting * 0.85 + (hc?.ratings.scouting ?? 5) * 0.15

  return Math.max(1, Math.min(10, Math.round(blended)))
}

export function deriveDevelopmentLevel(teamStaff: StaffMember[]): number {
  const hc = teamStaff.find((member) => member.role === "head_coach")
  const oc = teamStaff.find((member) => member.role === "offensive_coordinator")
  const dc = teamStaff.find((member) => member.role === "defensive_coordinator")

  if (!hc) {
    return 5
  }

  const blended =
    hc.ratings.development * 0.5 +
    (oc?.ratings.offense ?? 5) * 0.15 +
    (dc?.ratings.defense ?? 5) * 0.15 +
    hc.ratings.overall * 0.2

  return Math.max(1, Math.min(10, Math.round(blended)))
}

const DEFAULT_PHILOSOPHY: CoachingPhilosophy = {
  pace: "balanced",
  offense: "balanced",
  defense: "drop_coverage",
  rotation: "standard",
}

export function derivePhilosophyFromStaff(
  staff: StaffMember[],
  teamId: string
): CoachingPhilosophy {
  const hc = getStaffByRole(staff, teamId, "head_coach")
  if (!hc) {
    return DEFAULT_PHILOSOPHY
  }

  return {
    pace: hc.pace ?? "balanced",
    offense: hc.preferredOffense,
    defense: hc.preferredDefense,
    rotation: hc.rotation ?? "standard",
  }
}

export function getHeadCoachPace(
  staff: StaffMember[],
  teamId: string
): CoachingPace {
  return getStaffByRole(staff, teamId, "head_coach")?.pace ?? "balanced"
}

export function staffAlignmentEfficiencyShift(
  staff: StaffMember[],
  teamId: string
): number {
  const hc = getStaffByRole(staff, teamId, "head_coach")
  const oc = getStaffByRole(staff, teamId, "offensive_coordinator")
  const dc = getStaffByRole(staff, teamId, "defensive_coordinator")

  if (!hc) {
    return 0
  }

  let shift = 0

  if (oc) {
    shift += oc.preferredOffense === hc.preferredOffense ? 0.008 : -0.005
  }

  if (dc) {
    shift += dc.preferredDefense === hc.preferredDefense ? 0.008 : -0.005
  }

  return shift
}

export function coachingQualityEfficiencyShift(coachingLevel: number): number {
  const normalized = (coachingLevel - 5) / 5
  return normalized * 0.02
}

export function syncTeamFinancialsFromStaff(
  league: LeagueRecord
): TeamFinancials[] {
  const season = league.leagueFinancials.currentCapSeason

  return league.teamFinancials.map((teamFinance) => {
    const teamStaff = getTeamStaff(league.staff, teamFinance.teamId)

    return {
      ...teamFinance,
      coachingLevel: deriveCoachingLevel(teamStaff),
      scoutingLevel: deriveScoutingLevel(teamStaff),
      developmentLevel: deriveDevelopmentLevel(teamStaff),
      staffPayroll: getStaffPayroll(
        teamFinance.teamId,
        league.staffContracts,
        season
      ),
    }
  })
}

export function syncLeagueStaffFinancials(league: LeagueRecord): LeagueRecord {
  return {
    ...league,
    teamFinancials: syncTeamFinancialsFromStaff(league),
  }
}

export { STAFF_ROLES }

export function pickRandomScheme<T extends string>(
  schemes: readonly T[],
  rng: { int: (min: number, max: number) => number }
): T {
  return schemes[rng.int(0, schemes.length - 1)]!
}

export const OFFENSIVE_SCHEMES: OffensiveScheme[] = [
  "attack_rim",
  "balanced",
  "perimeter",
  "post_hub",
  "pace_space",
]

export const DEFENSIVE_SCHEMES: DefensiveScheme[] = [
  "drop_coverage",
  "switch_everything",
  "zone_23",
  "full_court_press",
  "aggressive_help",
]

export const COACHING_PACES: CoachingPace[] = ["slow", "balanced", "fast"]

export const COACHING_ROTATIONS: CoachingRotation[] = [
  "tight",
  "standard",
  "deep",
]
