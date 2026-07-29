import {
  createStandardPlayerGenerationConfig,
  formatPlayerIdentity,
} from "@workspace/domain-v2"
import type {
  PlayerGenerationConfig,
  PlayerSkillKey,
} from "@workspace/domain-v2"
import { playerGenerationConfigSchema } from "@workspace/league-schema"
import {
  generatePlayerPopulation,
  PLAYER_IDENTITY_GENERATOR_VERSION,
} from "@workspace/sim-v2"
import type {
  PlayerGenerationResult,
  PlayerIdentityMode,
  PlayerPopulationContext,
  PlayerPopulationMetadata,
  PlayerPopulationResult,
} from "@workspace/sim-v2"

export type LabMode = "single" | "batch"

export type LabRunOptions = {
  seed: string
  mode: LabMode
  count: number
  sampleIndex: number
  identityMode: PlayerIdentityMode
  config: PlayerGenerationConfig
}

export const LAB_POPULATION_CONTEXT: PlayerPopulationContext = {
  kind: "lab",
  id: "player-generation-lab",
}

export type LabMetricKey =
  | "latentTalent"
  | "currentAbility"
  | "potentialGap"
  | "age"
  | "heightInches"
  | "weightPounds"
  | "wingspanInches"
  | "speed"
  | "strength"
  | "vertical"
  | PlayerSkillKey
  | "injuryResistance"
  | "potential"
  | "developmentRating"
  | "developmentVolatility"

export type LabMetric = {
  key: LabMetricKey
  label: string
  getValue: (result: PlayerGenerationResult) => number
}

export function formatRoleLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export const LAB_METRICS: Array<LabMetric> = [
  {
    key: "latentTalent",
    label: "Latent talent",
    getValue: (r) => r.diagnostics.latentTalent,
  },
  {
    key: "currentAbility",
    label: "Current ability",
    getValue: (r) => r.diagnostics.currentAbility,
  },
  {
    key: "potentialGap",
    label: "Potential gap",
    getValue: (r) =>
      r.player.profile.development.potential - r.diagnostics.currentAbility,
  },
  { key: "age", label: "Age", getValue: (r) => r.player.age },
  {
    key: "heightInches",
    label: "Height",
    getValue: (r) => r.player.profile.physical.heightInches,
  },
  {
    key: "weightPounds",
    label: "Weight",
    getValue: (r) => r.player.profile.physical.weightPounds,
  },
  {
    key: "wingspanInches",
    label: "Wingspan",
    getValue: (r) => r.player.profile.physical.wingspanInches,
  },
  {
    key: "speed",
    label: "Speed",
    getValue: (r) => r.player.profile.physical.speed,
  },
  {
    key: "strength",
    label: "Strength",
    getValue: (r) => r.player.profile.physical.strength,
  },
  {
    key: "vertical",
    label: "Vertical",
    getValue: (r) => r.player.profile.physical.vertical,
  },
  {
    key: "shooting",
    label: "Shooting",
    getValue: (r) => r.player.profile.skills.shooting,
  },
  {
    key: "finishing",
    label: "Finishing",
    getValue: (r) => r.player.profile.skills.finishing,
  },
  {
    key: "passing",
    label: "Passing",
    getValue: (r) => r.player.profile.skills.passing,
  },
  {
    key: "handling",
    label: "Handling",
    getValue: (r) => r.player.profile.skills.handling,
  },
  {
    key: "rebounding",
    label: "Rebounding",
    getValue: (r) => r.player.profile.skills.rebounding,
  },
  {
    key: "defense",
    label: "Defense",
    getValue: (r) => r.player.profile.skills.defense,
  },
  {
    key: "basketballIQ",
    label: "Basketball IQ",
    getValue: (r) => r.player.profile.skills.basketballIQ,
  },
  {
    key: "stamina",
    label: "Stamina",
    getValue: (r) => r.player.profile.skills.stamina,
  },
  {
    key: "injuryResistance",
    label: "Injury resistance",
    getValue: (r) => r.player.profile.injuryResistance,
  },
  {
    key: "potential",
    label: "Potential",
    getValue: (r) => r.player.profile.development.potential,
  },
  {
    key: "developmentRating",
    label: "Development rating",
    getValue: (r) => r.player.profile.development.rating,
  },
  {
    key: "developmentVolatility",
    label: "Volatility",
    getValue: (r) => r.player.profile.development.volatility,
  },
]

function getPopulationShape(options: LabRunOptions) {
  return options.mode === "single"
    ? { count: 1, startIndex: options.sampleIndex }
    : { count: options.count, startIndex: 1 }
}

export function createLabPopulation(
  options: LabRunOptions
): PlayerPopulationResult {
  return generatePlayerPopulation({
    seed: options.seed,
    context: LAB_POPULATION_CONTEXT,
    ...getPopulationShape(options),
    identityMode: options.identityMode,
    config: options.config,
  })
}

export function createLabPlayers(
  options: LabRunOptions
): Array<PlayerGenerationResult> {
  return createLabPopulation(options).results
}

export function getLabPlayerIndex(result: PlayerGenerationResult): number {
  const index = Number(result.player.id.split(":").at(-1))

  if (!Number.isInteger(index) || index < 1) {
    throw new Error(
      `Lab player ID has no valid sample index: ${result.player.id}`
    )
  }

  return index
}

