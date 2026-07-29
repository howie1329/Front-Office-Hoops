import type {
  NumericRange,
  PlayerEntity,
  PlayerGenerationConfig,
} from "@workspace/domain-v2"
import { STANDARD_PLAYER_GENERATION_CONFIG } from "@workspace/domain-v2"

import type { RandomSource } from "./randomness"

export type PlayerGenerationInput = {
  id: string
  name: string
  age?: number
}

function clamp(value: number, range: NumericRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}

function drawInteger(
  random: RandomSource,
  range: NumericRange,
  mean: number,
  spread: number
): number {
  return Math.round(clamp(random.normal(mean, spread), range))
}

function drawTalent(
  random: RandomSource,
  config: PlayerGenerationConfig
): number {
  const roll = random.next()
  const { above70, above80, above90 } = config.starTailFrequency
  const bounds = config.ratingBounds

  if (roll < above90) {
    return drawInteger(random, bounds, bounds.max - 1, 1)
  }

  if (roll < above80) {
    return drawInteger(random, bounds, 85, 3)
  }

  if (roll < above70) {
    return drawInteger(random, bounds, 74, 3)
  }

  return drawInteger(
    random,
    bounds,
    config.talentDistribution.center,
    config.talentDistribution.spread
  )
}

function drawTraits(
  random: RandomSource,
  config: PlayerGenerationConfig
): string[] {
  if (
    config.availableTraits.length === 0 ||
    random.next() >= config.traitFrequency
  ) {
    return []
  }

  const trait =
    config.availableTraits[random.int(0, config.availableTraits.length - 1)]

  return trait ? [trait] : []
}

export function generatePlayer(
  random: RandomSource,
  input: PlayerGenerationInput,
  config: PlayerGenerationConfig = STANDARD_PLAYER_GENERATION_CONFIG
): PlayerEntity {
  const talentRandom = random.fork("talent")
  const physicalRandom = random.fork("physical")
  const skillRandom = random.fork("skills")
  const developmentRandom = random.fork("development")
  const traitRandom = random.fork("traits")
  const age =
    input.age ??
    random.int(
      Math.ceil(config.age.min),
      Math.floor(config.age.max),
    )

  const talent = drawTalent(talentRandom, config)
  const skills = {
    shooting: drawInteger(
      skillRandom.fork("shooting"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    finishing: drawInteger(
      skillRandom.fork("finishing"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    passing: drawInteger(
      skillRandom.fork("passing"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    handling: drawInteger(
      skillRandom.fork("handling"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    rebounding: drawInteger(
      skillRandom.fork("rebounding"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    defense: drawInteger(
      skillRandom.fork("defense"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    basketballIQ: drawInteger(
      skillRandom.fork("basketballIQ"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
    stamina: drawInteger(
      skillRandom.fork("stamina"),
      config.ratingBounds,
      talent,
      config.talentDistribution.spread * 0.55
    ),
  }

  const heightInches = drawInteger(
    physicalRandom.fork("height"),
    config.physical.heightInches,
    80,
    4
  )

  return {
    id: input.id,
    name: input.name,
    age,
    profile: {
      physical: {
        heightInches,
        weightPounds: drawInteger(
          physicalRandom.fork("weight"),
          config.physical.weightPounds,
          165 + (heightInches - 70) * 6,
          12
        ),
        wingspanInches: drawInteger(
          physicalRandom.fork("wingspan"),
          config.physical.wingspanInches,
          heightInches + 2,
          3
        ),
        speed: drawInteger(
          physicalRandom.fork("speed"),
          config.physical.speed,
          talent,
          12
        ),
        strength: drawInteger(
          physicalRandom.fork("strength"),
          config.physical.strength,
          talent,
          12
        ),
        vertical: drawInteger(
          physicalRandom.fork("vertical"),
          config.physical.vertical,
          talent,
          12
        ),
      },
      skills,
      injuryResistance: drawInteger(
        physicalRandom.fork("injury-resistance"),
        config.ratingBounds,
        60,
        14
      ),
      development: {
        rating: drawInteger(
          developmentRandom.fork("rating"),
          config.ratingBounds,
          config.development.rating.center,
          config.development.rating.spread
        ),
        volatility: drawInteger(
          developmentRandom.fork("volatility"),
          config.ratingBounds,
          config.development.volatility.center,
          config.development.volatility.spread
        ),
      },
      traits: drawTraits(traitRandom, config),
    },
  }
}
