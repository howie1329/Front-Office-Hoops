import { describe, expect, it } from "vitest"

import { GAME_SETTING_DESCRIPTORS } from "@workspace/sim-v2"

import {
  DEFAULT_SLIDER_SENSITIVITY_EXPECTATIONS,
  runSliderSensitivity,
  serializeSliderSensitivityReport,
} from "../src"
import {
  createCoachCalibrationFixture,
  createInjuryCalibrationFixture,
  createRotationCalibrationFixture,
  createStandardCalibrationFixture,
  createTalentCalibrationFixture,
} from "./fixtures"

describe("runSliderSensitivity", () => {
  it("covers every numeric setting with deterministic paired arms", () => {
    const options = {
      baseSeed: "sensitivity",
      count: 1,
      scenarios: [
        {
          id: "standard",
          createFixture: createStandardCalibrationFixture,
        },
      ],
    }
    const first = runSliderSensitivity(options)
    const second = runSliderSensitivity(options)

    expect(first).toEqual(second)
    expect(first.results).toHaveLength(GAME_SETTING_DESCRIPTORS.length)
    expect(new Set(first.results.map((result) => result.path)).size).toBe(
      GAME_SETTING_DESCRIPTORS.length
    )
    expect(first.results[0]?.scenarios[0]?.arms.length).toBeGreaterThanOrEqual(
      4
    )
    expect(first.results[0]?.scenarios[0]?.pairedCount).toBe(1)
    expect(JSON.parse(serializeSliderSensitivityReport(first))).toEqual(first)
  })

  it("keeps neutral controls distinguishable from wired controls", () => {
    const report = runSliderSensitivity({
      baseSeed: "neutrality",
      count: 2,
      paths: ["defense.switching", "offense.transitionRate"],
      scenarios: [
        {
          id: "standard",
          createFixture: createStandardCalibrationFixture,
        },
      ],
    })

    expect(
      report.results.find((result) => result.path === "defense.switching")
    ).toMatchObject({
      classification: "unknown",
      direction: "observe",
    })
    expect(
      report.results.find((result) => result.path === "offense.transitionRate")
        ?.scenarios[0]?.classification
    ).toBe("wired")
  })

  it("uses non-neutral coach profiles for coaching sensitivity", () => {
    const report = runSliderSensitivity({
      baseSeed: "coaching",
      count: 3,
      paths: [
        "coaching.influence",
        "coaching.paceInfluence",
        "coaching.shotSelectionInfluence",
        "coaching.defensiveInfluence",
      ],
      scenarios: [
        {
          id: "neutral-coaches",
          createFixture: createStandardCalibrationFixture,
        },
        {
          id: "matched-coaches",
          createFixture: createCoachCalibrationFixture,
        },
      ],
    })

    for (const path of [
      "coaching.influence",
      "coaching.paceInfluence",
      "coaching.shotSelectionInfluence",
      "coaching.defensiveInfluence",
    ] as const) {
      const result = report.results.find((candidate) => candidate.path === path)
      expect(result?.scenarios).toHaveLength(2)
      expect(result?.primaryMetric).toBe(
        DEFAULT_SLIDER_SENSITIVITY_EXPECTATIONS[path].primaryMetric
      )
      expect(result?.classification).toMatch(
        /wired|conditional|unknown|saturated/
      )
    }
    expect(
      report.results.find((result) => result.path === "coaching.paceInfluence")
        ?.classification
    ).toBe("conditional")
  })

  it("uses event-enabled scenarios for injury and rotation controls", () => {
    const report = runSliderSensitivity({
      baseSeed: "conditional-scenarios",
      count: 5,
      paths: [
        "environment.talentSeparation",
        "rotation.adherence",
        "injuries.maxGamesOut",
      ],
      scenarios: [
        {
          id: "standard",
          createFixture: createStandardCalibrationFixture,
        },
        {
          id: "talent",
          createFixture: createTalentCalibrationFixture,
        },
        {
          id: "rotation",
          createFixture: createRotationCalibrationFixture,
        },
        {
          id: "injuries",
          createFixture: createInjuryCalibrationFixture,
        },
      ],
    })

    expect(
      report.results.find((result) => result.path === "rotation.adherence")
        ?.classification
    ).toMatch(/wired|conditional/)
    expect(
      report.results.find(
        (result) => result.path === "environment.talentSeparation"
      )?.classification
    ).toBe("wired")
    expect(
      report.results
        .find((result) => result.path === "injuries.maxGamesOut")
        ?.scenarios.find((scenario) => scenario.scenario === "injuries")
        ?.classification
    ).toMatch(/wired|unknown|saturated/)
  })
})
