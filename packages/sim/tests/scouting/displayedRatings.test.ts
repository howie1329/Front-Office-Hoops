import { describe, expect, it } from "vitest"

import type { PlayerRatings } from "@workspace/shared/types"

import {
  getDisplayedRatings,
  getTeamScoutingReport,
} from "../../src/scouting/displayedRatings"

const ratings: PlayerRatings = {
  threePoint: 60,
  midRange: 60,
  freeThrow: 60,
  inside: 60,
  passing: 60,
  ballHandling: 60,
  rebounding: 60,
  defense: 60,
  stamina: 60,
  offensiveIQ: 60,
  defensiveIQ: 60,
  overall: 60,
  potential: 75,
  usage: 50,
  potentialFuzz: 6,
  fuzz: {
    threePoint: 6,
    midRange: -6,
    freeThrow: 4,
    inside: -4,
    passing: 5,
    ballHandling: -5,
    rebounding: 3,
    defense: -3,
    stamina: 2,
    offensiveIQ: 6,
    defensiveIQ: -6,
  },
}

describe("displayed scouting ratings", () => {
  it("materially reduces skill and potential error for elite scouting", () => {
    const low = getDisplayedRatings(ratings, 1)
    const high = getDisplayedRatings(ratings, 10)

    expect(Math.abs(high.threePoint - ratings.threePoint)).toBeLessThan(
      Math.abs(low.threePoint - ratings.threePoint),
    )
    expect(Math.abs(high.potential - ratings.potential)).toBeLessThan(
      Math.abs(low.potential - ratings.potential),
    )
  })

  it("keeps team reports deterministic while better scouts narrow uncertainty", () => {
    const low = getTeamScoutingReport(ratings, {
      leagueSeed: "scouting-test",
      viewerTeamId: "team_a",
      subjectId: "player_a",
      scoutingLevel: 1,
    })
    const repeat = getTeamScoutingReport(ratings, {
      leagueSeed: "scouting-test",
      viewerTeamId: "team_a",
      subjectId: "player_a",
      scoutingLevel: 1,
    })
    const high = getTeamScoutingReport(ratings, {
      leagueSeed: "scouting-test",
      viewerTeamId: "team_a",
      subjectId: "player_a",
      scoutingLevel: 10,
    })
    const otherTeam = getTeamScoutingReport(ratings, {
      leagueSeed: "scouting-test",
      viewerTeamId: "team_b",
      subjectId: "player_a",
      scoutingLevel: 1,
    })

    expect(repeat).toEqual(low)
    expect(otherTeam).not.toEqual(low)
    expect(high.potentialRange.high - high.potentialRange.low).toBeLessThan(
      low.potentialRange.high - low.potentialRange.low,
    )
    expect(Math.abs(high.ratings.threePoint - ratings.threePoint)).toBeLessThanOrEqual(
      Math.abs(low.ratings.threePoint - ratings.threePoint),
    )
  })
})
