import { describe, expect, it } from "vitest"

import type { Contract } from "@workspace/shared/contractTypes"
import type { Player } from "@workspace/shared/types"

import { calculateSeasonFinancials } from "../../src/financials"
import { buildFairSalary } from "../../src/financials/ai/offers"
import { selectCapCutCandidate } from "../../src/financials/ai/capCuts"
import {
  calculateMaxSalary,
  calculateMinSalary,
} from "../../src/financials/capMath"
import { makeTestRatings } from "../helpers/playerRatings"

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? "p_test"
  return {
    id,
    teamId: "t_test",
    firstName: "Test",
    lastName: id,
    age: 27,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    wingspanInches: 80,
    reachRating: 58,
    position: "SG",
    ratings: makeTestRatings({
      overall: 70,
      potential: 70,
      usage: 20,
      ...(overrides.ratings ?? {}),
    }),
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

function makeContract(player: Player, salary: number): Contract {
  return {
    id: `c_${player.id}`,
    playerId: player.id,
    teamId: "t_test",
    startSeason: 1,
    endSeason: 1,
    yearlySalaries: [salary],
    contractType: "standard",
    signingException: "cap_room",
    status: "active",
    signedSeason: 1,
  }
}

describe("financial AI value model", () => {
  it("prices fair salary from contract value instead of raw overall only", () => {
    const seasonFinancials = calculateSeasonFinancials(141, 0.05, 1)
    const youngUpside = makePlayer({
      id: "young",
      age: 20,
      ratings: { ...makePlayer().ratings, overall: 70, potential: 90 },
    })
    const olderFlat = makePlayer({
      id: "older",
      age: 34,
      yearsOfService: 12,
      ratings: { ...makePlayer().ratings, overall: 70, potential: 70 },
    })

    expect(buildFairSalary(youngUpside, seasonFinancials)).toBeGreaterThan(
      buildFairSalary(olderFlat, seasonFinancials)
    )
  })

  it("keeps fair salary inside min and max salary bounds", () => {
    const seasonFinancials = calculateSeasonFinancials(141, 0.05, 1)
    const player = makePlayer({
      id: "star",
      age: 25,
      yearsOfService: 7,
      ratings: { ...makePlayer().ratings, overall: 99, potential: 99 },
    })
    const salary = buildFairSalary(player, seasonFinancials)

    expect(salary).toBeGreaterThanOrEqual(
      calculateMinSalary(seasonFinancials, player.yearsOfService)
    )
    expect(salary).toBeLessThanOrEqual(
      calculateMaxSalary(seasonFinancials.salaryCap, player.yearsOfService)
    )
  })

  it("uses team mode when choosing cap cut candidates", () => {
    const oldContributor = makePlayer({
      id: "old",
      age: 34,
      ratings: { ...makePlayer().ratings, overall: 72, potential: 72 },
    })
    const youngUpside = makePlayer({
      id: "young",
      age: 20,
      ratings: { ...makePlayer().ratings, overall: 68, potential: 88 },
    })
    const team = { players: [oldContributor, youngUpside] }
    const contracts = [
      makeContract(oldContributor, 12),
      makeContract(youngUpside, 12),
    ]

    expect(selectCapCutCandidate(team, contracts, "selling")?.id).toBe("old")
    expect(selectCapCutCandidate(team, contracts, "contending")?.id).toBe(
      "young"
    )
  })
})
