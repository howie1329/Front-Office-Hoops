import type {
  Game,
  SimulateGameContext,
  TeamWithRoster,
} from "@workspace/shared/types"

import { createRng } from "./rng"
import { simulateTeamMatchup } from "./simulateTeamMatchup"

export function simulateGame(
  home: TeamWithRoster,
  away: TeamWithRoster,
  context: SimulateGameContext,
): Game {
  const rngNonce = context.rngNonce ?? 0
  const rngSeed = `${context.baseSeed}:game:${context.season}:${context.gameId}:nonce:${rngNonce}`
  const rng = createRng(rngSeed)
  const result = simulateTeamMatchup({ home, away }, rng)

  return {
    id: context.gameId,
    season: context.season,
    day: context.day,
    homeTeamId: home.id,
    awayTeamId: away.id,
    rngSeed,
    rngNonce,
    result,
  }
}
