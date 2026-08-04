import { describe, expect, it } from "vitest"

import {
  createStandardGameSimulationConfig,
  getGameNumericSetting,
  resolveGameSimulationConfig,
  updateGameNumericSetting,
} from "../src"

describe("numeric game setting helpers", () => {
  it("reads and updates a typed setting without changing other sections", () => {
    const config = createStandardGameSimulationConfig()
    const next = updateGameNumericSetting(config, "environment.pace", 100)

    expect(getGameNumericSetting(config, "environment.pace")).toBe(50)
    expect(getGameNumericSetting(next, "environment.pace")).toBe(100)
    expect(next.presetId).toBe("custom")
    expect(next.offense).toEqual(config.offense)
    expect(next.injuries).toEqual(config.injuries)
  })

  it("clamps values to the descriptor bounds", () => {
    const config = createStandardGameSimulationConfig()

    expect(
      getGameNumericSetting(
        updateGameNumericSetting(config, "injuries.maxGamesOut", 100),
        "injuries.maxGamesOut"
      )
    ).toBe(20)
  })

  it("preserves the custom preset when resolving a custom config", () => {
    const config = createStandardGameSimulationConfig()
    config.presetId = "custom"
    config.environment.pace = 80

    const resolved = resolveGameSimulationConfig(config)

    expect(resolved.presetId).toBe("custom")
    expect(resolved.environment.pace).toBe(80)
    expect(resolved.version).toBe(2)
  })
})
