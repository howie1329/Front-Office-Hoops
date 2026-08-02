import type {
  SeasonProductionConfig,
  SeasonRunPresetId,
  UniversalPlayerValueConfig,
} from "@workspace/domain-v2"

export const SEASON_PRODUCTION_VERSION = 1

export const STANDARD_UNIVERSAL_PLAYER_VALUE_CONFIG: UniversalPlayerValueConfig =
  {
    version: 1,
    horizonSeasons: 3,
    currentFormResponsiveness: 45,
    sampleConfidence: 65,
    currentAbilityEmphasis: 55,
    productionEmphasis: 55,
    trajectoryEmphasis: 35,
    upsideEmphasis: 25,
    durabilityImpact: 35,
    defenseEmphasis: 35,
    teamContextNormalization: 35,
  }

export const SEASON_RUN_PRESETS: Array<{
  id: SeasonRunPresetId
  label: string
  gamesPerTeam: number
  description: string
}> = [
  {
    id: "smoke",
    label: "Smoke",
    gamesPerTeam: 10,
    description: "Fast run for wiring and early-role checks.",
  },
  {
    id: "early",
    label: "Early season",
    gamesPerTeam: 25,
    description: "Enough games to inspect role and availability behavior.",
  },
  {
    id: "half",
    label: "Half season",
    gamesPerTeam: 41,
    description: "Midseason production and value checkpoint.",
  },
  {
    id: "full",
    label: "Full season",
    gamesPerTeam: 82,
    description: "Complete regular season for acceptance benchmarks.",
  },
  {
    id: "batch",
    label: "Batch",
    gamesPerTeam: 82,
    description: "Repeated full seasons for distribution calibration.",
  },
]

export const STANDARD_SEASON_PRODUCTION_CONFIG: SeasonProductionConfig = {
  version: SEASON_PRODUCTION_VERSION,
  presetId: "standard",
  runPreset: "full",
  gamesPerTeam: 82,
  schedule: {
    teamCount: 30,
    homeAwayBalanced: true,
    scheduleSeed: "production-value-schedule",
  },
  injuries: {
    mode: "standard",
  },
  development: {
    enabled: false,
  },
  playoffs: {
    enabled: false,
  },
  value: structuredClone(STANDARD_UNIVERSAL_PLAYER_VALUE_CONFIG),
}

export type ValueSettingPath =
  | "value.horizonSeasons"
  | "value.currentFormResponsiveness"
  | "value.sampleConfidence"
  | "value.currentAbilityEmphasis"
  | "value.productionEmphasis"
  | "value.trajectoryEmphasis"
  | "value.upsideEmphasis"
  | "value.durabilityImpact"
  | "value.defenseEmphasis"
  | "value.teamContextNormalization"

export type ValueSettingDescriptor = {
  path: ValueSettingPath
  label: string
  description: string
  min: number
  max: number
  step: number
}

