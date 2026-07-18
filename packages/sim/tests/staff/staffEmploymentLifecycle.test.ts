import { describe, expect, it } from "vitest"

import {
  advanceLeague,
  advanceStaffMarketDay,
  createLeague,
  createRng,
  getCurrentCalendar,
  getPhaseEligibility,
} from "../../src"
import { STAFF_MINIMUM_SALARY } from "@workspace/shared/constants"
import { completeStaffPhase } from "../../src/offseason/staffPhase"
import { STAFF_ROLES } from "../../src/staff/deriveTeamStaff"
import {
  getStaffEmploymentSeason,
  getVacantStaffRoles,
  reconcileStaffEmployment,
} from "../../src/staff/employmentLifecycle"
import { fireStaff } from "../../src/staff/fireStaff"
import { extendStaffContract } from "../../src/staff/extendStaffContract"
import { hireStaff, validateStaffHire } from "../../src/staff/hireStaff"

function inStaffWeek(seed: string) {
  const league = createLeague({
    skipPreseason: true,
    name: "Staff lifecycle",
    baseSeed: seed,
    rng: createRng(seed),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })

  return {
    ...league,
    leagueFinancials: {
      ...league.leagueFinancials,
      currentCapSeason: 2,
    },
    seasonState: {
      ...league.seasonState,
      phase: "offseason" as const,
      offseasonPhase: "staff" as const,
    },
  }
}

