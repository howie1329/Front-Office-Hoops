import { describe, expect, it } from "vitest"

import { createPlayerContractFixture } from "@workspace/domain-v2"

import {
  careerAnnualContextSchema,
  careerTransitionResultSchema,
  playerEntitySchema,
  retirementEvaluationSchema,
} from "../src"

describe("career schemas", () => {
  it("validates annual contexts, transitions, and retirement evaluations", () => {
    const player = createPlayerContractFixture()
    const context = {
      season: 1,
      minutes: 1900,
      gamesPlayed: 72,
      gamesScheduled: 82,
      injuryDevelopmentPenalty: 0.12,
      coachingDevelopmentEmphasis: 50,
    }
    const transition = {
      player,
      phase: "growth" as const,
      skillDeltas: {
        shooting: 1,
        finishing: 0,
        passing: 1,
        handling: 0,
        rebounding: 0,
        defense: -1,
        basketballIQ: 1,
        stamina: 1,
      },
      events: [],
      availability: {
        gamesScheduled: 82,
        gamesPlayed: 72,
        minutes: 1900,
        availabilityRate: 72 / 82,
        injuryDevelopmentPenalty: 0.12,
        injuryAffected: true,
      },
    }

    expect(careerAnnualContextSchema.safeParse(context).success).toBe(true)
    expect(careerTransitionResultSchema.safeParse(transition).success).toBe(
      true
    )
    expect(
      retirementEvaluationSchema.safeParse({
        eligible: true,
        retired: false,
        probability: 0.1,
        factors: [
          {
            key: "age",
            label: "Age",
            contribution: 0.02,
            explanation: "Age contributes to the hazard.",
          },
        ],
      }).success
    ).toBe(true)
  })

  it("requires career timing and accepts final retirement status", () => {
    const player = createPlayerContractFixture({
      leagueStatus: { kind: "retired" },
    })
    expect(playerEntitySchema.safeParse(player).success).toBe(true)

    const missingTiming = {
      ...player,
      profile: {
        ...player.profile,
        development: {
          potential: 82,
          rating: 62,
          volatility: 25,
        },
      },
    }
    expect(playerEntitySchema.safeParse(missingTiming).success).toBe(false)
  })
})
