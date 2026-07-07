import { describe, expect, it } from "vitest"

import { createLeague, createRng } from "../../src"
import { fireStaff } from "../../src/staff/fireStaff"
import { hireStaff } from "../../src/staff/hireStaff"

describe("staffCommands", () => {
  it("hires from the market during the staff phase", () => {
    let league = createLeague({
      skipPreseason: true,
      name: "Staff Hire",
      baseSeed: "staff-hire",
      rng: createRng("staff-hire"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })

    league = {
      ...league,
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "staff",
      },
    }

    const teamId = league.userTeamId!
    const vacantRole = "scouting_head" as const
    const incumbent = league.staff.find(
      (entry) => entry.teamId === teamId && entry.role === vacantRole,
    )
    expect(incumbent).toBeDefined()

    const fired = fireStaff(league, teamId, incumbent!.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) {
      return
    }
    league = fired.league

    const candidate = league.staff.find(
      (entry) =>
        entry.teamId === null &&
        entry.role === vacantRole &&
        entry.source !== "college",
    )
    expect(candidate).toBeDefined()

    const hired = hireStaff(league, teamId, candidate!.id, {
      years: 1,
      firstYearSalary: 0.5,
    })
    expect(hired.ok).toBe(true)
    if (!hired.ok) {
      return
    }
    expect(
      hired.league.staff.find(
        (entry) => entry.teamId === teamId && entry.role === vacantRole,
      )?.id,
    ).toBe(candidate!.id)
  })

  it("blocks hiring outside the staff phase", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Staff Blocked",
      baseSeed: "staff-blocked",
      rng: createRng("staff-blocked"),
      useMiniLeague: true,
    })

    const offseasonLeague = {
      ...league,
      seasonState: {
        ...league.seasonState,
        phase: "offseason" as const,
        offseasonPhase: "re_signing" as const,
      },
    }

    const candidate = offseasonLeague.staff.find((entry) => entry.teamId === null)
    expect(candidate).toBeDefined()

    const result = hireStaff(
      offseasonLeague,
      offseasonLeague.seasonState.teams[0]!.id,
      candidate!.id,
      { years: 1, firstYearSalary: 0.5 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain("staff phase")
    }
  })
})
