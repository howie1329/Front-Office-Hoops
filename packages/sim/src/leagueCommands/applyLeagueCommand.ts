import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { archivePlayerCareerSnapshots } from "../playerProfiles"
import { advanceLeague } from "../advance/advanceSeason"
import {
  beginRegularSeason,
  skipRemainingExhibitions,
} from "../preseason/beginRegularSeason"
import { derivePlayerSeasonProfiles } from "../playerSeasonProfiles"
import { assignSeasonAwards } from "../awards"
import { beginOffseason } from "../beginOffseason"
import { beginPlayoffs } from "../beginPlayoffs"
import { evaluateOwnerGoals, generateOwnerGoals } from "../owners"
import { simAiPick, simToUserPick } from "../draft/simAiPick"
import { makeDraftPick } from "../draft/makeDraftPick"
import { prepareDraftForLeague } from "../draft/prepareDraft"
import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  completeFreeAgencyPhase,
} from "../offseason/phases"
import { completeReSigningPhase } from "../offseason/reSigning"
import { ensureFaPoolMinimum, processOffseasonFinancials } from "../financials"
import {
  acceptTradeOffer,
  executeTrade,
  rejectTradeOffer,
  wouldAiAcceptTrade,
} from "../trades"
import { signFreeAgent } from "../financials/freeAgency"
import { extendContract } from "../financials/contractExtensions"
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
      const completedLeague = archivePlayerCareerSnapshots(
        evaluateOwnerGoals(assignSeasonAwards(league))
      )
      const profiles = derivePlayerSeasonProfiles(
        completedLeague.seasonState.teams,
        completedLeague.seasonState.playerSeasonStats,
        completedLeague.seasonState.games.length,
        completedLeague.seasonState.season
      )
      const nextState = beginOffseason(
        completedLeague.seasonState,
        profiles
      )
      return processOffseasonFinancials(
        {
          ...completedLeague,
          seasonState: nextState,
          playerSeasonProfiles: [
            ...completedLeague.playerSeasonProfiles.filter(
              (entry) => entry.season !== completedLeague.seasonState.season
            ),
            ...profiles,
          ],
        },
        resolvedRng
      )
    }

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
      return ensureFaPoolMinimum(
        {
          ...league,
          seasonState: advanceToFreeAgencyPhase(league.seasonState),
        },
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

    case "signFreeAgent": {
      if (!league.userTeamId) {
        throw new Error(
          "User team must be selected before signing a free agent"
        )
      }

      return signFreeAgent(
        league,
        league.userTeamId,
        command.playerId,
        command.offer
      )
    }

    case "extendContract": {
      if (!league.userTeamId) {
        throw new Error(
          "User team must be selected before extending a contract"
        )
      }

      return extendContract(
        league,
        league.userTeamId,
        command.playerId,
        command.offer
      )
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
