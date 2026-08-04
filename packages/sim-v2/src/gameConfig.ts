import type {
  GameSimulationConfig,
  GameSimulationPresetId,
} from "@workspace/domain-v2"

type NumericSettingMap = {
  environment:
    | "pace"
    | "scoringEnvironment"
    | "gameVariance"
    | "talentSeparation"
    | "homeCourtAdvantage"
  offense:
    | "threePointRate"
    | "rimRate"
    | "midrangeRate"
    | "shotSelectionDiscipline"
    | "starUsage"
    | "ballMovement"
    | "isolationRate"
    | "transitionRate"
    | "offensiveRebounding"
  defense:
    | "pressure"
    | "helpDefense"
    | "switching"
    | "doubleTeamRate"
    | "turnoverPressure"
    | "foulDiscipline"
  rotation: "adherence" | "benchUsage" | "starterWorkload" | "fatigueImpact"
  coaching:
    | "influence"
    | "paceInfluence"
    | "shotSelectionInfluence"
    | "defensiveInfluence"
  injuries: "maxGamesOut"
}

export type GameNumericSettingPath = {
  [
    Section in keyof NumericSettingMap
  ]: `${Section}.${NumericSettingMap[Section]}`
}[keyof NumericSettingMap]

export type GameSettingDescriptor = {
  path: GameNumericSettingPath
  label: string
  description: string
  min: number
  max: number
  step: number
}

export const GAME_SIMULATION_VERSION = 2

export const STANDARD_GAME_SIMULATION_CONFIG: GameSimulationConfig = {
  version: GAME_SIMULATION_VERSION,
  presetId: "standard",
  environment: {
    pace: 50,
    scoringEnvironment: 50,
    gameVariance: 35,
    talentSeparation: 65,
    homeCourtAdvantage: 55,
  },
  offense: {
    threePointRate: 55,
    rimRate: 50,
    midrangeRate: 35,
    shotSelectionDiscipline: 60,
    starUsage: 60,
    ballMovement: 55,
    isolationRate: 35,
    transitionRate: 50,
    offensiveRebounding: 45,
  },
  defense: {
    pressure: 50,
    helpDefense: 55,
    switching: 45,
    doubleTeamRate: 25,
    turnoverPressure: 50,
    foulDiscipline: 55,
  },
  rotation: {
    adherence: 70,
    benchUsage: 45,
    starterWorkload: 55,
    fatigueImpact: 40,
  },
  coaching: {
    influence: 50,
    paceInfluence: 45,
    shotSelectionInfluence: 45,
    defensiveInfluence: 45,
  },
  injuries: {
    frequency: "rare",
    severity: "minor",
    maxGamesOut: 6,
    inGameInjuries: true,
  },
  overtime: {
    enabled: true,
    segmentMinutes: 5,
    maxSegments: 6,
  },
}

