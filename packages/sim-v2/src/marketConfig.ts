import type {
  ContractMarketConfig,
  EconomyConfig,
} from "@workspace/domain-v2"

export const ECONOMY_VERSION = 1
export const CONTRACT_MARKET_VERSION = 1

export const STANDARD_ECONOMY_CONFIG: EconomyConfig = {
  version: ECONOMY_VERSION,
  presetId: "nba-shaped-standard",
  minimumTeamSalaryPercent: 90,
  standardRaiseRate: 0.05,
  birdRaiseRate: 0.08,
  growth: {
    softCap: 165_000_000,
    taxLine: 200_000_000,
    hardCapLine: 225_000_000,
    minimumSalary: 1_200_000,
    maximumSalary: 57_750_000,
    rookieScale: 13_000_000,
  },
  annualGrowth: {
    softCap: 0.04,
    taxLine: 0.04,
    hardCapLine: 0.04,
    minimumSalary: 0.04,
    maximumSalary: 0.04,
    rookieScale: 0.04,
  },
}

export const STANDARD_CONTRACT_MARKET_CONFIG: ContractMarketConfig = {
  version: CONTRACT_MARKET_VERSION,
  presetId: "standard",
  freeAgencyRounds: 3,
  targetBoardSize: 8,
  marketRosterSlots: 3,
  lateMarketCleanup: true,
  minimumAcceptableUtility: 58,
  waitUtilityMargin: 8,
  maxScarcityAdjustment: 0.14,
  previousSalaryAnchor: 0.2,
  projectedGrowthWeight: 0.16,
  nonBirdSalaryMultiplier: 1.2,
  earlyBirdSalaryMultiplier: 1.75,
  preferenceWeights: {
    salary: 0.58,
    security: 0.12,
    winning: 0.08,
    role: 0.08,
    playingTime: 0.06,
    marketSize: 0.03,
    loyalty: 0.05,
  },
  willingness: {
    lowballPenalty: 18,
    closeOfferRecovery: 5,
    strongPreferenceRecovery: 3,
    lockoutThreshold: 24,
  },
}

export type MarketNumericSettingPath =
  | "economy.growth.softCap"
  | "economy.growth.taxLine"
  | "economy.growth.hardCapLine"
  | "economy.growth.minimumSalary"
  | "economy.growth.maximumSalary"
  | "economy.annualGrowth.softCap"
  | "economy.annualGrowth.taxLine"
  | "economy.annualGrowth.hardCapLine"
  | "economy.annualGrowth.minimumSalary"
  | "economy.annualGrowth.maximumSalary"
  | "market.maxScarcityAdjustment"
  | "market.previousSalaryAnchor"
  | "market.projectedGrowthWeight"
  | "market.nonBirdSalaryMultiplier"
  | "market.earlyBirdSalaryMultiplier"
  | "market.minimumAcceptableUtility"
  | "market.waitUtilityMargin"
  | "market.targetBoardSize"
  | "market.marketRosterSlots"

export type MarketSettingDescriptor = {
  path: MarketNumericSettingPath
  label: string
  description: string
  min: number
  max: number
  step: number
  unit: "$" | "%" | "points"
}

export const MARKET_SETTING_DESCRIPTORS: MarketSettingDescriptor[] = [
  {
    path: "economy.growth.softCap",
    label: "Soft cap",
    description: "Starting league-wide salary cap for the lab fixture.",
    min: 50_000_000,
    max: 300_000_000,
    step: 1_000_000,
    unit: "$",
  },
  {
    path: "economy.growth.taxLine",
    label: "Tax line",
    description: "Payroll above this line creates tax exposure.",
    min: 60_000_000,
    max: 350_000_000,
    step: 1_000_000,
    unit: "$",
  },
  {
    path: "economy.growth.minimumSalary",
    label: "Minimum salary",
    description: "Lowest legal annual salary in the initial market model.",
    min: 500_000,
    max: 10_000_000,
    step: 100_000,
    unit: "$",
  },
  {
    path: "economy.growth.maximumSalary",
    label: "Maximum salary",
    description: "Initial maximum annual salary boundary.",
    min: 10_000_000,
    max: 100_000_000,
    step: 500_000,
    unit: "$",
  },
  {
    path: "economy.annualGrowth.softCap",
    label: "Cap growth",
    description: "Annual growth applied to the soft cap.",
    min: 0,
    max: 0.1,
    step: 0.005,
    unit: "%",
  },
  {
    path: "market.maxScarcityAdjustment",
    label: "Scarcity influence",
    description: "Bound on supply-driven demand movement.",
    min: 0,
    max: 0.3,
    step: 0.01,
    unit: "%",
  },
  {
    path: "market.previousSalaryAnchor",
    label: "Salary continuity",
    description: "How strongly the previous salary anchors demand.",
    min: 0,
    max: 0.5,
    step: 0.01,
    unit: "%",
  },
  {
    path: "market.minimumAcceptableUtility",
    label: "Acceptance floor",
    description: "Minimum qualifying utility before a player accepts.",
    min: 0,
    max: 100,
    step: 1,
    unit: "points",
  },
  {
    path: "market.waitUtilityMargin",
    label: "Patience margin",
    description: "How far above the floor an offer can be while a player waits.",
    min: 0,
    max: 25,
    step: 1,
    unit: "points",
  },
  {
    path: "market.targetBoardSize",
    label: "AI target board",
    description: "Number of team-specific free-agent targets kept as fallback options.",
    min: 1,
    max: 20,
    step: 1,
    unit: "points",
  },
  {
    path: "market.marketRosterSlots",
    label: "Market roster slots",
    description: "Maximum number of new free agents each team can add in this lab run.",
    min: 0,
    max: 8,
    step: 1,
    unit: "points",
  },
]

