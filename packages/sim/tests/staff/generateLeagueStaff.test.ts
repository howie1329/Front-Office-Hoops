import { describe, expect, it } from "vitest"

import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"

import { createLeague, createRng } from "../../src"
import { STAFF_ROLES } from "../../src/staff/deriveTeamStaff"
import { staffBudgetForOwner } from "../../src/staff/staffBudget"

describe("generateLeagueStaff", () => {
  it("assigns four employed staff per team with contracts", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Staff Generation",
      baseSeed: "staff-generation",
      rng: createRng("staff-generation"),
    })

    for (const team of league.seasonState.teams) {
      for (const role of STAFF_ROLES) {
        const member = league.staff.find(
          (entry) => entry.teamId === team.id && entry.role === role,
        )
        expect(member).toBeDefined()
        expect(member?.source).toBe("employed")
      }

      const contracts = league.staffContracts.filter(
        (contract) =>
          contract.teamId === team.id && contract.status === "active",
      )
      expect(contracts.length).toBe(4)
    }
  })

  it("seeds market and college hiring pools", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Staff Pools",
      baseSeed: "staff-pools",
      rng: createRng("staff-pools"),
    })

    const unemployedMarket = league.staff.filter(
      (entry) => entry.teamId === null && entry.source !== "college",
    )
    expect(unemployedMarket.length).toBeGreaterThan(0)
    expect(league.collegeCoaches.length).toBeGreaterThan(0)
  })

  it("maps owner archetypes to staff budgets on full leagues", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Staff Budgets",
      baseSeed: "staff-budgets",
      rng: createRng("staff-budgets"),
    })

    expect(league.seasonState.teams.length).toBe(LEAGUE_TEAM_COUNT)

    for (const owner of league.owners) {
      const finance = league.teamFinancials.find(
        (entry) => entry.teamId === owner.teamId,
      )
      expect(finance?.staffBudget).toBe(staffBudgetForOwner(owner))
      expect(finance?.staffPayroll).toBeGreaterThan(0)
    }
  })
})
