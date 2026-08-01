import type { PlayerMarketProfile } from "@workspace/domain-v2"

import type { RandomSource } from "./randomness"

function boundedPreference(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)))
}

function drawPreference(random: RandomSource, mean = 50, spread = 16): number {
  return boundedPreference(random.normal(mean, spread))
}

export function createDefaultPlayerMarketProfile(
  random: RandomSource
): PlayerMarketProfile {
  return {
    salaryPriority: drawPreference(random.fork("salary"), 58, 14),
    securityPriority: drawPreference(random.fork("security"), 52, 17),
    winningPriority: drawPreference(random.fork("winning"), 50, 18),
    rolePriority: drawPreference(random.fork("role"), 50, 16),
    playingTimePriority: drawPreference(random.fork("playing-time"), 50, 16),
    marketSizePriority: drawPreference(random.fork("market-size"), 45, 19),
    loyalty: drawPreference(random.fork("loyalty"), 50, 18),
    patience: drawPreference(random.fork("patience"), 50, 16),
    negotiationBaseline: drawPreference(
      random.fork("negotiation-baseline"),
      72,
      10
    ),
  }
}

export const DEFAULT_PLAYER_MARKET_PROFILE: PlayerMarketProfile = {
  salaryPriority: 58,
  securityPriority: 52,
  winningPriority: 50,
  rolePriority: 50,
  playingTimePriority: 50,
  marketSizePriority: 45,
  loyalty: 50,
  patience: 50,
  negotiationBaseline: 72,
}
