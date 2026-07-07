import type {
  PlayerGameStats,
  QuarterScores,
  TeamWithRoster,
} from "./playerTypes"

export type { Team } from "./teamTypes"

export type TeamMatchupInput = {
  home: TeamWithRoster
  away: TeamWithRoster
  homeCourtAdvantage?: number
  homeFatiguePenalty?: number
  awayFatiguePenalty?: number
  homeMinuteReduction?: number
  awayMinuteReduction?: number
}

export type TeamMatchupMeta = {
  homePossessions: number
  awayPossessions: number
  homeOffRtg: number
  awayOffRtg: number
  homeRotationQuality?: RotationQuality
  awayRotationQuality?: RotationQuality
  homeTeamStats?: TeamGameStats
  awayTeamStats?: TeamGameStats
}

export type RotationQuality = {
  top2: number
  starters: number
  bench: number
  fullRotation: number
}

export type TeamGameStats = {
  possessions: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  orb: number
  drb: number
  ast: number
  stl: number
  blk: number
  tov: number
}

export type TeamMatchupResult = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  winnerId: string
  meta: TeamMatchupMeta
  homeQuarterScores: QuarterScores
  awayQuarterScores: QuarterScores
  homePlayerStats: PlayerGameStats[]
  awayPlayerStats: PlayerGameStats[]
}

export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  normal: (mean?: number, stdDev?: number) => number
}

export type {
  ID,
  Player,
  PlayerArchetype,
  PlayerGameStats,
  PlayerInjury,
  PlayerMood,
  PlayerPosition,
  PlayerRatings,
  PlayerStatus,
  PlayerTag,
  ProspectType,
  QuarterScores,
  GameRotation,
  GameRotationEntry,
  RotationEntry,
  RotationPlan,
  RotationPlanEntry,
  RotationRole,
  SkillKey,
  TeamWithRoster,
} from "./playerTypes"

export type {
  LeagueCalendarState,
  CalendarDate,
  SeasonMilestones,
  Weekday,
} from "./calendarTypes"

export type {
  DraftInfo,
  DraftPickAsset,
  DraftPickProtection,
  DraftPick,
  DraftProspect,
  DraftSelection,
  DraftState,
} from "./draftTypes"

export type {
  Game,
  GameType,
  PlayerSeasonStats,
  PlayoffBracket,
  PlayoffRound,
  PlayoffSeries,
  ScheduleConfig,
  ScheduleGame,
  ScheduleGameStatus,
  OffseasonPhase,
  SeasonHistoryEntry,
  SeasonPhase,
  SeasonState,
  SimulateGameContext,
  Standing,
  UserPlayoffResult,
} from "./seasonTypes"

export type {
  Contract,
  ContractOption,
  ContractStatus,
  ContractType,
  FreeAgentOffer,
  SigningException,
} from "./contractTypes"

export type { LeagueLogEntry, LeagueLogEntryType } from "./logTypes"

export type {
  Owner,
  OwnerArchetype,
  OwnerGoal,
  OwnerGoalPriority,
  OwnerGoalStatus,
  OwnerGoalType,
  OwnerPatience,
  OwnerRiskTolerance,
} from "./ownerTypes"

export type { SeasonAward, SeasonAwardType } from "./awardTypes"

export type {
  PlayerCareerSnapshot,
  PlayerSeasonProfile,
  PlayerSeasonProfileRole,
} from "./playerProfileTypes"

export type {
  TradeEvaluation,
  TradeHistoryEntry,
  TradeHistoryTeamEntry,
  TradeProposal,
  TradeResult,
  TradeSide,
  TradeValidationResult,
  PendingTradeOffer,
  PendingTradeOfferStatus,
} from "./tradeTypes"

export type {
  BirdRightsType,
  LeagueFinancials,
  MarketTier,
  SeasonFinancials,
  SpendingProfileEvent,
  TaxTolerance,
  TeamFinancials,
  TeamMode,
  TeamModeSource,
  TeamSpendingProfile,
  TeamStrategy,
  TradeException,
} from "./financialTypes"

export {
  SAVE_VERSION,
  type DraftClassCache,
  type League,
  type LeagueRecord,
  type LeagueSummary,
} from "./leagueTypes"
