import { describe, expect, it } from "vitest"

import {
  createStandardGameSimulationConfig,
  getGameNumericSetting,
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
})