export const VALUE_SETTING_DESCRIPTORS: ValueSettingDescriptor[] = [
  {
    path: "value.horizonSeasons",
    label: "Projection horizon",
    description: "How many future seasons the value projection considers.",
    min: 1,
    max: 5,
    step: 1,
  },
  {
    path: "value.currentFormResponsiveness",
    label: "Current-form responsiveness",
    description: "How quickly recent production changes the headline value.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.sampleConfidence",
    label: "Sample confidence",
    description: "How strongly sample size controls production trust.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.currentAbilityEmphasis",
    label: "Current ability",
    description: "How much the generated skill profile anchors value.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.productionEmphasis",
    label: "Recent production",
    description: "How much role-adjusted production affects value.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.trajectoryEmphasis",
    label: "Age and trajectory",
    description: "How much age and expected direction affect projection.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.upsideEmphasis",
    label: "Upside",
    description:
      "How much potential and development headroom affect projection.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.durabilityImpact",
    label: "Durability impact",
    description: "How strongly expected availability affects total value.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.defenseEmphasis",
    label: "Defensive production",
    description: "How much defensive events and context affect value.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "value.teamContextNormalization",
    label: "Team-context normalization",
    description: "How much pace, role, and environment adjust production.",
    min: 0,
    max: 100,
    step: 1,
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function createStandardUniversalPlayerValueConfig(): UniversalPlayerValueConfig {
  return structuredClone(STANDARD_UNIVERSAL_PLAYER_VALUE_CONFIG)
}

export function createStandardSeasonProductionConfig(
  runPreset: SeasonRunPresetId = "full"
): SeasonProductionConfig {
  const preset = SEASON_RUN_PRESETS.find((item) => item.id === runPreset)
  return {
    ...structuredClone(STANDARD_SEASON_PRODUCTION_CONFIG),
    runPreset,
    gamesPerTeam: preset?.gamesPerTeam ?? 82,
    value: createStandardUniversalPlayerValueConfig(),
  }
}

export function resolveSeasonProductionConfig(
  config?: SeasonProductionConfig
): SeasonProductionConfig {
  const source = config ?? STANDARD_SEASON_PRODUCTION_CONFIG
  const preset = SEASON_RUN_PRESETS.find((item) => item.id === source.runPreset)
  const value = source.value ?? STANDARD_UNIVERSAL_PLAYER_VALUE_CONFIG
  const gamesPerTeam = Math.round(
    clamp(
      preset && source.runPreset !== "batch"
        ? Math.min(source.gamesPerTeam, preset.gamesPerTeam)
        : source.gamesPerTeam,
      1,
      82
    )
  )
  return {
    ...structuredClone(source),
    version: SEASON_PRODUCTION_VERSION,
    gamesPerTeam,
    schedule: {
      ...source.schedule,
      teamCount: Math.round(clamp(source.schedule.teamCount, 2, 30)),
      homeAwayBalanced: Boolean(source.schedule.homeAwayBalanced),
      scheduleSeed:
        source.schedule.scheduleSeed.trim() ||
        STANDARD_SEASON_PRODUCTION_CONFIG.schedule.scheduleSeed,
    },
    injuries: {
      mode: source.injuries.mode === "off" ? "off" : "standard",
    },
    development: { enabled: false },
    playoffs: { enabled: false },
    value: {
      ...value,
      version: 1,
      horizonSeasons: Math.round(clamp(value.horizonSeasons, 1, 5)),
      currentFormResponsiveness: clamp(value.currentFormResponsiveness, 0, 100),
      sampleConfidence: clamp(value.sampleConfidence, 0, 100),
      currentAbilityEmphasis: clamp(value.currentAbilityEmphasis, 0, 100),
      productionEmphasis: clamp(value.productionEmphasis, 0, 100),
      trajectoryEmphasis: clamp(value.trajectoryEmphasis, 0, 100),
      upsideEmphasis: clamp(value.upsideEmphasis, 0, 100),
      durabilityImpact: clamp(value.durabilityImpact, 0, 100),
      defenseEmphasis: clamp(value.defenseEmphasis, 0, 100),
      teamContextNormalization: clamp(value.teamContextNormalization, 0, 100),
    },
    presetId: source.presetId === "custom" ? "custom" : "standard",
    runPreset: source.runPreset,
  }
}

export function getValueSetting(
  config: SeasonProductionConfig,
  path: ValueSettingPath
): number {
  const key = path.split(".")[1] as keyof UniversalPlayerValueConfig
  const value = config.value[key]
  if (typeof value !== "number") {
    throw new Error(`Value setting ${path} is not numeric.`)
  }
  return value
}

export function updateValueSetting(
  config: SeasonProductionConfig,
  path: ValueSettingPath,
  value: number
): SeasonProductionConfig {
  const descriptor = VALUE_SETTING_DESCRIPTORS.find(
    (candidate) => candidate.path === path
  )
  if (!descriptor) throw new Error(`Unknown value setting ${path}.`)
  const next = structuredClone(config)
  const key = path.split(".")[1] as keyof UniversalPlayerValueConfig
  next.value[key] = clamp(value, descriptor.min, descriptor.max) as never
  next.presetId = "custom"
  return next
}
