import { describe, expect, it } from "vitest"

import { createRng } from "../../src/rng"
import { SAMPLE_ROSTERS } from "../../src/sampleRosters"
import { selectRotation } from "../../src/selectRotation"
import { simulateOvertime } from "../../src/gameSim/overtime"

const memphis = SAMPLE_ROSTERS.find((team) => team.abbrev === "MEM")!
const reno = SAMPLE_ROSTERS.find((team) => team.abbrev === "RNO")!

describe("simulateOvertime", () => {
  it("resolves a regulation tie with at least one overtime period", () => {
    const homeRotation = selectRotation(memphis.players)
    const awayRotation = selectRotation(reno.players)
    const result = simulateOvertime(
      { home: memphis, away: reno },
      homeRotation,
      awayRotation,
      104,
      104,
      createRng("forced-ot"),
      [],
      new Map(),
      new Map(),
    )

    expect(result.overtimes).toBeGreaterThanOrEqual(1)
    expect(result.homeScore).not.toBe(result.awayScore)
    expect(result.segmentMeta.some((segment) => segment.kind === "ot")).toBe(true)
  })
})
