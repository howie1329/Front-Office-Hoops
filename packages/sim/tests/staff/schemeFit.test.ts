import { describe, expect, it } from "vitest"

import {
  archetypeFitsDefensiveScheme,
  archetypeFitsOffensiveScheme,
  DEFENSIVE_SCHEME_ARCHETYPES,
  OFFENSIVE_SCHEME_ARCHETYPES,
} from "../../src/staff/schemeFit"
import { computeOffensiveSynergy } from "../../src/gameSim/synergy"

describe("schemeFit", () => {
  it("treats balanced offense as neutral for all archetypes", () => {
    expect(archetypeFitsOffensiveScheme("slasher", "balanced")).toBe(true)
    expect(archetypeFitsOffensiveScheme("post_scorer", "balanced")).toBe(true)
  })

  it("does not award balanced offense automatic scheme-fit bonuses", () => {
    expect(computeOffensiveSynergy([], "balanced")).toEqual({
      grade: "C",
      score: 50,
      bonuses: [],
      penalties: [],
    })
  })

  it("scores perimeter offense for preferred archetypes", () => {
    for (const archetype of OFFENSIVE_SCHEME_ARCHETYPES.perimeter) {
      expect(archetypeFitsOffensiveScheme(archetype, "perimeter")).toBe(true)
    }
    expect(archetypeFitsOffensiveScheme("rim_protector", "perimeter")).toBe(false)
  })

  it("scores defensive schemes against their archetype tables", () => {
    for (const archetype of DEFENSIVE_SCHEME_ARCHETYPES.drop_coverage) {
      expect(archetypeFitsDefensiveScheme(archetype, "drop_coverage")).toBe(true)
    }
    expect(
      archetypeFitsDefensiveScheme("scoring_guard", "drop_coverage"),
    ).toBe(false)
  })
})
