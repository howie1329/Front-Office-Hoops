import type { PlayerGenerationConfig } from "./types"

export const STANDARD_PLAYER_GENERATION_CONFIG: PlayerGenerationConfig = {
  version: 3,
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

export function createStandardPlayerGenerationConfig(): PlayerGenerationConfig {
  return structuredClone(STANDARD_PLAYER_GENERATION_CONFIG)
}
