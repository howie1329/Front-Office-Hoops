import type { LeagueRecord } from "@workspace/shared/types"

import { syncLeagueStaffFinancials } from "./deriveTeamStaff"

export type StaffActionResult =
  | { ok: true; league: LeagueRecord }
  | { ok: false; reason: string }

export function fireStaff(
  league: LeagueRecord,
  teamId: string,
  staffId: string,
): StaffActionResult {
  if (league.seasonState.phase !== "offseason") {
    return { ok: false, reason: "Staff moves are only allowed during the offseason" }
  }

  if ((league.seasonState.offseasonPhase ?? "staff") !== "staff") {
    return { ok: false, reason: "Staff changes are only allowed during the staff phase" }
  }

  const member = league.staff.find(
    (entry) => entry.id === staffId && entry.teamId === teamId,
  )

  if (!member) {
    return { ok: false, reason: "Coach not found on this team" }
  }

  const staffContracts = league.staffContracts.map((contract) =>
    contract.staffId === staffId && contract.teamId === teamId && contract.status === "active"
      ? { ...contract, status: "fired" as const }
      : contract,
  )

  const staff = league.staff.map((entry) =>
    entry.id === staffId
      ? {
          ...entry,
          teamId: null,
          source: "market" as const,
        }
      : entry,
  )

  return {
    ok: true,
    league: syncLeagueStaffFinancials({
      ...league,
      staff,
      staffContracts,
    }),
  }
}
