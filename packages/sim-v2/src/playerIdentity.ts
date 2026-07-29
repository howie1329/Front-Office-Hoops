import type { PlayerIdentity } from "@workspace/domain-v2"
import { names, uniqueNamesGenerator } from "unique-names-generator"

export const PLAYER_IDENTITY_GENERATOR_VERSION = 1

export function generatePlayerIdentity(playerSeed: string): PlayerIdentity {
  return {
    firstName: uniqueNamesGenerator({
      dictionaries: [names],
      seed: `${playerSeed}:identity:first`,
      style: "capital",
    }),
    lastName: uniqueNamesGenerator({
      dictionaries: [names],
      seed: `${playerSeed}:identity:last`,
      style: "capital",
    }),
  }
}
