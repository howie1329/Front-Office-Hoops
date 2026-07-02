import type { SigningException } from "./contractTypes"

export type MarketTier = "large" | "mid" | "small"

export type TaxTolerance = "tax_averse" | "prudent" | "competitive" | "all_in"

export type TeamMode = "selling" | "buying" | "contending"

export type TeamModeSource = "initial" | "auto" | "owner" | "financial_distress"

export type TeamStrategy = {
  mode: TeamMode
  modeSetSeason: number
  source: TeamModeSource
  pendingMode: TeamMode | null
  pendingSeasons: number
}

export type TeamSpendingProfile = {
  marketTier: MarketTier
  taxTolerance: TaxTolerance
  baseTaxTolerance: TaxTolerance
}

export type SeasonFinancials = {
  season: number
  salaryCap: number
  minimumTeamSalary: number
  luxuryTaxLine: number
  taxBracketSize: number
  averageSalary: number
  mleNonTaxpayer: number
  mleTaxpayer: number
  mleRoom: number
  minimumSalaries: {
    tier1: number
    tier2: number
    tier3: number
  }
  rookieScale: number[]
}

export type LeagueFinancials = {
  baseCap: number
  growthRate: number
  bySeason: Record<number, SeasonFinancials>
}

export type TradeException = {
  id: string
  amount: number
  createdSeason: number
  expiresSeason: number
  originDescription: string
}

export type TeamFinancials = {
  teamId: string
  spendingProfile: TeamSpendingProfile
  strategy: TeamStrategy
  cashReserves: number
  debt: number
  consecutiveTaxSeasons: number
  lastTaxBill: number | null
  mleUsed: number
  mleRemaining: number
  wasUnderCapThisYear: boolean
  tradeExceptions: TradeException[]
}

export type SpendingProfileEvent = {
  id: string
  teamId: string
  season: number
  type:
    | "owner_sale"
    | "tax_fatigue"
    | "championship_bonus"
    | "financial_distress"
  previousTolerance: TaxTolerance
  newTolerance: TaxTolerance
  narrativeKey?: string
}

export type BirdRightsType = "none" | "non_bird" | "early_bird" | "bird"

export type SignValidationContext = {
  seasonFinancials: SeasonFinancials
  teamPayroll: number
  isOverTaxLine: boolean
  mleRemaining: number
  wasUnderCapThisYear: boolean
  priorContractSalary?: number
  birdRights: BirdRightsType
  isReSigning: boolean
}

export type { SigningException }
