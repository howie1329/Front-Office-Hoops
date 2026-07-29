import type {
  NumericRange,
  PlayerEntity,
  PlayerGenerationConfig,
  PlayerIdentity,
  PlayerSkillKey,
  PlayerSkills,
} from "@workspace/domain-v2"
import { STANDARD_PLAYER_GENERATION_CONFIG } from "@workspace/domain-v2"

import type { RandomSource } from "./randomness"
import { derivePlayerRole } from "./playerRole"
import type { PlayerRoleDiagnostics } from "./playerRole"

export type PlayerGenerationInput = {
  id: string
  identity?: PlayerIdentity
  age?: number
}

export type PlayerGenerationTier =
  "standard" | "70-plus" | "80-plus" | "90-plus"

export type PlayerGenerationDiagnostics = {
  latentTalent: number
  talentTier: PlayerGenerationTier
  currentAbility: number
  potentialBase: number
  potentialUpside: number
  rawSkills: PlayerSkills
  role: PlayerRoleDiagnostics
}

export type PlayerGenerationResult = {
  player: PlayerEntity
  diagnostics: PlayerGenerationDiagnostics
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

function getTalentTier(talent: number): PlayerGenerationTier {
  if (talent >= 90) {
    return "90-plus"
  }

  if (talent >= 80) {
    return "80-plus"
  }

  if (talent >= 70) {
    return "70-plus"
  }

  return "standard"
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

const playerSkillKeys: PlayerSkillKey[] = [
  "shooting",
  "finishing",
  "passing",
  "handling",
  "rebounding",
  "defense",
  "basketballIQ",
  "stamina",
]

function applySkillCorrelations(
  rawSkills: PlayerSkills,
  talent: number,
  config: PlayerGenerationConfig
): PlayerSkills {
  const correlated = { ...rawSkills }

  for (const key of playerSkillKeys) {
    const relationships = config.skillCorrelations.filter(
      (correlation) => correlation.first === key || correlation.second === key
    )

    if (relationships.length === 0) {
      continue
    }

    const totalWeight = relationships.reduce(
      (sum, relationship) => sum + Math.abs(relationship.strength),
      0
    )
    const neighborDeviation = relationships.reduce((sum, relationship) => {
      const neighbor =
        relationship.first === key ? relationship.second : relationship.first

      return sum + relationship.strength * (rawSkills[neighbor] - talent)
    }, 0)
    const coupling = Math.min(0.6, totalWeight * 0.3)
    const ownDeviation = rawSkills[key] - talent
    const adjusted =
      talent +
      ownDeviation * (1 - coupling) +
      (neighborDeviation / totalWeight) * coupling

    correlated[key] = Math.round(clamp(adjusted, config.ratingBounds))
  }

  return correlated
}

function getCurrentAbility(skills: PlayerSkills): number {
  const total = playerSkillKeys.reduce((sum, key) => sum + skills[key], 0)

  return Math.round(total / playerSkillKeys.length)
}

export function generatePlayerWithDiagnostics(
  random: RandomSource,
  input: PlayerGenerationInput,
  config: PlayerGenerationConfig = STANDARD_PLAYER_GENERATION_CONFIG
): PlayerGenerationResult {
  const talentRandom = random.fork("talent")
  const physicalRandom = random.fork("physical")
  const skillRandom = random.fork("skills")
  const developmentRandom = random.fork("development")
  const traitRandom = random.fork("traits")
  const age =
    input.age ??
    random.int(Math.ceil(config.age.min), Math.floor(config.age.max))

  const talent = drawTalent(talentRandom, config)
  const rawSkills: PlayerSkills = {
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
  const skills = applySkillCorrelations(rawSkills, talent, config)
  const currentAbility = getCurrentAbility(skills)
  const potentialBase = Math.max(currentAbility, talent)
  const rolledPotentialUpside = drawInteger(
    developmentRandom.fork("potential"),
    { min: 0, max: config.development.potential.maxHeadroom },
    config.development.potential.center,
    config.development.potential.spread
  )
  const potential = Math.round(
    clamp(potentialBase + rolledPotentialUpside, config.ratingBounds)
  )
  const potentialUpside = potential - potentialBase

  const heightInches = drawInteger(
    physicalRandom.fork("height"),
    config.physical.heightInches,
    80,
    4
  )

  const physical = {
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
  }
  const development = {
    potential,
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
  }
  const roleResult = derivePlayerRole({ physical, skills }, config)

  const player: PlayerEntity = {
    id: input.id,
    identity: input.identity ?? {
      firstName: null,
      lastName: null,
    },
    age,
    profile: {
      physical,
      skills,
      role: roleResult.role,
      injuryResistance: drawInteger(
        physicalRandom.fork("injury-resistance"),
        config.ratingBounds,
        60,
        14
      ),
      development,
      traits: drawTraits(traitRandom, config),
    },
  }

  return {
    player,
    diagnostics: {
      latentTalent: talent,
      talentTier: getTalentTier(talent),
      currentAbility,
      potentialBase,
      potentialUpside,
      rawSkills,
      role: roleResult.diagnostics,
    },
  }
}

export function generatePlayer(
  random: RandomSource,
  input: PlayerGenerationInput,
  config: PlayerGenerationConfig = STANDARD_PLAYER_GENERATION_CONFIG
): PlayerEntity {
  return generatePlayerWithDiagnostics(random, input, config).player
}
