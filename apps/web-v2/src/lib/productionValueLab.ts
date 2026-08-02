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
    config,
    gameConfig: options.gameConfig ?? createStandardGameSimulationConfig(),
  })
  return fixture
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
  playerId: string,
  populationSets: {
    freeAgents: Set<string>
    draftProspects: Set<string>
  }
): string {
  if (populationSets.freeAgents.has(playerId)) return "Free agent"
  if (populationSets.draftProspects.has(playerId)) return "Draft prospect"
  return "Current player"
}

export function getSeasonTeamName(
  fixture: SeasonFixture,
  teamId: string | null
): string {
  if (!teamId) return "Unassigned"
  const teams = fixture.teams as Record<
    string,
    (typeof fixture.teams)[string] | undefined
  >
  return teams[teamId]?.name ?? "Unassigned"
}
