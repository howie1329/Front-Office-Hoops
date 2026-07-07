import type { PlayerMood } from "@workspace/shared/playerTypes"

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function traitFromSeed(seed: string, salt: string): number {
  const hash = hashString(`${seed}:${salt}`)
  return 40 + (hash % 41)
}

export function seedPlayerMood(playerId: string): PlayerMood {
  return {
    money: traitFromSeed(playerId, "money"),
    winning: traitFromSeed(playerId, "winning"),
    loyalty: traitFromSeed(playerId, "loyalty"),
    fame: traitFromSeed(playerId, "fame"),
  }
}

export const DEFAULT_PLAYER_MOOD: PlayerMood = {
  money: 60,
  winning: 60,
  loyalty: 60,
  fame: 60,
}