export function getMarketNumericSetting(
  economy: EconomyConfig,
  market: ContractMarketConfig,
  path: MarketNumericSettingPath
): number {
  switch (path) {
    case "economy.growth.softCap":
      return economy.growth.softCap
    case "economy.growth.taxLine":
      return economy.growth.taxLine
    case "economy.growth.hardCapLine":
      return economy.growth.hardCapLine
    case "economy.growth.minimumSalary":
      return economy.growth.minimumSalary
    case "economy.growth.maximumSalary":
      return economy.growth.maximumSalary
    case "economy.annualGrowth.softCap":
      return economy.annualGrowth.softCap
    case "economy.annualGrowth.taxLine":
      return economy.annualGrowth.taxLine
    case "economy.annualGrowth.hardCapLine":
      return economy.annualGrowth.hardCapLine
    case "economy.annualGrowth.minimumSalary":
      return economy.annualGrowth.minimumSalary
    case "economy.annualGrowth.maximumSalary":
      return economy.annualGrowth.maximumSalary
    case "market.maxScarcityAdjustment":
      return market.maxScarcityAdjustment
    case "market.previousSalaryAnchor":
      return market.previousSalaryAnchor
    case "market.projectedGrowthWeight":
      return market.projectedGrowthWeight
    case "market.nonBirdSalaryMultiplier":
      return market.nonBirdSalaryMultiplier
    case "market.earlyBirdSalaryMultiplier":
      return market.earlyBirdSalaryMultiplier
    case "market.minimumAcceptableUtility":
      return market.minimumAcceptableUtility
    case "market.waitUtilityMargin":
      return market.waitUtilityMargin
    case "market.targetBoardSize":
      return market.targetBoardSize
    case "market.marketRosterSlots":
      return market.marketRosterSlots
  }
}

export function updateMarketNumericSetting(
  economy: EconomyConfig,
  market: ContractMarketConfig,
  path: MarketNumericSettingPath,
  value: number
): { economy: EconomyConfig; market: ContractMarketConfig } {
  const nextEconomy = structuredClone(economy)
  const nextMarket = structuredClone(market)
  const bounded = Number.isFinite(value) ? value : 0

  switch (path) {
    case "economy.growth.softCap":
      nextEconomy.growth.softCap = bounded
      break
    case "economy.growth.taxLine":
      nextEconomy.growth.taxLine = bounded
      break
    case "economy.growth.hardCapLine":
      nextEconomy.growth.hardCapLine = bounded
      break
    case "economy.growth.minimumSalary":
      nextEconomy.growth.minimumSalary = bounded
      break
    case "economy.growth.maximumSalary":
      nextEconomy.growth.maximumSalary = bounded
      break
    case "economy.annualGrowth.softCap":
      nextEconomy.annualGrowth.softCap = bounded
      break
    case "economy.annualGrowth.taxLine":
      nextEconomy.annualGrowth.taxLine = bounded
      break
    case "economy.annualGrowth.hardCapLine":
      nextEconomy.annualGrowth.hardCapLine = bounded
      break
    case "economy.annualGrowth.minimumSalary":
      nextEconomy.annualGrowth.minimumSalary = bounded
      break
    case "economy.annualGrowth.maximumSalary":
      nextEconomy.annualGrowth.maximumSalary = bounded
      break
    case "market.maxScarcityAdjustment":
      nextMarket.maxScarcityAdjustment = bounded
      break
    case "market.previousSalaryAnchor":
      nextMarket.previousSalaryAnchor = bounded
      break
    case "market.projectedGrowthWeight":
      nextMarket.projectedGrowthWeight = bounded
      break
    case "market.nonBirdSalaryMultiplier":
      nextMarket.nonBirdSalaryMultiplier = bounded
      break
    case "market.earlyBirdSalaryMultiplier":
      nextMarket.earlyBirdSalaryMultiplier = bounded
      break
    case "market.minimumAcceptableUtility":
      nextMarket.minimumAcceptableUtility = bounded
      break
    case "market.waitUtilityMargin":
      nextMarket.waitUtilityMargin = bounded
      break
    case "market.targetBoardSize":
      nextMarket.targetBoardSize = Math.round(bounded)
      break
    case "market.marketRosterSlots":
      nextMarket.marketRosterSlots = Math.round(bounded)
      break
  }

  return { economy: nextEconomy, market: nextMarket }
}
