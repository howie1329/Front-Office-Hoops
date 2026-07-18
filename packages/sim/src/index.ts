export { createRng } from "./rng"
export {
  estimateOffRtg,
  estimateTeamDefFactor,
  estimateTeamOffFactor,
} from "./teamStrength"
export { simulateTeamMatchup } from "./simulateTeamMatchup"
export {
  computeLineupSynergy,
  computeOffensiveSynergy,
  computeDefensiveSynergy,
  computeTeamMomentum,
  philosophyPaceModifier,
  updateTeamMomentumMap,
} from "./gameSim"
export { generatePlayers, generateTeamWithRoster } from "./generatePlayers"
export { generateLeagueRosters, generateTeams } from "./generateTeams"
export {
  createAutoRotationPlan,
  createGameRotation,
  selectRotation,
} from "./selectRotation"
export { allocatePlayerStats } from "./allocatePlayerStats"
export { distributeQuarterScores } from "./distributeQuarterScores"
export { SAMPLE_ROSTERS, getRosterByTeamId } from "./sampleRosters"
export { createSchedule } from "./createSchedule"
export { simulateGame } from "./simulateGame"
export { deriveStandings, sortStandings } from "./deriveStandings"
export {
  derivePlayerSeasonStats,
  sortPlayerSeasonStats,
} from "./derivePlayerSeasonStats"
export { simulateDay } from "./simulateDay"
export {
  simulateRegularDay,
  simulateLeagueRegularDay,
} from "./simulateRegularDay"
export { simulateWeek } from "./simulateWeek"
export { simulateSeason } from "./simulateSeason"
export { simulatePlayoffDay } from "./simulatePlayoffDay"
export { simulatePlayoffs } from "./simulatePlayoffs"
export { simulateCurrentPlayoffRound } from "./simulateCurrentPlayoffRound"
export { beginPlayoffs } from "./beginPlayoffs"
export { isRegularSeasonComplete } from "./isRegularSeasonComplete"
export {
  assertPhaseEligibility,
  getAllPhaseEligibility,
  getPhaseEligibility,
} from "./phaseEligibility"
export type { EligibilityResult, PhaseAction } from "./phaseEligibility"
export { finalizeSeason } from "./finalizeSeason"
export { archiveSeason } from "./archiveSeason"
export { beginOffseason } from "./beginOffseason"
export { beginLeagueOffseason } from "./offseason/beginLeagueOffseason"
export {
  advanceLeagueToFreeAgencyPhase,
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  completeFreeAgencyPhase,
} from "./offseason/phases"
export { completeReSigningPhase } from "./offseason/reSigning"
export {
  advanceStaffMarketDay,
  beginStaffMarket,
  completeStaffPhase,
  completeStaffPhaseAtDeadline,
} from "./offseason/staffPhase"
export { completeContractOptions } from "./offseason/contractOptions"
export {
  advanceFreeAgencyMarketDay,
  generateAiFreeAgencyMarketOffers,
  generateAiStaffMarketOffers,
  getContractOffersForCandidate,
  getPlayerOfferAttemptsRemaining,
  getReSigningAttemptsRemaining,
  isPlayerOfferBlocked,
  resetPlayerOfferNegotiations,
  submitPlayerContractOffer,
  submitPlayerExtensionOffer,
  submitStaffContractOffer,
  fillAiRostersAfterFreeAgency,
} from "./contracts/offerMarket"
export {
  getPlayerContractMarketValue,
  getStaffContractMarketValue,
} from "./contracts/marketValue"
export {
  applyStaffBudgetsFromOwners,
  derivePhilosophyFromStaff,
  getStaffEmploymentSeason,
  getHeadCoachPace,
  getStaffByRole,
  getTeamStaff,
  getVacantStaffRoles,
  hireStaff,
  fireStaff,
  extendStaffContract,
  initializeStaffForLeague,
  reconcileStaffEmployment,
  syncLeagueStaffFinancials,
} from "./staff"
export { startNextSeason } from "./startNextSeason"
export type {
  StartNextSeasonInput,
  StartNextSeasonResult,
} from "./startNextSeason"
export { applyPreseasonProgression } from "./preseason/applyPreseasonProgression"
export { applyOffseasonProgression } from "./preseason/applyPreseasonProgression"
export {
  ARCHETYPES_BY_POSITION,
  ARCHETYPE_SKILL_BIAS,
  ARCHETYPE_USAGE_BONUS,
  isValidArchetypeForPosition,
  pickArchetype,
} from "./playerGeneration/archetypes"
export {
  advanceInjuriesForDay,
  applyPostGameInjuries,
  applyPostGameInjuriesToTeam,
  calculateInjuryRisk,
  rollInjury,
} from "./injuries"
export {
  isDraftRequired,
  getDraftPickCount,
  getDraftClassSize,
} from "./draft/isDraftRequired"
export {
  prepareDraft,
  prepareDraftForLeague,
  getCurrentDraftPick,
  isUserOnClock,
} from "./draft/prepareDraft"
export { buildDraftClassCache, getPickValueFromCache } from "./draft/pickValues"
export { makeDraftPick } from "./draft/makeDraftPick"
export {
  simAiPick,
  simToUserPick,
  simDraftUntilComplete,
} from "./draft/simAiPick"
export {
  releasePlayer,
  canReleasePlayer,
  applyAiRosterTrimming,
  getTeamRosterSize,
} from "./roster/rosterManagement"
export {
  applyDraftSelections,
  findPlayer,
  findPlayerTeam,
  findTeam as findLeagueTeam,
  findPlayersOnTeam,
  getUserRosterSize,
  releasePlayerFromTeam,
} from "./roster/ledger"
export { deriveUserPlayoffResult } from "./deriveUserPlayoffResult"
export { createInitialSeason } from "./createInitialSeason"
export { createLeague } from "./createLeague"
export type { CreateLeagueInput } from "./createLeague"
export { applyLeagueCommand, commandRng } from "./leagueCommands"
export type { LeagueCommand } from "./leagueCommands"
export {
  processOffseasonFinancials,
  initializeFinancialsForLeague,
  attachRookieContractToLeague,
  attachRookieContractsForDraftSelections,
  signFreeAgent,
  canSignPlayer,
  ensureFaPoolMinimum,
  getTeamExpiredFreeAgents,
  getExternalFreeAgents,
  getTeamPayroll,
  getTeamFinancialPosition,
  renouncePlayerRights,
  getPlayerContract,
  getSeasonFinancials,
  calculateLuxuryTax,
  getCapSpace,
  getCurrentSalary,
  getYearsRemaining,
  getPendingUserTeamOptions,
  canExtendContract,
  extendContract,
  getExtensionBounds,
  getExtensionEligibilityReason,
} from "./financials"
export { getTeamDeadCapPayroll } from "./financials/deadCap"
export type { SignValidationResult } from "./financials/freeAgency"
export {
  evaluateTrade,
  evaluateTradeUtility,
  executeTrade,
  proposeTrade,
  validateTrade,
  wouldAiAcceptTrade,
  makeItWork,
  runAiTradeMarket,
  expirePendingTradeOffers,
  acceptTradeOffer,
  rejectTradeOffer,
} from "./trades"
export {
  getFairSalary,
  getContractAssetValueBreakdown,
  getContractValueBreakdown,
  getProjectedPlayerValue,
  getProjectedPlayerValueBreakdown,
  calculatePlayerValue,
} from "./playerValue"
export type {
  ContractValueBreakdown,
  ProjectedPlayerValueBreakdown,
} from "./playerValue"
export type { TeamTradeUtilityBreakdown } from "./tradeEvaluation"
export { createLeagueLogEntry, appendLeagueLog } from "./leagueLog"
export { advanceSeason, advanceLeague } from "./advance/advanceSeason"
export type {
  AdvanceEvent,
  AdvancePolicy,
  AdvanceResult,
  AdvanceStopReason,
  AdvanceTarget,
} from "./advance/advanceSeason"
export {
  beginRegularSeason,
  skipRemainingExhibitions,
} from "./preseason/beginRegularSeason"
export { addCampPlayersToTeams } from "./preseason/campPlayers"
export {
  isPreseasonComplete,
  hasRemainingExhibitions,
} from "./preseason/isPreseasonComplete"
export {
  genFuzz,
  getDisplayedRatings,
  getDisplayedSkillRating,
  resolveScoutingLevel,
} from "./scouting/displayedRatings"
export {
  deriveOverall,
  getSkillRatings,
  deriveTeamOverall,
  deriveTeamOffense,
  deriveTeamDefense,
} from "./playerRatings"
export {
  getTeamScheduleFatigue,
  getFatigueEfficiencyPenalty,
  isBackToBack,
  isThreeInFour,
} from "./schedule/fatigue"
export {
  getCalendarDate,
  getCurrentCalendar,
  getSeasonMilestones,
  getWeekday,
  getWeekOfSeason,
  getTradeDeadlineAdvanceStopDay,
  getMonthEndDay,
  canTradeOnDate,
} from "./calendar"
export { assignSeasonAwards } from "./awards"
export {
  evaluateOwnerGoals,
  generateOwnerGoals,
  initializeOwners,
} from "./owners"
export { archivePlayerCareerSnapshots } from "./playerProfiles"
export { derivePlayerSeasonProfiles } from "./playerSeasonProfiles"
