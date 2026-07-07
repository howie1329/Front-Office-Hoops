import type { Rng } from "@workspace/shared/types"

import { estimatePotentialForecast } from "./estimatePotentialForecast"

export { estimatePotentialForecast } from "./estimatePotentialForecast"
export {
  monteCarloPotential,
  refreshPotentialProjection,
  buildPotentialRange,
} from "../development/monteCarloPotential"

export function estimatePotential(
  overall: number,
  age: number,
  _peakAge: number,
  rng: Rng,
): number {
  return estimatePotentialForecast(overall, age, rng)
}
