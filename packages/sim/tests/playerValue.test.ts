import { describe, expect, it } from "vitest"

import type { Player } from "@workspace/shared/types"

import {
  calculateContractValue,
  calculatePlayerValue,
  getContractAssetValueBreakdown,
  getPlayerValueBreakdown,
} from "../src/playerValue"

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p_value",
    teamId: "t_value",
    firstName: "Value",
    lastName: "Player",
    age: 24,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    position: "SG",
    ratings: {
      overall: 60,
      potential: 70,
      shooting: 60,
      inside: 60,
      passing: 60,
      rebounding: 60,
      defense: 60,
      stamina: 60,
      usage: 16,
    },
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 2,
    yearsOfService: 2,
    ...overrides,
    archetype: overrides.archetype ?? "scoring_guard",
  }
}

describe("player value", () => {
  it("values young upside over a similar low-upside player", () => {
    const upside = makePlayer({
      age: 21,
      ratings: { ...makePlayer().ratings, potential: 82 },
    })
    const capped = makePlayer({
      age: 21,
      ratings: { ...makePlayer().ratings, potential: 62 },
    })

    expect(calculatePlayerValue(upside)).toBeGreaterThan(
      calculatePlayerValue(capped)
    )
  })

  it("keeps prime high-overall players above low-overall projects", () => {
    const prime = makePlayer({
      age: 27,
      ratings: { ...makePlayer().ratings, overall: 78, potential: 80 },
    })
    const project = makePlayer({
      age: 19,
      ratings: { ...makePlayer().ratings, overall: 48, potential: 78 },
    })

    expect(calculatePlayerValue(prime)).toBeGreaterThan(
      calculatePlayerValue(project)
    )
  })

  it("discounts older role players in contract value", () => {
    const primeRole = makePlayer({ age: 27 })
    const oldRole = makePlayer({ age: 34 })

    expect(calculateContractValue(primeRole)).toBeGreaterThan(
      calculateContractValue(oldRole)
    )
  })

  it("rewards scarce archetypes when matching skills are strong", () => {
    const specialist = makePlayer({
      position: "SF",
      archetype: "three_and_d_wing",
      ratings: {
        ...makePlayer().ratings,
        shooting: 70,
        defense: 70,
      },
    })
    const mismatched = makePlayer({
      position: "SF",
      archetype: "three_and_d_wing",
      ratings: {
        ...makePlayer().ratings,
        shooting: 54,
        defense: 56,
      },
    })

    expect(getPlayerValueBreakdown(specialist).archetypeValue).toBeGreaterThan(
      getPlayerValueBreakdown(mismatched).archetypeValue
    )
    expect(calculatePlayerValue(specialist)).toBeGreaterThan(
      calculatePlayerValue(mismatched)
    )
  })

  it("values bargain contracts as stronger assets than long overpays", () => {
    const player = makePlayer({
      ratings: { ...makePlayer().ratings, overall: 76, potential: 80 },
    })
    const bargain = getContractAssetValueBreakdown({
      player,
      expectedSalary: 24,
      contract: {
        id: "c_bargain",
        playerId: player.id,
        teamId: "t_value",
        startSeason: 1,
        endSeason: 3,
        yearlySalaries: [12, 13, 14],
        contractType: "standard",
        signingException: "cap_room",
        status: "active",
        signedSeason: 1,
      },
      mode: "buying",
    })
    const overpay = getContractAssetValueBreakdown({
      player,
      expectedSalary: 24,
      contract: {
        id: "c_overpay",
        playerId: player.id,
        teamId: "t_value",
        startSeason: 1,
        endSeason: 4,
        yearlySalaries: [38, 40, 42, 44],
        contractType: "standard",
        signingException: "cap_room",
        status: "active",
        signedSeason: 1,
      },
      mode: "buying",
    })

    expect(bargain.surplusValue).toBeGreaterThan(0)
    expect(overpay.surplusValue).toBeLessThan(0)
    expect(bargain.total).toBeGreaterThan(overpay.total)
  })
})
