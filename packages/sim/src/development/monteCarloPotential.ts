import {
  MONTE_CARLO_PERCENTILE,
  MONTE_CARLO_SIMULATIONS,
  RATING_MAX,
  RATING_MIN,
} from "@workspace/shared/constants"
import type { Player, Rng } from "@workspace/shared/types"

import { deriveOverall, getSkillRatings } from "../playerRatings"
import { computeBaseSkillDeltas } from "./computeBaseSkillDeltas"
import { applySkillDeltas } from "./applySkillDeltas"
import { estimatePotentialForecast } from "../playerGeneration/estimatePotentialForecast"

function simulateCareerPeak(
  player: Player,
  rng: Rng,
  maxAge = 32,
): number {
  let simPlayer: Player = { ...player }
  let peak = simPlayer.ratings.overall

  while (simPlayer.age < maxAge) {
    simPlayer = { ...simPlayer, age: simPlayer.age + 1 }
    const deltas = computeBaseSkillDeltas(simPlayer, rng, {
      forecastPotential: simPlayer.ratings.potential,
    })
    simPlayer = applySkillDeltas(simPlayer, deltas)
    const skills = getSkillRatings(simPlayer.ratings)
    const overall = deriveOverall(skills)
    simPlayer = {
      ...simPlayer,
      ratings: { ...simPlayer.ratings, ...skills, overall },
    }
    peak = Math.max(peak, overall)
  }

  return peak
}

export function monteCarloPotential(
  player: Player,
  rng: Rng,
): { potential: number; method: "monte_carlo" | "forecast" } {
  if (player.age >= 29) {
    return {
      potential: Math.round(player.ratings.overall),
      method: "forecast",
    }
  }

  const outcomes: number[] = []

  for (let index = 0; index < MONTE_CARLO_SIMULATIONS; index++) {
    outcomes.push(simulateCareerPeak(player, rng))
  }

  outcomes.sort((a, b) => a - b)
  const percentileIndex = Math.floor(
    MONTE_CARLO_SIMULATIONS * MONTE_CARLO_PERCENTILE,
  )
  const raw = outcomes[percentileIndex] ?? outcomes[outcomes.length - 1]!

  const potential = Math.max(
    RATING_MIN,
    Math.min(RATING_MAX, Math.round(raw)),
  )

  if (potential < player.ratings.overall) {
    return { potential: player.ratings.overall, method: "monte_carlo" }
  }

  return { potential, method: "monte_carlo" }
}

export function refreshPotentialProjection(
  player: Player,
  rng: Rng,
  modifierBias = 0,
): { potential: number; reasons: string[] } {
  const { potential, method } = monteCarloPotential(player, rng)
  const reasons: string[] = []

  if (method === "monte_carlo") {
    reasons.push("potential:monte_carlo_forecast")
  } else {
    reasons.push("potential:age_capped")
  }

  let adjusted = potential

  if (modifierBias > 0.05) {
    adjusted = Math.min(RATING_MAX, adjusted + 1)
    reasons.push("potential:positive_modifiers")
  } else if (modifierBias < -0.05) {
    adjusted = Math.max(RATING_MIN, adjusted - 1)
    reasons.push("potential:negative_modifiers")
  }

  return { potential: adjusted, reasons }
}

export function estimatePotential(
  overall: number,
  age: number,
  _peakAge: number,
  rng: Rng,
): number {
  return estimatePotentialForecast(overall, age, rng)
}

export function buildPotentialRange(
  truePotential: number,
  scoutingLevel: number,
  rng: Rng,
): import("@workspace/shared/types").PotentialRange {
  const spread = Math.max(2, 10 - scoutingLevel)
  const low = Math.max(RATING_MIN, truePotential - spread - rng.int(0, 2))
  const high = Math.min(RATING_MAX, truePotential + spread + rng.int(0, 2))
  return { low, mid: truePotential, high }
}