export const GAME_SETTING_DESCRIPTORS: GameSettingDescriptor[] = [
  {
    path: "environment.pace",
    label: "Pace",
    description: "Controls the number of possessions in a game.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "environment.scoringEnvironment",
    label: "Scoring environment",
    description: "Moves the league scoring baseline up or down.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "environment.gameVariance",
    label: "Game variance",
    description: "Controls how much outcomes move around player skill.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "environment.talentSeparation",
    label: "Talent separation",
    description: "Controls how strongly ability differences show up in games.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "environment.homeCourtAdvantage",
    label: "Home-court advantage",
    description: "Adds a bounded home-team efficiency and pace edge.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.threePointRate",
    label: "Three-point rate",
    description: "Changes how often possessions produce three-point attempts.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.rimRate",
    label: "Rim rate",
    description: "Changes how often possessions attack the rim.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.midrangeRate",
    label: "Mid-range rate",
    description: "Changes how often possessions create mid-range attempts.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.shotSelectionDiscipline",
    label: "Shot-selection discipline",
    description: "Rewards players and coaches for creating better attempts.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.starUsage",
    label: "Star usage",
    description: "Controls how much creation load concentrates around stars.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.ballMovement",
    label: "Ball movement",
    description: "Changes passing opportunities and assisted scoring.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.isolationRate",
    label: "Isolation rate",
    description: "Changes how often a creator finishes without a pass.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.transitionRate",
    label: "Transition rate",
    description: "Changes how often teams create early-offense attempts.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "offense.offensiveRebounding",
    label: "Offensive rebounding",
    description: "Changes how aggressively teams pursue second chances.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.pressure",
    label: "Defensive pressure",
    description: "Changes shot quality, turnovers, and foul tradeoffs.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.helpDefense",
    label: "Help defense",
    description: "Changes rim contests, blocks, and rebounding position.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.turnoverPressure",
    label: "Turnover pressure",
    description: "Changes how aggressively defenders force mistakes.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.switching",
    label: "Switching",
    description: "Changes how often defenders exchange assignments.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.doubleTeamRate",
    label: "Double-team rate",
    description:
      "Changes how often defenses send a second defender at creators.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "defense.foulDiscipline",
    label: "Foul discipline",
    description: "Changes the tradeoff between pressure and defensive fouls.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "rotation.adherence",
    label: "Rotation adherence",
    description: "Keeps actual minutes close to target minutes.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "rotation.benchUsage",
    label: "Bench usage",
    description: "Changes how much non-starter opportunity teams use.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "rotation.starterWorkload",
    label: "Starter workload",
    description: "Changes how strongly target minutes favor starters.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "rotation.fatigueImpact",
    label: "Fatigue impact",
    description: "Changes how much long stints affect late-game output.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "coaching.influence",
    label: "Coaching influence",
    description: "Scales the effect of the team coaching profile.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "coaching.paceInfluence",
    label: "Coach pace influence",
    description: "Scales how much coach pace changes team possessions.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "coaching.shotSelectionInfluence",
    label: "Coach shot selection",
    description: "Scales how much coaches change shot profile behavior.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "coaching.defensiveInfluence",
    label: "Coach defensive influence",
    description: "Scales how much coaches change defensive behavior.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    path: "injuries.maxGamesOut",
    label: "Maximum games out",
    description: "Caps the duration of a generated minor injury.",
    min: 0,
    max: 20,
    step: 1,
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function normalizeSection<T extends Record<string, number>>(section: T): T {
  return Object.fromEntries(
    Object.entries(section).map(([key, value]) => [key, clamp(value, 0, 100)])
  ) as T
}

export function cloneGameSimulationConfig(
  config: GameSimulationConfig
): GameSimulationConfig {
  return structuredClone(config)
}

export function getGameNumericSetting(
  config: GameSimulationConfig,
  path: GameNumericSettingPath
): number {
  const [section, key] = path.split(".") as [keyof NumericSettingMap, string]
  const value = (config[section] as Record<string, unknown>)[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Game simulation setting " + path + " is not numeric.")
  }
  return value
}

export function updateGameNumericSetting(
  config: GameSimulationConfig,
  path: GameNumericSettingPath,
  value: number
): GameSimulationConfig {
  const descriptor = GAME_SETTING_DESCRIPTORS.find(
    (candidate) => candidate.path === path
  )
  if (!descriptor) {
    throw new Error("Unknown game simulation setting " + path + ".")
  }

  const next = cloneGameSimulationConfig(config)
  const [section, key] = path.split(".") as [keyof NumericSettingMap, string]
  const target = next[section] as Record<string, unknown>
  target[key] = clamp(value, descriptor.min, descriptor.max)
  next.presetId = "custom"
  return next
}

export function createStandardGameSimulationConfig(): GameSimulationConfig {
  return cloneGameSimulationConfig(STANDARD_GAME_SIMULATION_CONFIG)
}

export function resolveGameSimulationConfig(
  config: GameSimulationConfig | undefined,
  presetId: GameSimulationPresetId = config?.presetId ?? "standard"
): GameSimulationConfig {
  const source = config ?? STANDARD_GAME_SIMULATION_CONFIG

  return {
    ...source,
    version: GAME_SIMULATION_VERSION,
    presetId,
    environment: normalizeSection(source.environment),
    offense: normalizeSection(source.offense),
    defense: normalizeSection(source.defense),
    rotation: normalizeSection(source.rotation),
    coaching: normalizeSection(source.coaching),
    injuries: {
      ...source.injuries,
      maxGamesOut: Math.round(clamp(source.injuries.maxGamesOut, 0, 82)),
    },
    overtime: {
      enabled: source.overtime.enabled,
      segmentMinutes: Math.round(clamp(source.overtime.segmentMinutes, 1, 20)),
      maxSegments: Math.round(clamp(source.overtime.maxSegments, 1, 20)),
    },
  }
}
