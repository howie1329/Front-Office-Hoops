import { describe, expect, it } from "vitest"

import {
  calculateContractDemand,
  createDefaultContractMarketFixture,
  createEconomySnapshot,
  evaluateCompetitiveOffers,
  evaluateContractOffer,
  runEconomySimulation,
  runFreeAgencySimulation,
  STANDARD_ECONOMY_CONFIG,
  validateContractOffer,
} from "../src"
import type { ContractOffer } from "@workspace/domain-v2"

function createOffer(
  fixture: ReturnType<typeof createDefaultContractMarketFixture>,
  playerId: string,
  teamId: string,
  salary: number,
  id = "offer-fixture"
): ContractOffer {
  return {
    id,
    playerId,
    teamId,
    season: fixture.season,
    phase: "free-agency",
    round: 1,
    annualSalary: [salary, Math.round(salary * 1.05)],
    years: 2,
    fullyGuaranteed: true,
    source: "fixture",
  }
}

describe("contract market engine", () => {
  it("builds the same full-league fixture from the same seed", () => {
    const first = createDefaultContractMarketFixture("market-seed")
    const second = createDefaultContractMarketFixture("market-seed")

    expect(second).toEqual(first)
    expect(Object.keys(first.teams)).toHaveLength(30)
    expect(Object.keys(first.players).length).toBeGreaterThan(500)
    expect(first.actualFreeAgentIds.length).toBeGreaterThan(0)
    expect(first.projectedFreeAgency.entries.length).toBeGreaterThan(
      first.actualFreeAgentIds.length
    )
  })

  it("calculates bounded, explainable demand from preseason value", () => {
    const fixture = createDefaultContractMarketFixture("demand-seed")
    const playerId = fixture.actualFreeAgentIds[0]!
    const demand = calculateContractDemand(fixture, playerId)

    expect(demand.lowAnnualValue).toBeLessThanOrEqual(demand.projectedAnnualValue)
    expect(demand.projectedAnnualValue).toBeLessThanOrEqual(demand.highAnnualValue)
    expect(demand.highAnnualValue).toBeLessThanOrEqual(fixture.economy.maximumSalary)
    expect(demand.breakdown.length).toBeGreaterThanOrEqual(4)
  })

  it("keeps minimum offers legal above the soft cap and rejects unsupported spending", () => {
    const fixture = createDefaultContractMarketFixture("legality-seed")
    const playerId = fixture.actualFreeAgentIds[0]!
    const teamId = Object.keys(fixture.teams)[0]!
    const minimumOffer = createOffer(
      fixture,
      playerId,
      teamId,
      fixture.economy.minimumSalary
    )

    expect(validateContractOffer(fixture, minimumOffer).valid).toBe(true)

    const hardCapped = structuredClone(fixture)
    hardCapped.economy.hardCapTriggered = true
    hardCapped.economy.hardCapLine = 1
    const illegal = createOffer(
      hardCapped,
      playerId,
      teamId,
      hardCapped.economy.maximumSalary,
      "illegal-offer"
    )

    expect(validateContractOffer(hardCapped, illegal).valid).toBe(false)
    expect(evaluateContractOffer(hardCapped, illegal).reasonCodes).toContain(
      "league-legality-failed"
    )
  })

  it("selects the highest qualifying utility for the same player", () => {
    const fixture = createDefaultContractMarketFixture("competition-seed")
    const playerId = fixture.actualFreeAgentIds[0]!
    const teamIds = Object.keys(fixture.teams).slice(0, 2)
    const offers = teamIds.map((teamId, index) =>
      createOffer(
        fixture,
        playerId,
        teamId!,
        fixture.economy.minimumSalary + index * 10_000_000,
        `offer-${index}`
      )
    )
    const results = evaluateCompetitiveOffers(fixture, offers)
    const winner = results.reduce((best, current) =>
      current.utility.total > best.utility.total ? current : best
    )

    expect(winner.offerId).toBe("offer-1")
  })

  it("grows cap values deterministically across seasons", () => {
    const seasonOne = createEconomySnapshot(1, STANDARD_ECONOMY_CONFIG)
    const seasonTen = createEconomySnapshot(10, STANDARD_ECONOMY_CONFIG)

    expect(seasonTen.softCap).toBeGreaterThan(seasonOne.softCap)
    expect(seasonTen.maximumSalary).toBeGreaterThan(seasonOne.maximumSalary)
    expect(seasonTen.rookieScale).toHaveLength(60)
  })

  it("runs a deterministic three-round market and leaves a truthful unsigned pool", () => {
    const fixture = createDefaultContractMarketFixture("market-run-seed")
    const first = runFreeAgencySimulation(fixture)
    const second = runFreeAgencySimulation(fixture)

    expect(second).toEqual(first)
    expect(first.rounds.length).toBeLessThanOrEqual(3)
    expect(first.signedContracts.length + first.unsignedPlayerIds.length).toBe(
      fixture.actualFreeAgentIds.length
    )
    expect(first.finalFixture.offers).not.toEqual({})
  })

  it("exposes the market-only economy harness as a separate result", () => {
    const result = runEconomySimulation("economy-seed", 10)

    expect(result.seasons).toHaveLength(10)
    expect(result.seasons.at(-1)!.softCap).toBeGreaterThan(
      result.seasons[0]!.softCap
    )
    expect(result.harnessNote).toContain("roster turnover")
  })
})
