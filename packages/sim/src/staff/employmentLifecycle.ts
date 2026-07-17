import type { LeagueRecord, StaffRole } from "@workspace/shared/types"

import {
  STAFF_ROLES,
  getStaffByRole,
  syncLeagueStaffFinancials,
} from "./deriveTeamStaff"

export function getStaffEmploymentSeason(league: LeagueRecord): number {
  return league.leagueFinancials.currentCapSeason
}

export function getVacantStaffRoles(
  league: Pick<LeagueRecord, "staff">,
  teamId: string
): StaffRole[] {
  return STAFF_ROLES.filter(
    (role) => !getStaffByRole(league.staff, teamId, role)
  )
}

export function reconcileStaffEmployment(league: LeagueRecord): LeagueRecord {
  const season = getStaffEmploymentSeason(league)
  const staffContracts = league.staffContracts.map((contract) =>
    contract.status === "active" && contract.endSeason < season
      ? { ...contract, status: "expired" as const }
      : contract
  )
  const staff = league.staff.map((member) => {
    if (!member.teamId) {
      return member
    }

    const hasCurrentContract = staffContracts.some(
      (contract) =>
        contract.staffId === member.id &&
        contract.teamId === member.teamId &&
        contract.status === "active" &&
        contract.startSeason <= season &&
        contract.endSeason >= season
    )

    return hasCurrentContract
      ? member
      : {
          ...member,
          teamId: null,
          source: "market" as const,
        }
  })

  return syncLeagueStaffFinancials({
    ...league,
    staff,
    staffContracts,
  })
}
