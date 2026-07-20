import type { LeagueRecord, Owner, StaffMember } from "@workspace/shared/types"

import {
  archetypeFitsDefensiveScheme,
  archetypeFitsOffensiveScheme,
} from "./schemeFit"
import { extendStaffContract } from "./extendStaffContract"
import { fireStaff } from "./fireStaff"

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function roleRating(member: StaffMember): number {
  switch (member.role) {
    case "offensive_coordinator": return member.ratings.offense
    case "defensive_coordinator": return member.ratings.defense
    case "scouting_head": return member.ratings.scouting
    default: return member.ratings.overall
  }
}

function expectedWinPct(league: LeagueRecord, teamId: string): number {
  const average = league.seasonState.teams.reduce((sum, team) => sum + team.overall, 0) /
    Math.max(1, league.seasonState.teams.length)
  const overall = league.seasonState.teams.find((team) => team.id === teamId)?.overall ?? average
  return Math.max(0.25, Math.min(0.75, 0.5 + (overall - average) / 40))
}

function performanceScore(league: LeagueRecord, member: StaffMember): number {
  if (!member.teamId) return 0.5
  const history = league.staffCareerSnapshots
    .filter((entry) => entry.staffId === member.id && entry.teamId === member.teamId)
    .slice(-2)
  if (history.length === 0) return 0.5
  const actual = history.reduce((sum, entry) => sum + entry.wins / Math.max(1, entry.wins + entry.losses), 0) / history.length
  return clamp(0.5 + (actual - expectedWinPct(league, member.teamId)) * 2)
}

export function staffSchemeFit(league: LeagueRecord, member: StaffMember): number {
  if (!member.teamId || member.role === "scouting_head") return 0.5
  const team = league.seasonState.teams.find((entry) => entry.id === member.teamId)
  if (!team || team.players.length === 0) return 0.5
  const players = [...team.players].sort((a, b) => b.ratings.overall - a.ratings.overall).slice(0, 5)
  const offense = players.filter((player) => archetypeFitsOffensiveScheme(player.archetype, member.preferredOffense)).length / players.length
  const defense = players.filter((player) => archetypeFitsDefensiveScheme(player.archetype, member.preferredDefense)).length / players.length
  return (offense + defense) / 2
}

function ownerThreshold(owner: Owner | undefined): number {
  if (owner?.archetype === "win_now" || owner?.archetype === "meddling") return 0.45
  if (owner?.archetype === "patient" || owner?.archetype === "hands_off") return 0.25
  return 0.35
}

export function staffRetentionScore(league: LeagueRecord, member: StaffMember): number {
  const owner = league.owners.find((entry) => entry.teamId === member.teamId)
  const quality = roleRating(member) / 10
  const performance = performanceScore(league, member)
  const scheme = staffSchemeFit(league, member)
  const finance = league.teamFinancials.find((entry) => entry.teamId === member.teamId)
  const affordability = finance ? clamp(1 - finance.staffPayroll / Math.max(0.1, finance.staffBudget)) : 0.5
  if (owner?.archetype === "analytics") {
    return quality * 0.25 + performance * 0.3 + scheme * 0.3 + affordability * 0.15
  }
  return quality * 0.35 + performance * 0.3 + scheme * 0.2 + affordability * 0.15
}

export function scoreStaffCandidate(
  league: LeagueRecord,
  teamId: string,
  candidate: StaffMember,
): number {
  const finance = league.teamFinancials.find((entry) => entry.teamId === teamId)
  const affordability = finance ? clamp(1 - candidate.ratings.overall / Math.max(10, finance.staffBudget * 2)) : 0.5
  return roleRating(candidate) / 10 * 0.55 +
    staffSchemeFit(league, { ...candidate, teamId }) * 0.3 +
    affordability * 0.15
}

export function processAiStaffRetention(league: LeagueRecord): LeagueRecord {
  let current = league
  const season = current.leagueFinancials.currentCapSeason
  for (const member of [...current.staff]) {
    if (!member.teamId || member.teamId === current.userTeamId) continue
    const owner = current.owners.find((entry) => entry.teamId === member.teamId)
    const score = staffRetentionScore(current, member)
    const history = current.staffCareerSnapshots.filter((entry) => entry.staffId === member.id).slice(-2)
    const poorForTwoSeasons = history.length >= 2 && history.every(() => score < ownerThreshold(owner))
    const poorRating = roleRating(member) <= 3 && performanceScore(current, member) < 0.5
    if (poorForTwoSeasons || poorRating) {
      const fired = fireStaff(current, member.teamId, member.id)
      if (fired.ok) current = fired.league
      continue
    }
    const contract = current.staffContracts.find(
      (entry) => entry.staffId === member.id && entry.teamId === member.teamId && entry.status === "active",
    )
    if (!contract || contract.endSeason > season || score < 0.7) continue
    const finance = current.teamFinancials.find((entry) => entry.teamId === member.teamId)
    if (owner?.archetype === "frugal" && finance && finance.staffPayroll > finance.staffBudget * 0.85) continue
    const extension = extendStaffContract(current, member.teamId, member.id, {
      years: 2,
      firstYearSalary: Math.max(0.5, contract.yearlySalaries[contract.yearlySalaries.length - 1] ?? 0.5),
    })
    if (extension.ok) current = extension.league
  }
  return current
}
