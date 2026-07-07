import { describe, expect, it } from "vitest"

import type { Player, RotationEntry } from "@workspace/shared/types"

import {
  computeDefensiveSynergy,
  computeOffensiveSynergy,
  mergeOffDefSynergyModifiers,
} from "../../src/gameSim/synergy"
import { makeTestPlayer, makeTestRatings } from "../helpers/playerRatings"

function rotationForArchetypes(
  archetypes: Player["archetype"][],
): RotationEntry[] {
  return archetypes.map((archetype, index) => ({
    player: makeTestPlayer({
      id: `p_${archetype}_${index}`,
      archetype,
      ratings: makeTestRatings({ overall: 70 }),
    }),
    minutes: 30 - index,
  }))
}

describe("synergy", () => {
  it("scores offensive and defensive fit separately", () => {
    const perimeterRotation = rotationForArchetypes([
      "lead_guard",
      "stretch_big",
      "three_and_d_wing",
      "scoring_guard",
      "slasher",
    ])
    const dropRotation = rotationForArchetypes([
      "rim_protector",
      "defensive_specialist",
      "three_and_d_wing",
      "lead_guard",
      "stretch_big",
    ])

    const offense = computeOffensiveSynergy(perimeterRotation, "perimeter")
    const defense = computeDefensiveSynergy(dropRotation, "drop_coverage")

    expect(offense.score).toBeGreaterThan(50)
    expect(defense.score).toBeGreaterThan(50)
    expect(offense.grade).not.toBe("F")
    expect(defense.grade).not.toBe("F")
  })

  it("merges offensive and defensive synergy modifiers", () => {
    const rotation = rotationForArchetypes([
      "lead_guard",
      "stretch_big",
      "rim_protector",
      "defensive_specialist",
      "three_and_d_wing",
    ])

    const offense = computeOffensiveSynergy(rotation, "perimeter")
    const defense = computeDefensiveSynergy(rotation, "switch_everything")
    const merged = mergeOffDefSynergyModifiers(offense, defense)

    expect(merged.efficiencyShift).not.toBe(0)
  })
})
