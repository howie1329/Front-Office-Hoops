import { describe, expect, it } from "vitest"

import { createRng } from "../src/rng"
import { generatePlayers } from "../src/generatePlayers"
import { generateDraftClass } from "../src/draft/generateDraftClass"
import {
  ARCHETYPE_SKILL_BIAS,
  isValidArchetypeForPosition,
} from "../src/playerGeneration/archetypes"
import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"

describe("player archetypes", () => {
  it("assigns valid archetypes to generated players", () => {
    const players = generatePlayers(SAMPLE_TEAMS[0]!, createRng("archetypes"))

    expect(players.every((player) => player.archetype)).toBe(true)
    expect(
      players.every((player) =>
        isValidArchetypeForPosition(player.archetype, player.position)
      )
    ).toBe(true)
  })

  it("assigns valid archetypes to draft prospects", () => {
    const prospects = generateDraftClass(30, 2027, "draft", createRng("draft"))

    expect(prospects.every((prospect) => prospect.archetype)).toBe(true)
    expect(
      prospects.every((prospect) =>
        isValidArchetypeForPosition(prospect.archetype, prospect.position)
      )
    ).toBe(true)
  })

  it("defines meaningful skill biases for core scarce archetypes", () => {
    expect(ARCHETYPE_SKILL_BIAS.three_and_d_wing.threePoint).toBeGreaterThan(0)
    expect(ARCHETYPE_SKILL_BIAS.three_and_d_wing.defense).toBeGreaterThan(0)
    expect(ARCHETYPE_SKILL_BIAS.rim_protector.defense).toBeGreaterThan(0)
    expect(ARCHETYPE_SKILL_BIAS.stretch_big.threePoint).toBeGreaterThan(0)
  })
})