export function getLabPlayerDisplayName(
  result: PlayerGenerationResult
): string {
  return (
    formatPlayerIdentity(result.player.identity) ??
    `Player ${String(getLabPlayerIndex(result)).padStart(3, "0")}`
  )
}

function getLabPopulationMetadata(
  options: LabRunOptions
): PlayerPopulationMetadata {
  const shape = getPopulationShape(options)

  return {
    seed: options.seed,
    context: { ...LAB_POPULATION_CONTEXT },
    ...shape,
    identityMode: options.identityMode,
    playerGenerationVersion: options.config.version,
    identityGeneratorVersion: PLAYER_IDENTITY_GENERATOR_VERSION,
  }
}

export function summarizeLabPlayers(results: Array<PlayerGenerationResult>) {
  const talentValues = results.map((result) => result.diagnostics.latentTalent)
  const currentAbilityValues = results.map(
    (result) => result.diagnostics.currentAbility
  )
  const potentialValues = results.map(
    (result) => result.player.profile.development.potential
  )
  const potentialGapValues = results.map(
    (result) =>
      result.player.profile.development.potential -
      result.diagnostics.currentAbility
  )
  const average = (values: Array<number>) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0
  const countBy = <T extends string>(values: Array<T>): Record<string, number> =>
    values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1
      return counts
    }, {})
  const primaryPositions = results.map(
    (result) => result.player.profile.role.primaryPosition
  )
  const primaryArchetypes = results.map(
    (result) => result.player.profile.role.primaryArchetype
  )

  return {
    count: results.length,
    averageTalent: average(talentValues),
    averageCurrentAbility: average(currentAbilityValues),
    averagePotential: average(potentialValues),
    averagePotentialGap: average(potentialGapValues),
    minimumTalent: talentValues.length ? Math.min(...talentValues) : 0,
    maximumTalent: talentValues.length ? Math.max(...talentValues) : 0,
    tierCounts: {
      standard: results.filter((r) => r.diagnostics.talentTier === "standard")
        .length,
      "70-plus": results.filter((r) => r.diagnostics.talentTier === "70-plus")
        .length,
      "80-plus": results.filter((r) => r.diagnostics.talentTier === "80-plus")
        .length,
      "90-plus": results.filter((r) => r.diagnostics.talentTier === "90-plus")
        .length,
    },
    traitRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.player.profile.traits.length > 0)
            .length / results.length,
    primaryPositionCounts: countBy(primaryPositions),
    primaryArchetypeCounts: countBy(primaryArchetypes),
    secondaryPositionRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.player.profile.role.secondaryPosition)
            .length / results.length,
    secondaryArchetypeRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.player.profile.role.secondaryArchetype)
            .length / results.length,
    lowPositionConfidenceRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.diagnostics.role.positionConfidence < 5)
            .length / results.length,
    lowArchetypeConfidenceRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.diagnostics.role.archetypeConfidence < 5)
            .length / results.length,
  }
}

export function getLabMetric(key: LabMetricKey): LabMetric {
  return LAB_METRICS.find((metric) => metric.key === key) ?? LAB_METRICS[0]
}

export function createHistogram(values: Array<number>, bucketCount = 8) {
  if (values.length === 0) {
    return []
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const width = maximum === minimum ? 1 : (maximum - minimum) / bucketCount

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = minimum + index * width
    const end = index === bucketCount - 1 ? maximum : start + width
    const count = values.filter((value) =>
      index === bucketCount - 1
        ? value >= start && value <= end
        : value >= start && value < end
    ).length

    return { label: `${Math.round(start)}–${Math.round(end)}`, count }
  })
}

export function validateLabConfig(
  config: PlayerGenerationConfig
): Array<string> {
  const result = playerGenerationConfigSchema.safeParse(config)
  const issues = result.success
    ? []
    : result.error.issues.map((issue) => issue.message)

  if (config.starTailFrequency.above70 < config.starTailFrequency.above80) {
    issues.push("70+ frequency must be at least as high as 80+ frequency.")
  }
  if (config.starTailFrequency.above80 < config.starTailFrequency.above90) {
    issues.push("80+ frequency must be at least as high as 90+ frequency.")
  }

  const pairs = config.skillCorrelations.map((correlation) =>
    [correlation.first, correlation.second].sort().join(":")
  )
  if (new Set(pairs).size !== pairs.length) {
    issues.push("Skill correlation pairs must be unique.")
  }
  if (
    config.skillCorrelations.some(
      (correlation) => correlation.first === correlation.second
    )
  ) {
    issues.push("A skill cannot be correlated with itself.")
  }

  return issues
}

export function createDefaultLabConfig() {
  return createStandardPlayerGenerationConfig()
}

export function serializeLabReport(
  options: LabRunOptions,
  results: Array<PlayerGenerationResult>
) {
  return JSON.stringify(
    {
      schema: "foh-player-generation-lab",
      version: 5,
      seed: options.seed,
      mode: options.mode,
      count: options.count,
      sampleIndex: options.sampleIndex,
      identityMode: options.identityMode,
      identityGeneratorVersion: PLAYER_IDENTITY_GENERATOR_VERSION,
      context: LAB_POPULATION_CONTEXT,
      population: getLabPopulationMetadata(options),
      config: options.config,
      results,
    },
    null,
    2
  )
}
