import type {
  PlayerGenerationConfig,
  PlayerPopulationPreset,
  PlayerPopulationPresetId,
} from "./types"

export const PLAYER_POPULATION_PRESET_VERSION = 1

export const STANDARD_PLAYER_GENERATION_CONFIG: PlayerGenerationConfig = {
  version: 4,
  age: { min: 19, max: 34 },
  ratingBounds: {
    min: 25,
    max: 92,
  },
  talentDistribution: {
    center: 50,
    spread: 10,
    shape: "long-tailed",
  },
  starTailFrequency: {
    above70: 0.1,
    above80: 0.02,
    above90: 0.002,
  },
  physical: {
    heightInches: { min: 70, max: 90 },
    weightPounds: { min: 160, max: 300 },
    wingspanInches: { min: 68, max: 98 },
    speed: { min: 25, max: 92 },
    strength: { min: 25, max: 92 },
    vertical: { min: 25, max: 92 },
  },
  development: {
    potential: {
      center: 8,
      spread: 5,
      maxHeadroom: 25,
      shape: "long-tailed",
    },
    rating: {
      center: 55,
      spread: 15,
      shape: "long-tailed",
    },
    volatility: {
      center: 35,
      spread: 20,
      shape: "long-tailed",
    },
  },
  classification: {
    minPositionFit: 60,
    maxSecondaryPositionGap: 8,
    minArchetypeFit: 60,
    minSecondaryArchetypeFit: 58,
    maxSecondaryArchetypeGap: 6,
  },
  traitFrequency: 0.35,
  availableTraits: [
    "hard-worker",
    "leader",
    "loyal",
    "undisciplined",
    "volatile",
    "adaptable",
    "injury-prone",
  ],
  skillCorrelations: [
    { first: "passing", second: "basketballIQ", strength: 0.45 },
    { first: "handling", second: "passing", strength: 0.35 },
    { first: "defense", second: "basketballIQ", strength: 0.3 },
    { first: "finishing", second: "handling", strength: 0.25 },
    { first: "rebounding", second: "defense", strength: 0.2 },
    { first: "shooting", second: "finishing", strength: 0.1 },
  ],
}

const INITIAL_FREE_AGENT_CONFIG: PlayerGenerationConfig = {
  ...structuredClone(STANDARD_PLAYER_GENERATION_CONFIG),
  age: { min: 20, max: 36 },
  talentDistribution: {
    center: 43,
    spread: 9,
    shape: "long-tailed",
  },
  starTailFrequency: {
    above70: 0.02,
    above80: 0.002,
    above90: 0,
  },
  development: {
    ...structuredClone(STANDARD_PLAYER_GENERATION_CONFIG.development),
    potential: {
      center: 5,
      spread: 4,
      maxHeadroom: 15,
      shape: "long-tailed",
    },
    rating: {
      center: 45,
      spread: 15,
      shape: "long-tailed",
    },
    volatility: {
      center: 30,
      spread: 18,
      shape: "long-tailed",
    },
  },
}

const DRAFT_CLASS_CONFIG: PlayerGenerationConfig = {
  ...structuredClone(STANDARD_PLAYER_GENERATION_CONFIG),
  age: { min: 18, max: 23 },
  talentDistribution: {
    center: 44,
    spread: 11,
    shape: "long-tailed",
  },
  starTailFrequency: {
    above70: 0.08,
    above80: 0.015,
    above90: 0.001,
  },
  development: {
    ...structuredClone(STANDARD_PLAYER_GENERATION_CONFIG.development),
    potential: {
      center: 14,
      spread: 7,
      maxHeadroom: 30,
      shape: "long-tailed",
    },
    rating: {
      center: 65,
      spread: 18,
      shape: "long-tailed",
    },
    volatility: {
      center: 50,
      spread: 22,
      shape: "long-tailed",
    },
  },
}

const PLAYER_POPULATION_PRESETS: Record<
  PlayerPopulationPresetId,
  PlayerPopulationPreset
> = {
  "initial-roster": {
    version: PLAYER_POPULATION_PRESET_VERSION,
    id: "initial-roster",
    label: "Initial roster",
    defaultCount: 450,
    contextKind: "initial-league",
    config: structuredClone(STANDARD_PLAYER_GENERATION_CONFIG),
  },
  "initial-free-agents": {
    version: PLAYER_POPULATION_PRESET_VERSION,
    id: "initial-free-agents",
    label: "Initial free agents",
    defaultCount: 100,
    contextKind: "free-agent-pool",
    config: INITIAL_FREE_AGENT_CONFIG,
  },
  "draft-class": {
    version: PLAYER_POPULATION_PRESET_VERSION,
    id: "draft-class",
    label: "Draft class",
    defaultCount: 90,
    contextKind: "draft-class",
    config: DRAFT_CLASS_CONFIG,
  },
}

export function createPlayerPopulationPreset(
  id: PlayerPopulationPresetId
): PlayerPopulationPreset {
  return structuredClone(PLAYER_POPULATION_PRESETS[id])
}

export function createStandardPlayerGenerationConfig(): PlayerGenerationConfig {
  return createPlayerPopulationPreset("initial-roster").config
}
