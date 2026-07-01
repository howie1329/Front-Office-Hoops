import { BASE_OFF_RATING } from "@workspace/shared/constants"
import type { Rng, Team } from "@workspace/shared/types"

const RATING_CENTER = 50
const OFF_RATING_MULTIPLIER = 8
const DEF_RATING_MULTIPLIER = 6
const OFF_RATING_NOISE_STDDEV = 2

export function estimateDefFactor(team: Team): number {
  return (team.overall - RATING_CENTER) / RATING_CENTER
}

export function estimateOffRtg(
  team: Team,
  oppDefenseFactor: number,
  rng: Rng,
): number {
  const offFactor = estimateDefFactor(team)
  const noise = rng.normal(0, OFF_RATING_NOISE_STDDEV)

  return (
    BASE_OFF_RATING +
    offFactor * OFF_RATING_MULTIPLIER -
    oppDefenseFactor * DEF_RATING_MULTIPLIER +
    noise
  )
}
