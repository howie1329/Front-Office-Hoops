import type {
  PlayerGenerationConfig,
  PlayerPopulationContextKind,
} from "@workspace/domain-v2"

import {
  generatePlayerWithDiagnostics,
  type PlayerGenerationResult,
} from "./playerGeneration"
import {
  generatePlayerIdentity,
  PLAYER_IDENTITY_GENERATOR_VERSION,
} from "./playerIdentity"
import { createDeterministicRandom } from "./randomness"

export type PlayerIdentityMode = "generated" | "none"

export type PlayerPopulationContext = {
  kind: PlayerPopulationContextKind
  id: string
}

export type PlayerPopulationInput = {
  seed: string
  context: PlayerPopulationContext
  count: number
  startIndex?: number
  identityMode: PlayerIdentityMode
  config: PlayerGenerationConfig
}

export type PlayerPopulationMetadata = {
  seed: string
  context: PlayerPopulationContext
  count: number
  startIndex: number
  identityMode: PlayerIdentityMode
  playerGenerationVersion: number
  identityGeneratorVersion: number
}

export type PlayerPopulationResult = {
  metadata: PlayerPopulationMetadata
  results: PlayerGenerationResult[]
}

const contextKinds: PlayerPopulationContextKind[] = [
  "lab",
  "initial-league",
  "draft-class",
  "free-agent-pool",
]

function validateInput(input: PlayerPopulationInput) {
  if (input.seed.trim().length === 0) {
    throw new Error("Player population seed must not be empty.")
  }

  if (input.context.id.trim().length === 0) {
    throw new Error("Player population context ID must not be empty.")
  }

  if (!contextKinds.includes(input.context.kind)) {
    throw new Error("Player population context kind is invalid.")
  }

  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new Error("Player population count must be a positive integer.")
  }

  const startIndex = input.startIndex ?? 1
  if (!Number.isInteger(startIndex) || startIndex < 1) {
    throw new Error("Player population start index must be a positive integer.")
  }

  if (input.identityMode !== "generated" && input.identityMode !== "none") {
    throw new Error("Player population identity mode is invalid.")
  }
}

export function generatePlayerPopulation(
  input: PlayerPopulationInput
): PlayerPopulationResult {
  validateInput(input)

  const startIndex = input.startIndex ?? 1
  const results = Array.from({ length: input.count }, (_, offset) => {
    const index = startIndex + offset
    const playerSeed = `${input.seed}:player:${index}`
    const identity =
      input.identityMode === "generated"
        ? generatePlayerIdentity(playerSeed)
        : { firstName: null, lastName: null }

    return generatePlayerWithDiagnostics(
      createDeterministicRandom(playerSeed),
      {
        id: `${input.context.id}:player:${index}`,
        identity,
      },
      input.config
    )
  })

  const ids = new Set(results.map(({ player }) => player.id))
  if (ids.size !== results.length) {
    throw new Error("Generated player IDs must be unique within a population.")
  }

  return {
    metadata: {
      seed: input.seed,
      context: { ...input.context },
      count: input.count,
      startIndex,
      identityMode: input.identityMode,
      playerGenerationVersion: input.config.version,
      identityGeneratorVersion: PLAYER_IDENTITY_GENERATOR_VERSION,
    },
    results,
  }
}