describe("staff employment lifecycle", () => {
  it("expires ended deals, releases coaches, and recomputes effects for the cap season", () => {
    const league = inStaffWeek("staff-expiration")
    const teamId = league.userTeamId!
    const headCoach = league.staff.find(
      (member) => member.teamId === teamId && member.role === "head_coach"
    )!
    const contract = league.staffContracts.find(
      (entry) => entry.staffId === headCoach.id && entry.status === "active"
    )!
    const expiring = {
      ...league,
      staffContracts: league.staffContracts.map((entry) =>
        entry.id === contract.id
          ? { ...entry, endSeason: 1, yearlySalaries: [2] }
          : entry
      ),
    }

    const reconciled = reconcileStaffEmployment(expiring)

    expect(getStaffEmploymentSeason(reconciled)).toBe(2)
    expect(
      reconciled.staffContracts.find((entry) => entry.id === contract.id)
        ?.status
    ).toBe("expired")
    expect(
      reconciled.staff.find((entry) => entry.id === headCoach.id)
    ).toMatchObject({
      teamId: null,
      source: "market",
    })
    expect(getVacantStaffRoles(reconciled, teamId)).toContain("head_coach")
    expect(
      reconciled.teamFinancials.find((entry) => entry.teamId === teamId)
        ?.coachingLevel
    ).toBe(5)
    expect(reconcileStaffEmployment(reconciled)).toEqual(reconciled)
  })

  it("keeps contracts that cover the employment season", () => {
    const league = inStaffWeek("staff-continuing")
    const teamId = league.userTeamId!
    const before = league.staff.filter((member) => member.teamId === teamId)
    const continuing = {
      ...league,
      staffContracts: league.staffContracts.map((contract) =>
        contract.teamId === teamId
          ? { ...contract, endSeason: 2, yearlySalaries: [1, 1.1] }
          : contract
      ),
    }

    const reconciled = reconcileStaffEmployment(continuing)

    expect(
      reconciled.staff.filter((member) => member.teamId === teamId)
    ).toEqual(before)
    expect(getVacantStaffRoles(reconciled, teamId)).toEqual([])
  })

  it("creates new contracts in the current cap season and budgets only annual salary", () => {
    let league = reconcileStaffEmployment(inStaffWeek("staff-hire-season"))
    const teamId = league.userTeamId!
    const incumbent = league.staff.find(
      (member) => member.teamId === teamId && member.role === "scouting_head"
    )!
    const fired = fireStaff(league, teamId, incumbent.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) return
    league = fired.league

    const candidate = league.staff.find(
      (member) => member.teamId === null && member.role === "scouting_head"
    )!
    const payroll = league.teamFinancials.find(
      (entry) => entry.teamId === teamId
    )!.staffPayroll
    league = {
      ...league,
      teamFinancials: league.teamFinancials.map((entry) =>
        entry.teamId === teamId
          ? { ...entry, staffBudget: payroll + 0.6 }
          : entry
      ),
    }

    expect(
      validateStaffHire(league, teamId, candidate.id, {
        years: 3,
        firstYearSalary: 0.5,
      }).ok
    ).toBe(true)

    const hired = hireStaff(league, teamId, candidate.id, {
      years: 3,
      firstYearSalary: 0.5,
    })
    expect(hired.ok).toBe(true)
    if (!hired.ok) return

    expect(
      hired.league.staffContracts.find(
        (entry) => entry.staffId === candidate.id && entry.status === "active"
      )
    ).toMatchObject({ startSeason: 2, endSeason: 4 })
    expect(
      hired.league.teamFinancials.find((entry) => entry.teamId === teamId)
        ?.staffPayroll
    ).toBeCloseTo(payroll + 0.5)
  })

  it("replaces an extension in the current cap season using annual payroll", () => {
    const base = inStaffWeek("staff-extension-season")
    const teamId = base.userTeamId!
    const member = base.staff.find(
      (entry) => entry.teamId === teamId && entry.role === "head_coach"
    )!
    const originalContract = base.staffContracts.find(
      (entry) => entry.staffId === member.id && entry.status === "active"
    )!
    let league = reconcileStaffEmployment({
      ...base,
      staffContracts: base.staffContracts.map((contract) =>
        contract.id === originalContract.id
          ? {
              ...contract,
              startSeason: 1,
              endSeason: 2,
              yearlySalaries: [3.8, 4],
            }
          : contract
      ),
    })
    const priorContract = league.staffContracts.find(
      (entry) => entry.staffId === member.id && entry.status === "active"
    )!
    league = {
      ...league,
      teamFinancials: league.teamFinancials.map((entry) =>
        entry.teamId === teamId ? { ...entry, staffBudget: 100 } : entry
      ),
    }

    const extended = extendStaffContract(league, teamId, member.id, {
      years: 2,
      firstYearSalary: 4,
    })

    expect(extended.ok).toBe(true)
    if (!extended.ok) return
    expect(
      extended.league.staffContracts.find(
        (entry) => entry.id === priorContract.id
      )?.status
    ).toBe("expired")
    expect(
      extended.league.staffContracts.find(
        (entry) => entry.staffId === member.id && entry.status === "active"
      )
    ).toMatchObject({
      startSeason: 2,
      endSeason: 3,
      yearlySalaries: [4, 4.2],
    })
  })

  it("blocks the user from completing staff week with a vacancy", () => {
    let league = reconcileStaffEmployment(inStaffWeek("staff-role-gate"))
    const teamId = league.userTeamId!
    const incumbent = league.staff.find(
      (member) => member.teamId === teamId && member.role === "scouting_head"
    )!
    const fired = fireStaff(league, teamId, incumbent.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) return
    league = fired.league

    expect(getPhaseEligibility(league, "completeStaffPhase")).toEqual({
      allowed: false,
      reason: "Fill all staff roles before continuing",
    })
  })

  it("emergency-fills every remaining AI vacancy before re-signing", () => {
    const base = inStaffWeek("staff-ai-fill")
    let league = reconcileStaffEmployment({
      ...base,
      staffContracts: base.staffContracts.map((contract) =>
        contract.teamId === base.userTeamId
          ? {
              ...contract,
              endSeason: Math.max(2, contract.endSeason),
              yearlySalaries:
                contract.yearlySalaries.length > 1
                  ? contract.yearlySalaries
                  : [
                      contract.yearlySalaries[0] ?? 1,
                      contract.yearlySalaries[0] ?? 1,
                    ],
            }
          : contract
      ),
    })
    const incumbent = league.staff.find(
      (member) => member.teamId !== null && member.teamId !== league.userTeamId
    )!
    const aiTeamId = incumbent.teamId!
    const fired = fireStaff(league, aiTeamId, incumbent.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) return
    league = fired.league

    const completed = completeStaffPhase(league, createRng("staff-ai-cleanup"))
    const replayed = completeStaffPhase(league, createRng("staff-ai-cleanup"))

    expect(completed.seasonState.offseasonPhase).toBe("re_signing")
    expect(replayed).toEqual(completed)
    for (const team of completed.seasonState.teams) {
      expect(getVacantStaffRoles(completed, team.id)).toEqual([])
      expect(
        completed.staff.filter((member) => member.teamId === team.id)
      ).toHaveLength(STAFF_ROLES.length)
    }
  })

  it("auto-fills every user vacancy at the staff deadline", () => {
    let league = reconcileStaffEmployment(inStaffWeek("staff-user-deadline"))
    const teamId = league.userTeamId!

    for (const member of league.staff.filter(
      (entry) => entry.teamId === teamId
    )) {
      const fired = fireStaff(league, teamId, member.id)
      expect(fired.ok).toBe(true)
      if (!fired.ok) return
      league = fired.league
    }

    const deadline = getCurrentCalendar(league.seasonState).milestones
      .staffPhaseEndDay
    league = {
      ...league,
      seasonState: {
        ...league.seasonState,
        currentDay: deadline - 1,
      },
    }

    const completed = advanceStaffMarketDay(league, createRng("user-deadline"))

    expect(completed.seasonState.offseasonPhase).toBe("re_signing")
    expect(completed.seasonState.currentDay).toBe(deadline)
    expect(getVacantStaffRoles(completed, teamId)).toEqual([])

    const fallbackStaff = completed.staff.filter(
      (entry) =>
        entry.teamId === teamId && entry.id.startsWith("staff_emergency_")
    )
    expect(fallbackStaff).toHaveLength(STAFF_ROLES.length)
    for (const member of fallbackStaff) {
      expect(
        completed.staffContracts.find(
          (contract) =>
            contract.staffId === member.id &&
            contract.teamId === teamId &&
            contract.status === "active"
        )
      ).toMatchObject({
        endSeason: getStaffEmploymentSeason(completed),
        yearlySalaries: [STAFF_MINIMUM_SALARY],
      })
    }

    expect(() =>
      advanceStaffMarketDay(completed, createRng("after-deadline"))
    ).toThrow("Staff market days can only advance during staff week")
  })

  it("completes the staff phase at the calendar boundary during automatic advancement", () => {
    let league = reconcileStaffEmployment(
      inStaffWeek("staff-calendar-deadline")
    )
    const teamId = league.userTeamId!
    const member = league.staff.find((entry) => entry.teamId === teamId)!
    const fired = fireStaff(league, teamId, member.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) return
    league = fired.league

    const deadline = getCurrentCalendar(league.seasonState).milestones
      .staffPhaseEndDay
    const atBoundary = {
      ...league,
      seasonState: {
        ...league.seasonState,
        currentDay: deadline,
      },
    }

    const result = advanceLeague(
      atBoundary,
      {
        target: "day",
        policy: "runThrough",
        league: atBoundary,
        userTeamId: teamId,
      },
      createRng("calendar-deadline")
    )

    expect(result.league.seasonState.offseasonPhase).toBe("re_signing")
    expect(result.league.seasonState.currentDay).toBe(deadline + 1)
    expect(getVacantStaffRoles(result.league, teamId)).toEqual([])
  })

  it("does not add fallback staff when the user roster is already full", () => {
    const base = createLeague({
      skipPreseason: true,
      name: "Staff no fallback",
      baseSeed: "staff-no-fallback",
      rng: createRng("staff-no-fallback"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })
    const league = reconcileStaffEmployment({
      ...base,
      seasonState: {
        ...base.seasonState,
        phase: "offseason",
        offseasonPhase: "staff",
      },
    })
    const teamId = league.userTeamId!
    const originalUserStaffIds = new Set(
      league.staff
        .filter((member) => member.teamId === teamId)
        .map((member) => member.id)
    )
    const deadline = getCurrentCalendar(league.seasonState).milestones
      .staffPhaseEndDay
    const atFinalDay = {
      ...league,
      seasonState: {
        ...league.seasonState,
        currentDay: deadline - 1,
      },
    }

    const completed = advanceStaffMarketDay(
      atFinalDay,
      createRng("no-fallback")
    )

    expect(completed.seasonState.offseasonPhase).toBe("re_signing")
    expect(
      completed.staff.some(
        (member) =>
          member.teamId === teamId && !originalUserStaffIds.has(member.id)
      )
    ).toBe(false)
  })
})
