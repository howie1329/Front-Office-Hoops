import { describe, expect, it } from "vitest"

import {
  createLeague,
  getCurrentFreeAgents,
  getFreeAgencyWindowStatus,
  projectCurrentFreeAgents,
} from "../src"

describe("free agency projection", () => {
  const league = createLeague({
    id: "free-agency-projection",
    name: "Free Agency Projection League",
    seed: "free-agency-projection-seed",
    mode: "deterministic-lab",
    createdWithEntropy: false,
    now: "2026-08-02T00:00:00.000Z",
  }).document

  it("projects only the current free-agent pool", () => {
    const players = getCurrentFreeAgents(league)
    const projections = projectCurrentFreeAgents(league)

    expect(players).toHaveLength(100)
    expect(projections).toHaveLength(players.length)
    expect(
      projections.every(
        (projection) =>
          projection.expectedAnnualSalary >= 1_200_000 &&
          projection.expectedYears >= 1 &&
          projection.expectedYears <= 4
      )
    ).toBe(true)
  })

  it("keeps in-season signing open before the playoffs", () => {
    expect(getFreeAgencyWindowStatus(league)).toEqual({
      open: true,
      label: "Open",
      detail: "Regular-season signings",
    })
  })
})
