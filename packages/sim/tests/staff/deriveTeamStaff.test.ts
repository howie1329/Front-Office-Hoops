import { describe, expect, it } from "vitest"

import type { StaffMember } from "@workspace/shared/types"

import {
  coachingQualityEfficiencyShift,
  deriveCoachingLevel,
  derivePhilosophyFromStaff,
  deriveScoutingLevel,
  staffAlignmentEfficiencyShift,
} from "../../src/staff/deriveTeamStaff"

function makeStaff(
  overrides: Partial<StaffMember> & Pick<StaffMember, "role">,
): StaffMember {
  return {
    id: `staff_${overrides.role}`,
    firstName: "Test",
    lastName: "Coach",
    teamId: "t_test",
    source: "employed",
    age: 40,
    lastAgedSeason: 1,
    ratings: {
      overall: 7,
      offense: 7,
      defense: 7,
      scouting: 7,
      development: 7,
    },
    preferredOffense: "balanced",
    preferredDefense: "drop_coverage",
    pace: "balanced",
    rotation: "standard",
    ...overrides,
  }
}

describe("deriveTeamStaff", () => {
  const staff: StaffMember[] = [
    makeStaff({
      role: "head_coach",
      preferredOffense: "pace_space",
      preferredDefense: "switch_everything",
      pace: "fast",
      rotation: "deep",
    }),
    makeStaff({
      role: "offensive_coordinator",
      preferredOffense: "pace_space",
    }),
    makeStaff({
      role: "defensive_coordinator",
      preferredDefense: "switch_everything",
    }),
    makeStaff({ role: "scouting_head", ratings: { overall: 6, offense: 5, defense: 5, scouting: 8, development: 6 } }),
  ]

  it("derives coaching and scouting levels from staff ratings", () => {
    expect(deriveCoachingLevel(staff)).toBeGreaterThanOrEqual(6)
    expect(deriveScoutingLevel(staff)).toBe(8)
  })

  it("uses the head coach as the authoritative philosophy", () => {
    expect(derivePhilosophyFromStaff(staff, "t_test")).toEqual({
      pace: "fast",
      offense: "pace_space",
      defense: "switch_everything",
      rotation: "deep",
    })
  })

  it("rewards aligned coordinators and penalizes conflicts", () => {
    expect(staffAlignmentEfficiencyShift(staff, "t_test")).toBeGreaterThan(0)

    const misaligned = staff.map((member) => {
      if (member.role === "offensive_coordinator") {
        return { ...member, preferredOffense: "post_hub" as const }
      }
      if (member.role === "defensive_coordinator") {
        return { ...member, preferredDefense: "zone_23" as const }
      }
      return member
    })
    expect(staffAlignmentEfficiencyShift(misaligned, "t_test")).toBeLessThan(0)
  })

  it("scales coaching quality modifier with derived level", () => {
    expect(coachingQualityEfficiencyShift(5)).toBe(0)
    expect(coachingQualityEfficiencyShift(10)).toBeGreaterThan(0)
    expect(coachingQualityEfficiencyShift(1)).toBeLessThan(0)
  })
})
