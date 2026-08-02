import { it } from "vitest"

import { runSliderSensitivity } from "../src"
import {
  createCoachCalibrationFixture,
  createInjuryCalibrationFixture,
  createRotationCalibrationFixture,
  createStandardCalibrationFixture,
  createTalentCalibrationFixture,
} from "./fixtures"

it("prints the reproducible Plan 002 sensitivity baseline", () => {
  const standard = runSliderSensitivity({
    baseSeed: "foh-v2-slider-baseline",
    count: 50,
    scenarios: [
      { id: "standard", createFixture: createStandardCalibrationFixture },
    ],
  })
  const coaching = runSliderSensitivity({
    baseSeed: "foh-v2-slider-coaching-baseline",
    count: 50,
    paths: [
      "coaching.influence",
      "coaching.paceInfluence",
      "coaching.shotSelectionInfluence",
      "coaching.defensiveInfluence",
    ],
    scenarios: [
      { id: "standard", createFixture: createStandardCalibrationFixture },
      { id: "matched-coaches", createFixture: createCoachCalibrationFixture },
    ],
  })
  const matched = runSliderSensitivity({
    baseSeed: "foh-v2-slider-matched-baseline",
    count: 50,
    paths: [
      "environment.talentSeparation",
      "rotation.adherence",
      "injuries.maxGamesOut",
    ],
    scenarios: [
      { id: "standard", createFixture: createStandardCalibrationFixture },
      { id: "talent", createFixture: createTalentCalibrationFixture },
      { id: "rotation", createFixture: createRotationCalibrationFixture },
      { id: "injuries", createFixture: createInjuryCalibrationFixture },
    ],
  })

  for (const report of [standard, coaching, matched]) {
    console.log(
      JSON.stringify(
        report.results.map((result) => ({
          path: result.path,
          classification: result.classification,
          primaryMetric: result.primaryMetric,
          direction: result.direction,
          scenarios: result.scenarios.map((scenario) => ({
            scenario: scenario.scenario,
            classification: scenario.classification,
            pairedChangedCount: scenario.pairedChangedCount,
            pairedCount: scenario.pairedCount,
            delta: Number(scenario.primary.delta.toFixed(2)),
          })),
        })),
        null,
        2
      )
    )
  }
}, 30000)
