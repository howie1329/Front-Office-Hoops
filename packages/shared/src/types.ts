import type { PlayerGameStats, QuarterScores, TeamWithRoster } from "./playerTypes"

export type { Team } from "./teamTypes"

export type TeamMatchupInput = {
  home: TeamWithRoster
  away: TeamWithRoster
  homeCourtAdvantage?: number
}

export type TeamMatchupMeta = {
  homePossessions: number
  awayPossessions: number
  homeOffRtg: number
  awayOffRtg: number
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
  PlayerGameStats,
  PlayerPosition,
  PlayerRatings,
  PlayerStatus,
  PlayerTag,
  QuarterScores,
  RotationEntry,
  SkillKey,
  TeamWithRoster,
} from "./playerTypes"

export type {
  DraftInfo,
  DraftPick,
  DraftProspect,
  DraftSelection,
  DraftState,
} from "./draftTypes"

export type {
  Game,
  PlayerSeasonStats,
  PlayoffBracket,
  PlayoffRound,
  PlayoffSeries,
  ScheduleConfig,
  ScheduleGame,
  ScheduleGameStatus,
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

export type {
  BirdRightsType,
  LeagueFinancials,
  MarketTier,
  SeasonFinancials,
  SpendingProfileEvent,
  TaxTolerance,
  TeamFinancials,
  TeamSpendingProfile,
  TradeException,
} from "./financialTypes"

export {
  SAVE_VERSION,
  type League,
  type LeagueRecord,
  type LeagueSummary,
} from "./leagueTypes"
