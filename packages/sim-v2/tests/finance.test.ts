import { describe, expect, it } from "vitest"

import { createLeague, projectTeamFinance } from "../src"

describe("team finance projection", () => {
  it("projects typed salary schedules across the five-season horizon", () => {
    const league = createLeague({
      id: "finance-projection",
      name: "Finance Projection League",
      seed: "finance-projection-seed",
      mode: "deterministic-lab",
      createdWithEntropy: false,
      now: "2026-08-02T00:00:00.000Z",
    }).document
    const teamId = "team:01"
    const projection = projectTeamFinance(league, teamId, 5)
    const firstContract = projection.contracts[0]
    const payroll = league.projections.payroll.find(
      (row) => row.teamId === teamId
    )?.payroll

    expect(projection.seasons).toHaveLength(5)
    expect(projection.contracts).toHaveLength(15)
    expect(firstContract?.annualSalary).toHaveLength(2)
    expect(projection.seasons[0]?.payroll).toBe(payroll)
    expect(projection.seasons[1]?.payroll).toBeGreaterThan(
      projection.seasons[0]?.payroll ?? 0
    )
    expect(projection.seasons[0]?.capRoom).toBe(
      (projection.seasons[0]?.softCap ?? 0) -
        (projection.seasons[0]?.payroll ?? 0)
    )
  })
})
