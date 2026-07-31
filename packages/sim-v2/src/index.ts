export { executeLeagueCommand } from "./executeCommand"
export {
  simulateGameMatchup,
  simulateGameMatchupWithTelemetry,
  validateGameMatchupFixture,
} from "./gameSimulation"
export {
  createStandardGameSimulationConfig,
  GAME_SETTING_DESCRIPTORS,
  GAME_SIMULATION_VERSION,
  getGameNumericSetting,
  resolveGameSimulationConfig,
  STANDARD_GAME_SIMULATION_CONFIG,
  updateGameNumericSetting,
} from "./gameConfig"
export {
  generatePlayer,
  generatePlayerWithDiagnostics,
  getPlayerCurrentAbility,
} from "./playerGeneration"
export {
  generatePlayerIdentity,
  PLAYER_IDENTITY_GENERATOR_VERSION,
} from "./playerIdentity"
export { generatePlayerPopulation } from "./playerPopulation"
export {
  generateInitialPlayerUniverse,
  INITIAL_PLAYER_UNIVERSE_VERSION,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
  validateInitialPlayerUniverse,
} from "./playerUniverse"
export {
  assembleInitialRosters,
  ROSTER_ASSEMBLY_VERSION,
  STANDARD_ROSTER_ASSEMBLY_CONFIG,
} from "./rosterAssembly"
export { derivePlayerRole } from "./playerRole"
export {
  createBalancedSeasonSchedule,
  createDefaultRotation,
  createDefaultSeasonFixture,
  createSeasonFixtureFromUniverse,
  createSeasonGameFixture,
} from "./seasonFixture"
export {
  createStandardSeasonProductionConfig,
  createStandardUniversalPlayerValueConfig,
  getValueSetting,
  resolveSeasonProductionConfig,
  SEASON_RUN_PRESETS,
  SEASON_PRODUCTION_VERSION,
  STANDARD_SEASON_PRODUCTION_CONFIG,
  STANDARD_UNIVERSAL_PLAYER_VALUE_CONFIG,
  updateValueSetting,
  VALUE_SETTING_DESCRIPTORS,
} from "./seasonConfig"
export { aggregateSeasonProduction } from "./production"
export { calculateUniversalPlayerValues } from "./playerValue"
export { runSeason } from "./seasonRunner"
export { advancePlayerCareerYear, getCareerPhase } from "./careerDevelopment"
export type { CareerDevelopmentInput } from "./careerDevelopment"
export { evaluatePlayerRetirement } from "./careerRetirement"
export type { CareerRetirementInput } from "./careerRetirement"
export {
  createDeterministicRandom,
  createRandomSource,
  createRuntimeRandom,
} from "./randomness"
export type { RandomSource, RandomSourceOptions } from "./randomness"
export type {
  GameNumericSettingPath,
  GameSettingDescriptor,
} from "./gameConfig"
export type { GameMatchupFixture, GameResult } from "@workspace/domain-v2"
export type {
  GameSimulationExecution,
  GameSimulationTelemetry,
  GameTeamSimulationTelemetry,
} from "./gameSimulation"
export type { PlayerPopulationContextKind } from "@workspace/domain-v2"
export type { WorkerRequest, WorkerResult } from "./protocol"
export type {
  PlayerGenerationDiagnostics,
  PlayerGenerationInput,
  PlayerGenerationResult,
  PlayerGenerationTier,
} from "./playerGeneration"
export type {
  PlayerIdentityMode,
  PlayerPopulationContext,
  PlayerPopulationInput,
  PlayerPopulationMetadata,
  PlayerPopulationResult,
} from "./playerPopulation"
export type {
  InitialPlayerUniverse,
  InitialPlayerUniverseConfig,
  InitialPlayerUniverseInput,
  InitialPlayerUniverseMetadata,
  PlayerUniverseValidationIssue,
} from "./playerUniverse"
export type { ProductionAggregation } from "./production"
export type { SeasonRunnerOptions } from "./seasonRunner"
export type { ValueSettingDescriptor, ValueSettingPath } from "./seasonConfig"
export type {
  RosterAssemblyConfig,
  RosterAssemblyDiagnostics,
  RosterAssemblyInput,
  RosterAssemblyPick,
  RosterAssemblyPickCandidate,
  RosterAssemblyResult,
  StrengthSummary,
  TeamAssemblyDiagnostics,
} from "./rosterAssembly"
export type { PlayerRoleDiagnostics, PlayerRoleResult } from "./playerRole"
