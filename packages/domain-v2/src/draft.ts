import type {
  CareerDeclineCurve,
  CareerGrowthCurve,
  PlayerEntity,
  PlayerPosition,
  TeamEntity,
} from "./types"
import type { EconomySnapshot, ContractEntity } from "./market"

export type DraftScoutTier = "weak" | "average" | "strong"
export type DraftTeamMode = "contender" | "balanced" | "rebuilding"
export type DraftBoardSource = "generated" | "user"
export type DraftSelectionKind = "ai" | "user"

export type DraftScoutingConfig = {
  version: 1
  publicScoutTier: DraftScoutTier
  tierAccuracy: Record<DraftScoutTier, number>
  tierRangeWidth: Record<DraftScoutTier, number>
  categoryDifficulty: {
    currentAbility: number
    measurements: number
    potential: number
    developmentCurve: number
    volatility: number
    injuryResistance: number
    traits: number
  }
}

export type DraftScoutingEstimate = {
  currentAbility: number | null
  potential: number | null
  volatility: number | null
  peakAge: number | null
  declineStartAge: number | null
  growthCurve: CareerGrowthCurve | null
  declineCurve: CareerDeclineCurve | null
  injuryResistance: number | null
  measurements: {
    heightInches: number | null
    weightPounds: number | null
    wingspanInches: number | null
    speed: number | null
    strength: number | null
    vertical: number | null
  }
  positions: PlayerPosition[]
  traits: Array<{
    trait: string
    status: "confirmed" | "false-positive" | "false-negative" | "unknown"
  }>
}

export type DraftScoutingReport = {
  playerId: string
  scoutTier: DraftScoutTier | "public"
  confidence: number
  notes: string[]
  estimate: DraftScoutingEstimate
  ranges: Record<string, { min: number; max: number }>
  knownFieldCount: number
}

export type DraftScoutingTruth = {
  playerId: string
  currentAbility: number
  potential: number
  volatility: number
  peakAge: number
  declineStartAge: number
  injuryResistance: number
  measurements: DraftScoutingEstimate["measurements"]
  positions: PlayerPosition[]
  traits: string[]
  growthCurve: CareerGrowthCurve
  declineCurve: CareerDeclineCurve
}

export type DraftTeamProfile = {
  team: TeamEntity
  scoutTier: DraftScoutTier
  mode: DraftTeamMode
  needs: Array<{
    position: PlayerPosition
    priority: number
    reason: string
  }>
  rosterCurrentAbility: number
  rosterByPosition: Record<PlayerPosition, number>
  overrideSource: "derived" | "manual"
}

export type DraftBoardScore = {
  total: number
  currentAbility: number
  potential: number
  need: number
  publicMock: number
  variance: number
}

export type DraftBoardEntry = {
  rank: number
  playerId: string
  score: DraftBoardScore
  rationale: string
  topAlternatives: string[]
  source: DraftBoardSource
  pinned: boolean
  doNotDraft: boolean
  note: string | null
}

export type DraftTeamBoard = {
  teamId: string
  generatedAt: "pre-draft"
  entries: DraftBoardEntry[]
}

export type DraftPublicMockEntry = {
  rank: number
  playerId: string
  projectedRange: { min: number; max: number }
  signal: number
}

export type DraftPick = {
  overall: number
  round: 1 | 2
  pickInRound: number
  teamId: string
  playerId: string
  kind: DraftSelectionKind
  boardRank: number | null
}

export type DraftRookieContract = ContractEntity & {
  source: "rookie-scale" | "second-round-minimum"
  draftSlot: number
}

export type DraftDecisionConfig = {
  version: 1
  eligibleProspects: number
  selections: number
  rounds: 2
  teams: number
  secondRoundYears: number
  secondRoundSalaryMultiplier: number
  publicMockWeight: number
  needWeight: number
  currentAbilityWeight: number
  potentialWeight: number
  boundedVariance: number
  followUpYears: number
}

export type DraftDecisionFixture = {
  version: 1
  seed: string
  season: number
  config: DraftDecisionConfig
  teams: TeamEntity[]
  rosters: Record<string, string[]>
  players: Record<string, PlayerEntity>
  draftProspectIds: string[]
  draftOrder: string[]
  teamProfiles: Record<string, DraftTeamProfile>
  publicReports: Record<string, DraftScoutingReport>
  privateReports: Record<string, Record<string, DraftScoutingReport>>
  publicMock: DraftPublicMockEntry[]
  boards: Record<string, DraftTeamBoard>
  economy: EconomySnapshot
}

export type DraftDecisionRunInput = {
  seed: string
  season?: number
  config?: Partial<DraftDecisionConfig>
  scoutTiers?: Record<string, DraftScoutTier>
  teamModes?: Record<string, DraftTeamMode>
  teamNeeds?: Record<string, Partial<Record<PlayerPosition, number>>>
  draftOrder?: string[]
  userTeamId?: string | null
  userPicks?: Record<number, string>
  userBoardOverrides?: Record<
    string,
    Partial<Pick<DraftBoardEntry, "pinned" | "doNotDraft" | "note">>
  >
}

export type DraftOutcome = {
  playerId: string
  draftSlot: number
  draftRound: 1 | 2
  preDraftAbility: number
  realizedPeakAbility: number
  abilityAfterFollowUp: number
  potentialForecast: number
  forecastError: number
  scoutEstimate: number | null
  scoutError: number | null
  seasonsSimulated: number
}

export type DraftDecisionResult = {
  schema: "foh-draft-decision-lab"
  version: 1
  fixture: DraftDecisionFixture
  picks: DraftPick[]
  contracts: DraftRookieContract[]
  undraftedPlayerIds: string[]
  outcomes: DraftOutcome[]
  teamImpact: Record<string, {
    before: number
    after: number
    change: number
    draftedPlayerIds: string[]
  }>
  diagnostics: {
    legal: boolean
    duplicatePlayers: string[]
    unfilledSelections: number
    averageScoutAbsoluteError: Record<DraftScoutTier, number>
    averageBoardRankOfPick: Record<string, number>
  }
}

export type DraftDecisionExportProfile = "full-developer" | "selected-team-safe"

export type DraftDecisionExport = {
  schema: "foh-draft-decision-export"
  version: 1
  profile: DraftDecisionExportProfile
  run: Omit<DraftDecisionResult, "fixture"> & {
    fixture: Omit<DraftDecisionFixture, "players" | "privateReports" | "boards"> & {
      players?: Record<string, PlayerEntity>
      privateReports?: DraftDecisionFixture["privateReports"]
      boards?: DraftDecisionFixture["boards"]
    }
  }
}
