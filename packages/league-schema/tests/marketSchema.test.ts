import { describe, expect, it } from "vitest"

import {
  deserializeContractMarketFixture,
  serializeContractMarketFixture,
  validateContractMarketFixture,
} from "../src"
import { createDefaultContractMarketFixture } from "@workspace/sim-v2"

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
})
