import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { advanceLeague } from "../advance/advanceSeason"
import {
  beginRegularSeason,
  skipRemainingExhibitions,
} from "../preseason/beginRegularSeason"
import { beginPlayoffs } from "../beginPlayoffs"
import { generateOwnerGoals } from "../owners"
import { beginLeagueOffseason } from "../offseason/beginLeagueOffseason"
import { simAiPick, simToUserPick } from "../draft/simAiPick"
import { makeDraftPick } from "../draft/makeDraftPick"
import { prepareDraftForLeague } from "../draft/prepareDraft"
import {
  advanceLeagueToFreeAgencyPhase,
  advanceToDraftPhase,
  completeFreeAgencyPhase,
} from "../offseason/phases"
import { beginStaffMarket, completeStaffPhase } from "../offseason/staffPhase"
import { completeReSigningPhase } from "../offseason/reSigning"
import {
  ensureFaPoolMinimum,
  decideTeamOption,
  setOpeningExceptions,
  renouncePlayerRights,
} from "../financials"
import {
  acceptTradeOffer,
  executeTrade,
  rejectTradeOffer,
  wouldAiAcceptTrade,
} from "../trades"
import { extendStaffContract, fireStaff } from "../staff"
import {
  advanceFreeAgencyMarketDay,
  advanceStaffMarketDay,
  submitPlayerContractOffer,
  submitPlayerExtensionOffer,
  submitStaffContractOffer,
} from "../contracts/offerMarket"
import { assertPhaseEligibility } from "../phaseEligibility"
import { applyDraftSelections, releasePlayerFromTeam } from "../roster/ledger"
import { simulateCurrentPlayoffRound } from "../simulateCurrentPlayoffRound"
import { simulatePlayoffs } from "../simulatePlayoffs"
import { simulateSeason } from "../simulateSeason"
import { startNextSeason } from "../startNextSeason"
import { commandRng } from "./rngSeeds"
import {
  getPhaseActionForCommand,
  type LeagueCommand,
  type PhaseGatedCommand,
} from "./types"

const PHASE_GATED_TYPES = new Set<LeagueCommand["type"]>([
  "beginRegularSeason",
  "beginPlayoffs",
  "beginOffseason",
  "completeContractOptions",
  "completeStaffPhase",
  "completeReSignings",
  "advanceToDraft",
  "prepareDraft",
  "advanceToFreeAgency",
  "completeFreeAgency",
  "startNextSeason",
])

const STOCHASTIC_TYPES = new Set<LeagueCommand["type"]>([
  "advance",
  "simDay",
  "simWeek",
  "simSeason",
  "simulatePlayoffs",
  "simulateCurrentPlayoffRound",
  "beginOffseason",
  "completeStaffPhase",
  "completeReSignings",
  "prepareDraft",
  "simAiPick",
  "simToUserPick",
  "advanceToFreeAgency",
  "completeFreeAgency",
  "startNextSeason",
])

function assertCommandEligibility(
  league: LeagueRecord,
  command: LeagueCommand
): void {
  if (!PHASE_GATED_TYPES.has(command.type)) {
    return
  }

  assertPhaseEligibility(
    league,
    getPhaseActionForCommand(command as PhaseGatedCommand)
  )
}

