export type RandomSource = {
  next(): number
  int(min: number, max: number): number
  normal(mean: number, deviation: number): number
  fork(scope: string): RandomSource
}

export type RandomSourceOptions = {
  mode: "normal" | "deterministic-lab"
  seed?: string
}

function hashSeed(seed: string): number {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeed(): string {
  const cryptoApi = (
    globalThis as typeof globalThis & {
      crypto?: {
        getRandomValues?: (values: Uint32Array) => Uint32Array
      }
    }
  ).crypto

  if (cryptoApi?.getRandomValues) {
    const values = cryptoApi.getRandomValues(new Uint32Array(2))
    return `${values[0]}:${values[1]}`
  }

  // This fallback is only for runtimes without Web Crypto. Simulation code
  // still receives the resulting source explicitly and never calls Math.random.
  return `${Date.now()}:${Math.random()}`
}

function createSeededSource(seed: string): RandomSource {
  let state = hashSeed(seed)

  function next(): number {
    state = Math.imul(state ^ (state >>> 16), 2246822507)
    state = Math.imul(state ^ (state >>> 13), 3266489909)
    state ^= state >>> 16
    return (state >>> 0) / 4294967296
  }

  function int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new RangeError("Random integer bounds must be ordered integers.")
    }

    return Math.floor(next() * (max - min + 1)) + min
  }

  function normal(mean: number, deviation: number): number {
    if (!Number.isFinite(mean) || !Number.isFinite(deviation) || deviation < 0) {
      throw new RangeError("Normal distribution parameters are invalid.")
    }

    if (deviation === 0) {
      return mean
    }

    const u = Math.max(next(), Number.EPSILON)
    const v = next()
    const standardNormal =
      Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)

    return mean + standardNormal * deviation
  }

  function fork(scope: string): RandomSource {
    if (!scope) {
      throw new Error("Random source scopes must not be empty.")
    }

    return createSeededSource(`${seed}:${scope}`)
  }

  return { next, int, normal, fork }
}

export function createDeterministicRandom(seed: string): RandomSource {
  if (!seed) {
    throw new Error("Deterministic random sources require a seed.")
  }

  return createSeededSource(seed)
}

export function createRuntimeRandom(): RandomSource {
  return createSeededSource(createSeed())
}

export function createRandomSource(options: RandomSourceOptions): RandomSource {
  if (options.mode === "deterministic-lab") {
    return createDeterministicRandom(options.seed ?? "")
  }

  return createRuntimeRandom()
}
