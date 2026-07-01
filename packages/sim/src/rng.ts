import type { Rng } from "@workspace/shared/types"

function hashSeed(seed: string | number): number {
  if (typeof seed === "number") {
    return seed >>> 0
  }

  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }

  return hash >>> 0
}

export function createRng(seed: string | number): Rng {
  let state = hashSeed(seed)

  const next = (): number => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    const lower = Math.ceil(min)
    const upper = Math.floor(max)
    return Math.floor(next() * (upper - lower + 1)) + lower
  }

  const normal = (mean = 0, stdDev = 1): number => {
    const u1 = next()
    const u2 = next()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stdDev
  }

  return { next, int, normal }
}
