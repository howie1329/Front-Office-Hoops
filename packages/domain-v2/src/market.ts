import type {
  PlayerArchetype,
  PlayerEntity,
  PlayerMarketProfile,
  PlayerPosition,
  TeamEntity,
} from "./types"
import type { UniversalPlayerValue } from "./seasonProduction"

export type Money = number

export type ContractPhase = "re-signing" | "extension" | "free-agency"

export type ContractSource =
  | "rookie-scale"
  | "free-agent"
  | "re-signing"
  | "extension"
  | "manual"

export type BirdRightsLevel = "none" | "non-bird" | "early-bird" | "bird"

export type FreeAgencyRights = {
  level: BirdRightsLevel
  teamId: string | null
  seasonsWithTeam: number
  lastContractId: string | null
}

export type ContractEntity = {
  id: string
  playerId: string
  teamId: string
  startSeason: number
  endSeason: number
  years: number
  annualSalary: Money[]
  fullyGuaranteed: true
  rights: FreeAgencyRights
  source: ContractSource
}

export type EconomyGrowthConfig = {
  softCap: number
  taxLine: number
  hardCapLine: number
  minimumSalary: number
  maximumSalary: number
  rookieScale: number
}

export type EconomyGrowthRates = {
  softCap: number
  taxLine: number
  hardCapLine: number
  minimumSalary: number
  maximumSalary: number
  rookieScale: number
}

export type EconomyConfig = {
  version: 1
  presetId: string
  minimumTeamSalaryPercent: number
  standardRaiseRate: number
  birdRaiseRate: number
  growth: EconomyGrowthConfig
  annualGrowth: EconomyGrowthRates
}

export type RookieScaleEntry = {
  slot: number
  salary: Money
}

export type EconomySnapshot = {
  version: 1
  season: number
  config: EconomyConfig
  softCap: Money
  taxLine: Money
  hardCapLine: Money
  minimumSalary: Money
  maximumSalary: Money
  minimumTeamSalary: Money
  rookieScale: RookieScaleEntry[]
  hardCapTriggered: boolean
}

export type ContractMarketConfig = {
  version: 1
  presetId: string
  freeAgencyRounds: number
  targetBoardSize: number
  lateMarketCleanup: boolean
  minimumAcceptableUtility: number
  waitUtilityMargin: number
  maxScarcityAdjustment: number
  previousSalaryAnchor: number
  projectedGrowthWeight: number
  nonBirdSalaryMultiplier: number
  earlyBirdSalaryMultiplier: number
  preferenceWeights: {
    salary: number
    security: number
    winning: number
    role: number
    playingTime: number
    marketSize: number
    loyalty: number
  }
  willingness: {
    lowballPenalty: number
    closeOfferRecovery: number
    strongPreferenceRecovery: number
    lockoutThreshold: number
  }
}

export type TeamMarketStrategy =
  | "rebuilding"
  | "developing"
  | "middle"
  | "contender"
  | "financially-constrained"

export type TeamMarketContext = {
  team: TeamEntity
  payroll: Money
  reservedSalary: Money
  capRoom: Money
  taxRoom: Money
  hardCapRoom: Money
  lastSeasonWins: number
  teamQuality: number
  marketSize: number
  roleOpportunity: number
  playingTimeProjection: number
  spendingTolerance: number
  strategy: TeamMarketStrategy
  positionalNeeds: Partial<Record<PlayerPosition, number>>
}

export type ProjectedFreeAgent = {
  playerId: string
  currentTeamId: string | null
  projectedSeason: number
  rights: FreeAgencyRights
  position: PlayerPosition
  archetype: PlayerArchetype
  qualityTier: "star" | "starter" | "rotation" | "depth"
}

export type ProjectedFreeAgencyView = {
  version: 1
  season: number
  entries: ProjectedFreeAgent[]
  supplyByPosition: Record<PlayerPosition, number>
  supplyByArchetype: Partial<Record<PlayerArchetype, number>>
}

export type NegotiationState = {
  playerId: string
  teamId: string
  periodKey: string
  willingness: number
  status: "active" | "locked-out"
  offersSubmitted: number
  lastOfferId: string | null
  reasonCodes: string[]
}

export type ContractOffer = {
  id: string
  playerId: string
  teamId: string
  season: number
  phase: ContractPhase
  round: number
  annualSalary: Money[]
  years: number
  fullyGuaranteed: true
  source: "user" | "ai" | "fixture"
}

export type ContractLegalityResult = {
  valid: boolean
  mechanism:
    | "cap-room"
    | "bird"
    | "early-bird"
    | "non-bird"
    | "minimum"
    | "rookie-scale"
    | "none"
  reasons: string[]
  projectedPayroll: Money
  capRoomAfterOffer: Money
  hardCapRoomAfterOffer: Money
}

export type ContractDemandBreakdown = {
  label: string
  amount: Money
  direction: "positive" | "negative" | "neutral"
  reason: string
}

export type ContractDemandResult = {
  playerId: string
  phase: ContractPhase
  baselineAnnualValue: Money
  lowAnnualValue: Money
  highAnnualValue: Money
  preferredYears: number
  projectedAnnualValue: Money
  scarcityMultiplier: number
  comparableTier: "star" | "starter" | "rotation" | "depth"
  breakdown: ContractDemandBreakdown[]
}

export type OfferUtilityBreakdown = {
  salary: number
  security: number
  winning: number
  role: number
  playingTime: number
  marketSize: number
  loyalty: number
  total: number
}

export type ContractOfferDecision = {
  offerId: string
  playerId: string
  teamId: string
  decision: "accept" | "wait" | "decline" | "refuse-further-negotiation"
  legal: ContractLegalityResult
  utility: OfferUtilityBreakdown
  willingnessBefore: number
  willingnessAfter: number
  reasonCodes: string[]
  summary: string
}

export type ContractMarketFixture = {
  version: 1
  seed: string
  season: number
  economy: EconomySnapshot
  config: ContractMarketConfig
  teams: Record<string, TeamEntity>
  players: Record<string, PlayerEntity>
  contracts: Record<string, ContractEntity>
  offers: Record<string, ContractOffer>
  values: Record<string, UniversalPlayerValue>
  teamContexts: Record<string, TeamMarketContext>
  projectedFreeAgency: ProjectedFreeAgencyView
  actualFreeAgentIds: string[]
  negotiationStates: Record<string, NegotiationState>
}

export type ContractMarketScenarioResult = {
  version: 1
  fixtureSeed: string
  playerId: string
  demand: ContractDemandResult
  offer: ContractOffer
  decision: ContractOfferDecision
  playerMarketProfile: PlayerMarketProfile
}
