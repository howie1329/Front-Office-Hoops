import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { archivePlayerCareerSnapshots } from "../playerProfiles"
import { assignSeasonAwards } from "../awards"
import { beginOffseason } from "../beginOffseason"
import { beginPlayoffs } from "../beginPlayoffs"
import { evaluateOwnerGoals, generateOwnerGoals } from "../owners"
import { simAiPick, simToUserPick } from "../draft/simAiPick"
import { makeDraftPick } from "../draft/makeDraftPick"
import { prepareDraft } from "../draft/prepareDraft"
import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  completeFreeAgencyPhase,
} from "../offseason/phases"
import { completeReSigningPhase } from "../offseason/reSigning"
import {
  ensureFaPoolMinimum,
  processOffseasonFinancials,
} from "../financials"
import { executeTrade } from "../trades"
import { signFreeAgent } from "../financials/freeAgency"
import { normalizeLeagueRecord } from "../normalizeLeague"
import {
  assertPhaseEligibility,
  getPhaseEligibility,
} from "../phaseEligibility"
import {
  applyDraftSelections,
  releasePlayerFromTeam,
} from "../roster/ledger"
import { simulateDay } from "../simulateDay"
import { simulatePlayoffs } from "../simulatePlayoffs"
import { simulateSeason } from "../simulateSeason"
import { simulateWeek } from "../simulateWeek"
import { startNextSeason } from "../startNextSeason"
import { commandRng } from "./rngSeeds"
import {
  getPhaseActionForCommand,
  type LeagueCommand,
  type PhaseGatedCommand,
} from "./types"

const PHASE_GATED_TYPES = new Set<LeagueCommand["type"]>([
  "beginPlayoffs",
  "beginOffseason",
  "completeReSignings",
  "advanceToDraft",
  "prepareDraft",
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

export function applyLeagueCommand(
  league: LeagueRecord,
  command: LeagueCommand,
  rng?: Rng
): LeagueRecord {
  assertCommandEligibility(league, command)

  const resolvedRng = rng ?? commandRng(league, command)

  switch (command.type) {
    case "simDay":
      return {
        ...league,
        seasonState: simulateDay(league.seasonState),
      }

    case "simWeek":
      return {
        ...league,
        seasonState: simulateWeek(league.seasonState),
      }

    case "simSeason":
      return {
        ...league,
        seasonState: simulateSeason(league.seasonState),
      }

    case "simulatePlayoffs":
      return {
        ...league,
        seasonState: simulatePlayoffs(league.seasonState),
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
      const nextState = beginOffseason(completedLeague.seasonState, resolvedRng)
      return processOffseasonFinancials(
        { ...completedLeague, seasonState: nextState },
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
      return {
        ...league,
        seasonState: prepareDraft(
          league.seasonState,
          league.draftPickAssets
        ),
      }

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
        throw new Error("User team must be selected before signing a free agent")
      }

      return signFreeAgent(
        league,
        league.userTeamId,
        command.playerId,
        command.offer
      )
    }

    case "executeTrade":
      return executeTrade(league, command.proposal)

    case "startNextSeason": {
      const result = startNextSeason({
        seasonState: league.seasonState,
        userTeamId: league.userTeamId,
        freeAgentPool: league.freeAgentPool,
        rng: resolvedRng,
        league: {
          contracts: league.contracts,
          leagueFinancials: league.leagueFinancials,
          teamFinancials: league.teamFinancials,
          spendingProfileEvents: league.spendingProfileEvents,
          draftPickAssets: league.draftPickAssets,
        },
      })

      const updated = normalizeLeagueRecord({
        ...league,
        seasonState: result.seasonState,
        seasonHistory: [...league.seasonHistory, result.historyEntry],
        freeAgentPool: result.freeAgentPool,
        contracts: result.contracts,
        leagueFinancials: result.leagueFinancials,
        teamFinancials: result.teamFinancials,
        draftPickAssets: result.draftPickAssets,
      })

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

export { getPhaseEligibility } from "../phaseEligibility"
export type { LeagueCommand } from "./types"
export { commandRng } from "./rngSeeds"