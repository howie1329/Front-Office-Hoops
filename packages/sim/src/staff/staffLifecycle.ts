import type { LeagueRecord, Rng, StaffMember } from "@workspace/shared/types"

import { replenishCollegeCoaches } from "./generateLeagueStaff"
import { createRng } from "../rng"

function retirementChance(age: number): number {
  if (age >= 65) return 1
  if (age < 60) return 0
  return [0.1, 0.2, 0.35, 0.5, 0.7][age - 60] ?? 0
}

function retirementRoll(staffId: string, season: number): number {
  let hash = season
  for (const character of staffId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return (hash % 10_000) / 10_000
}

function ageGroup(
  members: StaffMember[],
  season: number,
  _rng: Rng,
): { active: StaffMember[]; retired: LeagueRecord["retiredStaff"] } {
  const active: StaffMember[] = []
  const retired: LeagueRecord["retiredStaff"] = []

  for (const member of members) {
    if (member.lastAgedSeason >= season) {
      active.push(member)
      continue
    }
    const aged = { ...member, age: member.age + 1, lastAgedSeason: season }
    if (retirementRoll(aged.id, season) < retirementChance(aged.age)) {
      retired.push({
        staffId: aged.id,
        season,
        age: aged.age,
        role: aged.role,
        teamId: aged.teamId,
        reason: "age",
      })
      continue
    }
    active.push(aged)
  }

  return { active, retired }
}

/** Advances staff exactly once for the incoming cap season. */
export function progressStaffLifecycle(league: LeagueRecord, rng: Rng): LeagueRecord {
  const season = league.leagueFinancials.currentCapSeason
  const employed = ageGroup(league.staff, season, rng)
  const college = ageGroup(league.collegeCoaches, season, rng)
  const retiredIds = new Set(employed.retired.map((entry) => entry.staffId))
  const staffContracts = league.staffContracts.map((contract) =>
    retiredIds.has(contract.staffId) && contract.status === "active"
      ? { ...contract, status: "expired" as const }
      : contract,
  )

  return {
    ...league,
    staff: employed.active.map((member) =>
      retiredIds.has(member.id)
        ? { ...member, teamId: null, source: "market" as const }
        : member,
    ),
    staffContracts,
    collegeCoaches: replenishCollegeCoaches(
      college.active,
      createRng(`${league.seasonState.baseSeed}:college-staff:${season}`),
    ).map((member) =>
      member.lastAgedSeason < season
        ? { ...member, lastAgedSeason: season }
        : member,
    ),
    retiredStaff: [...league.retiredStaff, ...employed.retired, ...college.retired],
  }
}

/** Archives one completed season of employed staff history. */
export function archiveStaffCareerSnapshots(league: LeagueRecord): LeagueRecord {
  const season = league.seasonState.season
  const existing = new Set(
    league.staffCareerSnapshots
      .filter((entry) => entry.season === season)
      .map((entry) => entry.staffId),
  )
  const champion = league.seasonState.playoffBracket?.championTeamId
  const playoffTeams = new Set(
    league.seasonState.playoffBracket?.series.flatMap((series) => [
      series.higherSeedTeamId,
      series.lowerSeedTeamId,
    ]) ?? [],
  )
  const snapshots = league.staff.flatMap((member) => {
    if (!member.teamId || existing.has(member.id)) return []
    const standing = league.seasonState.standings.find(
      (entry) => entry.teamId === member.teamId,
    )
    return [{
      id: `staff_career_${member.id}_${season}`,
      staffId: member.id,
      season,
      teamId: member.teamId,
      role: member.role,
      age: member.age,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      madePlayoffs: playoffTeams.has(member.teamId),
      wonChampionship: champion === member.teamId,
    }]
  })
  return snapshots.length === 0
    ? league
    : { ...league, staffCareerSnapshots: [...league.staffCareerSnapshots, ...snapshots] }
}
