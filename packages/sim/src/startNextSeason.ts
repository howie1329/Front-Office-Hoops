import type {
  DraftPickAsset,
  LeagueRecord,
  Player,
  Rng,
  SeasonHistoryEntry,
  SeasonState,
} from "@workspace/shared/types"
import type {
  Contract,
  LeagueFinancials,
  TeamFinancials,
} from "@workspace/shared/types"

import { archiveSeason } from "./archiveSeason"
import { createInitialSeason } from "./createInitialSeason"
import { ensureDraftPickAssets } from "./draft/generateDraftOrder"
import { isDraftRequired } from "./draft/isDraftRequired"
import { finalizeSeason } from "./finalizeSeason"
import { prepareNewSeasonFinancials } from "./financials"
import {
  applyAiRosterTrimming,
  validateRostersForSeasonStart,
} from "./roster/rosterManagement"

export type StartNextSeasonInput = {
  seasonState: SeasonState
  userTeamId: string | null
  freeAgentPool: Player[]
  rng: Rng
  league?: Pick<
    LeagueRecord,
    | "contracts"
    | "leagueFinancials"
    | "teamFinancials"
    | "spendingProfileEvents"
  > &
    Partial<Pick<LeagueRecord, "draftPickAssets">>
}

export type StartNextSeasonResult = {
  seasonState: SeasonState
  historyEntry: SeasonHistoryEntry
  freeAgentPool: Player[]
  contracts: Contract[]
  leagueFinancials: LeagueFinancials
  teamFinancials: TeamFinancials[]
  draftPickAssets: DraftPickAsset[]
}

export function startNextSeason(
  input: StartNextSeasonInput
): StartNextSeasonResult {
  const { seasonState, userTeamId, rng, league } = input
  let { freeAgentPool } = input

  if (seasonState.phase !== "offseason") {
    throw new Error(
      "Season must be in the offseason before starting the next season"
    )
  }

  if (seasonState.offseasonPhase !== "free_agency") {
    throw new Error(
      "Season must reach free agency before starting the next season"
    )
  }

  if (isDraftRequired(seasonState.season)) {
    if (!seasonState.draftState?.completed) {
      throw new Error("Draft must be completed before starting the next season")
    }
  }

  if (userTeamId) {
    const userSize =
      seasonState.teams.find((team) => team.id === userTeamId)?.players
        .length ?? 0
    if (userSize > 12) {
      throw new Error(
        "Roster over limit — release players before starting the next season"
      )
    }
  }

  const trimmed = applyAiRosterTrimming(
    seasonState.teams,
    freeAgentPool,
    userTeamId,
    Object.fromEntries(
      league?.teamFinancials.map((entry) => [
        entry.teamId,
        entry.strategy.mode,
      ]) ?? []
    )
  )
  freeAgentPool = trimmed.freeAgentPool

  validateRostersForSeasonStart(trimmed.teams, userTeamId)

  const newSeason = seasonState.season + 1

  let financialBundle = {
    contracts: league?.contracts ?? [],
    leagueFinancials: league?.leagueFinancials ?? {
      baseCap: 141,
      growthRate: 0.05,
      bySeason: {},
    },
    teamFinancials: league?.teamFinancials ?? [],
    spendingProfileEvents: league?.spendingProfileEvents ?? [],
    draftPickAssets: league?.draftPickAssets ?? [],
    freeAgentPool,
    seasonState: {
      ...seasonState,
      teams: trimmed.teams,
    },
  } satisfies Pick<
    LeagueRecord,
    | "contracts"
    | "leagueFinancials"
    | "teamFinancials"
    | "spendingProfileEvents"
    | "draftPickAssets"
    | "freeAgentPool"
    | "seasonState"
  >

  if (league) {
    financialBundle = prepareNewSeasonFinancials(
      {
        ...financialBundle,
        id: "",
        name: "",
        saveVersion: 8,
        createdAt: "",
        updatedAt: "",
        userTeamId,
        seasonHistory: [],
        draftPickAssets: financialBundle.draftPickAssets,
        tradeHistory: [],
        leagueLog: [],
        owners: [],
        ownerGoals: [],
        seasonAwards: [],
        playerCareerSnapshots: [],
      },
      newSeason,
      rng
    )
    freeAgentPool = financialBundle.freeAgentPool
  }

  const stateForArchive = {
    ...financialBundle.seasonState,
    teams: trimmed.teams,
  }

  const finalized = finalizeSeason(stateForArchive)
  const historyEntry = archiveSeason(finalized, userTeamId)
  const nextSeasonState = createInitialSeason(
    financialBundle.seasonState.teams,
    finalized.baseSeed,
    rng,
    newSeason
  )
  const draftPickAssets = ensureDraftPickAssets(
    financialBundle.draftPickAssets,
    nextSeasonState.teams.map((team) => team.id),
    nextSeasonState.season + 1
  )

  return {
    seasonState: nextSeasonState,
    historyEntry,
    freeAgentPool,
    contracts: financialBundle.contracts,
    leagueFinancials: financialBundle.leagueFinancials,
    teamFinancials: financialBundle.teamFinancials,
    draftPickAssets,
  }
}
