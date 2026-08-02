import { describe, expect, it } from "vitest"

import {
  deserializeEconomyRunExport,
  deserializeFreeAgencyRunExport,
  deserializeContractMarketFixture,
  serializeEconomyRunExport,
  serializeFreeAgencyRunExport,
  serializeContractMarketFixture,
  validateContractMarketFixture,
} from "../src"
import {
  createDefaultContractMarketFixture,
  runEconomySimulation,
  runFreeAgencySimulation,
  STANDARD_ECONOMY_CONFIG,
} from "@workspace/sim-v2"

describe("contract market schema", () => {
  it("round trips the deterministic fixture", () => {
    const fixture = createDefaultContractMarketFixture("schema-seed")
    const serialized = serializeContractMarketFixture(fixture)
    const restored = deserializeContractMarketFixture(serialized)

    expect(restored).toEqual(fixture)
  })

  it("rejects an invalid contract year count", () => {
    const fixture = createDefaultContractMarketFixture("invalid-schema-seed")
    const invalid = structuredClone(fixture)
    const playerId = Object.keys(invalid.contracts)[0]!
    invalid.contracts[playerId]!.years = 5

    const result = validateContractMarketFixture(invalid)

    expect(result.valid).toBe(false)
  })

  it("rejects a contract whose salary array does not match its term", () => {
    const fixture = createDefaultContractMarketFixture("invalid-term-seed")
    const invalid = structuredClone(fixture)
    const playerId = Object.keys(invalid.contracts)[0]!
    invalid.contracts[playerId]!.annualSalary = [
      invalid.contracts[playerId]!.annualSalary[0]!,
    ]

    const result = validateContractMarketFixture(invalid)

    expect(result.valid).toBe(false)
  })

  it("round trips a free-agency run export with its input fixture", () => {
    const fixture = createDefaultContractMarketFixture("run-export-seed")
    const report = {
      schema: "foh-contract-market-free-agency-report" as const,
      version: 1 as const,
      fixture,
      view: {
        mode: "free-agency" as const,
        selectedPlayerId: null,
        selectedTeamId: Object.keys(fixture.teams)[0] ?? null,
        salaryMillions: 24,
        years: 4,
      },
      result: runFreeAgencySimulation(fixture),
    }

    const restored = deserializeFreeAgencyRunExport(
      serializeFreeAgencyRunExport(report)
    )

    expect(restored).toEqual(report)
    expect(restored.result.rounds.length).toBeGreaterThan(0)
  })

  it("round trips an economy run export with its effective config", () => {
    const report = {
      schema: "foh-contract-market-economy-report" as const,
      version: 1 as const,
      config: STANDARD_ECONOMY_CONFIG,
      view: {
        mode: "economy" as const,
        selectedPlayerId: null,
        selectedTeamId: null,
        salaryMillions: 24,
        years: 4,
      },
      result: runEconomySimulation("economy-export-seed", 3),
    }

    const restored = deserializeEconomyRunExport(
      serializeEconomyRunExport(report)
    )

    expect(restored).toEqual(report)
    expect(restored.result.seasons).toHaveLength(3)
  })
})
