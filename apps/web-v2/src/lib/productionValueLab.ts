import type {
  GameSimulationConfig,
  SeasonFixture,
  SeasonProductionConfig,
  SeasonRunResult,
  SeasonRunPresetId,
  UniversalPlayerValue,
} from "@workspace/domain-v2"
import { productionValueLabReportSchema } from "@workspace/league-schema"
import {
  createDefaultSeasonFixture,
  createStandardGameSimulationConfig,
  createStandardSeasonProductionConfig,
  updateValueSetting,
} from "@workspace/sim-v2"
import type { ValueSettingPath } from "@workspace/sim-v2"

export const PRODUCTION_VALUE_LAB_REPORT_VERSION = 1

export type ProductionValueLabReport = {
  schema: "foh-production-value-lab"
  version: number
  baseSeed: string
  fixture: SeasonFixture
  result: SeasonRunResult
}

export type ProductionValueLabOptions = {
  seed: string
  runPreset?: SeasonRunPresetId
  config?: SeasonProductionConfig
  gameConfig?: GameSimulationConfig
}

export function createDefaultProductionValueLabFixture(
  options: ProductionValueLabOptions = { seed: "production-value-lab" }
): SeasonFixture {
  const runPreset = options.runPreset ?? options.config?.runPreset ?? "full"
  const config =
    options.config ?? createStandardSeasonProductionConfig(runPreset)
  const fixture = createDefaultSeasonFixture(options.seed, {
    runPreset,
    gameConfig: options.gameConfig ?? createStandardGameSimulationConfig(),
  })
  const gameConfig = structuredClone(options.gameConfig ?? fixture.gameConfig)
  if (config.injuries.mode === "off") {
    gameConfig.injuries.frequency = "off"
    gameConfig.injuries.inGameInjuries = false
  }
  return {
    ...fixture,
    gameConfig,
    config: {
      ...fixture.config,
      ...config,
      schedule: {
        ...fixture.config.schedule,
        ...config.schedule,
      },
      value: structuredClone(config.value),
    },
  }
}

export function updateProductionValueSetting(
  config: SeasonProductionConfig,
  path: ValueSettingPath,
  value: number
): SeasonProductionConfig {
  return updateValueSetting(config, path, value)
}

export function getPlayerValueAtCheckpoint(
  result: SeasonRunResult,
  playerId: string
): UniversalPlayerValue | null {
  const final = result.checkpoints.at(-1)
  return final?.values[playerId] ?? null
}

export function serializeProductionValueLabReport(
  fixture: SeasonFixture,
  result: SeasonRunResult
): string {
  const report: ProductionValueLabReport = {
    schema: "foh-production-value-lab",
    version: PRODUCTION_VALUE_LAB_REPORT_VERSION,
    baseSeed: fixture.seed,
    fixture,
    result,
  }
  return JSON.stringify(productionValueLabReportSchema.parse(report), null, 2)
}

export function getPopulationLabel(
  fixture: SeasonFixture,
  playerId: string
): string {
  if (fixture.populations.freeAgents.includes(playerId)) return "Free agent"
  if (fixture.populations.draftProspects.includes(playerId))
    return "Draft prospect"
  return "Current player"
}

export function getSeasonTeamName(
  fixture: SeasonFixture,
  teamId: string | null
): string {
  if (!teamId) return "Unassigned"
  return fixture.teams[teamId].name
}
