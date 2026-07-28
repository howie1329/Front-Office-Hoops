import { describe, expect, it } from "vitest"

import { COLLEGE_COACH_POOL_SIZE } from "@workspace/shared/constants"

import { createLeague, createRng } from "../../src"
import { progressStaffLifecycle } from "../../src/staff/staffLifecycle"

describe("staff lifecycle", () => {
  it("ages each staff member once, archives retirements, and tops up college coaches", () => {
    const base = createLeague({
      skipPreseason: true,
      name: "Staff lifecycle",
      baseSeed: "staff-lifecycle",
      rng: createRng("staff-lifecycle"),
      useMiniLeague: true,
    })
    const oldest = base.staff[0]!
    const league = {
      ...base,
      leagueFinancials: { ...base.leagueFinancials, currentCapSeason: 2 },
      staff: base.staff.map((member) =>
        member.id === oldest.id
          ? { ...member, age: 64, lastAgedSeason: 1 }
          : member,
      ),
      collegeCoaches: base.collegeCoaches.slice(0, 3),
    }

    const advanced = progressStaffLifecycle(league, createRng("ignored"))
    const repeated = progressStaffLifecycle(advanced, createRng("ignored"))

    expect(advanced.retiredStaff.some((entry) => entry.staffId === oldest.id)).toBe(true)
    expect(advanced.collegeCoaches).toHaveLength(COLLEGE_COACH_POOL_SIZE)
    expect(repeated).toEqual(advanced)
  })
})