function applyLeagueCommandInternal(
  league: LeagueRecord,
  command: LeagueCommand,
  rng?: Rng
): LeagueRecord {
  assertCommandEligibility(league, command)

  const resolvedRng = rng ?? commandRng(league, command)

  switch (command.type) {
    case "advance": {
      const { league: advanced } = advanceLeague(league, {
        target: command.target,
        userTeamId: league.userTeamId,
        league,
        rngNonce: league.rngNonce,
      }, resolvedRng)
      return advanced
    }

    case "simDay": {
      const { league: advanced } = advanceLeague(
        league,
        {
          target: "day",
          userTeamId: league.userTeamId,
          league,
          rngNonce: league.rngNonce,
        },
        resolvedRng,
      )
      return advanced
    }

    case "simWeek": {
      const { league: advanced } = advanceLeague(
        league,
        {
          target: "week",
          userTeamId: league.userTeamId,
          league,
          rngNonce: league.rngNonce,
        },
        resolvedRng,
      )
      return advanced
    }

    case "simSeason":
      return {
        ...league,
        seasonState: simulateSeason(league.seasonState, league.rngNonce),
      }

    case "simulatePlayoffs":
      return {
        ...league,
        seasonState: simulatePlayoffs(league.seasonState, league.rngNonce),
      }

    case "simulateCurrentPlayoffRound":
      return {
        ...league,
        seasonState: simulateCurrentPlayoffRound(
          league.seasonState,
          league.rngNonce
        ),
      }

    case "beginRegularSeason":
      return beginRegularSeason(league, resolvedRng)

    case "skipRemainingExhibitions":
      return {
        ...league,
        seasonState: skipRemainingExhibitions(league),
      }

    case "beginPlayoffs":
      return {
        ...league,
        seasonState: beginPlayoffs(league.seasonState),
      }

    case "beginOffseason": {
      return beginLeagueOffseason(league, resolvedRng)
    }

    case "decideTeamOption":
      return decideTeamOption(league, command.contractId, command.decision)

    case "completeContractOptions":
      return beginStaffMarket(
        setOpeningExceptions({
          ...league,
          seasonState: { ...league.seasonState, offseasonPhase: "staff" },
        }),
        resolvedRng,
      )

    case "completeStaffPhase":
      return completeStaffPhase(league, resolvedRng)

    case "completeReSignings":
      return completeReSigningPhase(league, resolvedRng)

    case "advanceToDraft":
      return {
        ...league,
        seasonState: advanceToDraftPhase(league.seasonState),
      }

    case "prepareDraft":
      return prepareDraftForLeague(league, league.rngNonce)

    case "makeDraftPick": {
      const result = makeDraftPick(
        league.seasonState,
        command.prospectId,
        league.freeAgentPool
      )
      return applyDraftSelections(league, league, result)
    }

    case "simAiPick": {
      const result = simAiPick(league.seasonState, league.freeAgentPool)
      return applyDraftSelections(league, league, result)
    }

    case "simToUserPick": {
      const result = simToUserPick(
        league.seasonState,
        league.userTeamId,
        league.freeAgentPool
      )
      return applyDraftSelections(league, league, result)
    }

    case "advanceToFreeAgency":
      return advanceLeagueToFreeAgencyPhase(
        ensureFaPoolMinimum(league, resolvedRng),
        resolvedRng
      )

    case "completeFreeAgency":
      return completeFreeAgencyPhase(league, resolvedRng)

    case "releasePlayer": {
      if (!league.userTeamId) {
        throw new Error("User team must be selected before releasing a player")
      }

      return releasePlayerFromTeam(league, {
        teamId: league.userTeamId,
        playerId: command.playerId,
      })
    }

    case "renouncePlayerRights": {
      if (!league.userTeamId) {
        throw new Error("User team must be selected before renouncing rights")
      }
      return renouncePlayerRights(
        league,
        league.userTeamId,
        command.playerId,
      )
    }

    case "submitPlayerContractOffer": {
      if (!league.userTeamId) {
        throw new Error(
          "User team must be selected before submitting a contract offer"
        )
      }

      return submitPlayerContractOffer(
        league,
        league.userTeamId,
        command.playerId,
        command.offer
      )
    }

    case "submitPlayerExtensionOffer": {
      if (!league.userTeamId) {
        throw new Error(
          "User team must be selected before submitting an extension offer"
        )
      }

      return submitPlayerExtensionOffer(
        league,
        league.userTeamId,
        command.playerId,
        command.offer
      )
    }

    case "submitStaffContractOffer": {
      if (!league.userTeamId) {
        throw new Error("User team must be selected before offering staff")
      }

      return submitStaffContractOffer(
        league,
        league.userTeamId,
        command.staffId,
        command.offer,
      )
    }

    case "advanceStaffMarketDay":
      return advanceStaffMarketDay(league, resolvedRng)

    case "advanceFreeAgencyMarketDay":
      return advanceFreeAgencyMarketDay(league, resolvedRng)

    case "fireStaff": {
      if (!league.userTeamId) {
        throw new Error("User team must be selected before firing staff")
      }

      const result = fireStaff(league, league.userTeamId, command.staffId)
      if (!result.ok) {
        throw new Error(result.reason)
      }
      return result.league
    }

    case "extendStaffContract": {
      if (!league.userTeamId) {
        throw new Error("User team must be selected before extending staff")
      }

      const result = extendStaffContract(
        league,
        league.userTeamId,
        command.staffId,
        command.offer,
      )
      if (!result.ok) {
        throw new Error(result.reason)
      }
      return result.league
    }

    case "executeTrade":
      if (!league.userTeamId) {
        throw new Error("User team must be selected before trading")
      }
      if (
        command.proposal.from.teamId !== league.userTeamId &&
        command.proposal.to.teamId !== league.userTeamId
      ) {
        throw new Error("User team must be included in the trade")
      }
      {
        const aiTeamId =
          command.proposal.from.teamId === league.userTeamId
            ? command.proposal.to.teamId
            : command.proposal.from.teamId
        const acceptance = wouldAiAcceptTrade(
          league,
          command.proposal,
          aiTeamId
        )
        if (!acceptance.ok) {
          throw new Error(acceptance.reason)
        }
      }
      return executeTrade(league, command.proposal)

    case "acceptTradeOffer":
      if (!league.userTeamId) {
        throw new Error("User team must be selected before accepting a trade offer")
      }
      return acceptTradeOffer(league, command.offerId)

    case "rejectTradeOffer":
      if (!league.userTeamId) {
        throw new Error("User team must be selected before rejecting a trade offer")
      }
      return rejectTradeOffer(league, command.offerId)

    case "startNextSeason": {
      const result = startNextSeason({
        seasonState: league.seasonState,
        userTeamId: league.userTeamId,
        freeAgentPool: league.freeAgentPool,
        rng: resolvedRng,
        playerSeasonStats: league.seasonState.playerSeasonStats,
        playerSeasonProfiles: league.playerSeasonProfiles,
        seasonHistory: league.seasonHistory,
        league: {
          contracts: league.contracts,
          leagueFinancials: league.leagueFinancials,
          teamFinancials: league.teamFinancials,
          spendingProfileEvents: league.spendingProfileEvents,
          draftPickAssets: league.draftPickAssets,
        },
      })

      const updated = {
        ...league,
        seasonState: result.seasonState,
        seasonHistory: [...league.seasonHistory, result.historyEntry],
        freeAgentPool: result.freeAgentPool,
        contracts: result.contracts,
        leagueFinancials: result.leagueFinancials,
        teamFinancials: result.teamFinancials,
        draftPickAssets: result.draftPickAssets,
        playerDevelopmentRecords: [
          ...league.playerDevelopmentRecords,
          ...result.playerDevelopmentRecords,
        ],
        developmentReports: [
          ...league.developmentReports,
          result.developmentReport,
        ],
        retiredPlayers: [...league.retiredPlayers, ...result.retiredPlayers],
      }

      return {
        ...updated,
        ownerGoals: [
          ...updated.ownerGoals.filter(
            (goal) => goal.season !== updated.seasonState.season
          ),
          ...generateOwnerGoals(updated),
        ],
      }
    }

    default: {
      const _exhaustive: never = command
      return _exhaustive
    }
  }
}

export function applyLeagueCommand(
  league: LeagueRecord,
  command: LeagueCommand,
  rng?: Rng
): LeagueRecord {
  const updated = applyLeagueCommandInternal(league, command, rng)

  if (!STOCHASTIC_TYPES.has(command.type)) {
    return updated
  }

  return {
    ...updated,
    rngNonce: (league.rngNonce ?? 0) + 1,
  }
}

export { getPhaseEligibility } from "../phaseEligibility"
export type { LeagueCommand } from "./types"
export { commandRng } from "./rngSeeds"
