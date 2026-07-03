import { describe, expect, it } from "vitest"

import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

import {
  createAutoRotationPlan,
  createGameRotation,
  selectRotation,
} from "../src"
import { createRng } from "../src/rng"
import { generatePlayers } from "../src/generatePlayers"

describe("rotation planning", () => {
  const team = {
    ...SAMPLE_TEAMS[0]!,
    players: generatePlayers(SAMPLE_TEAMS[0]!, createRng("rotation-plan")),
  }

  it("creates an auto rotation plan that sums to regulation minutes", () => {
    const plan = createAutoRotationPlan(team)

    expect(plan.source).toBe("auto")
    expect(
      plan.entries.reduce((sum, entry) => sum + entry.targetMinutes, 0)
    ).toBe(240)
    expect(plan.entries.length).toBeGreaterThan(8)
  })

  it("turns a plan into game rotation entries with starters and roles", () => {
    const rotation = createGameRotation(team)

    expect(rotation.entries.filter((entry) => entry.starter)).toHaveLength(5)
    expect(rotation.entries.some((entry) => entry.role === "sixth_man")).toBe(
      true
    )
    expect(
      rotation.entries.reduce((sum, entry) => sum + entry.minutes, 0)
    ).toBe(240)
  })

  it("keeps the legacy selectRotation API compatible", () => {
    const rotation = selectRotation(team.players)

    expect(rotation.reduce((sum, entry) => sum + entry.minutes, 0)).toBe(240)
    expect(rotation.filter((entry) => entry.starter)).toHaveLength(5)
  })
})
