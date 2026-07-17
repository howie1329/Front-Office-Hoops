import { ROSTER_MAX } from "@workspace/shared/constants"
import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type {
  DraftPickAsset,
  LeagueRecord,
  Player,
  PlayerDevelopmentRecord,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  PreseasonDevelopmentReport,
  RetirementEntry,
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
import {
  applyMinimumSalaryFloorPenalty,
  attachMissingRosterContracts,
} from "./financials"
import { applyPreseasonProgression } from "./preseason/applyPreseasonProgression"
import { purgeCampFringePlayers } from "./preseason/campPlayers"
import {
  applyAiRosterTrimming,
  validateRostersForSeasonStart,
} from "./roster/rosterManagement"

export type StartNextSeasonInput = {
  seasonState: SeasonState
  userTeamId: string | null
  freeAgentPool: Player[]
  rng: Rng
  playerSeasonStats?: PlayerSeasonStats[]
  playerSeasonProfiles?: PlayerSeasonProfile[]
  seasonHistory?: SeasonHistoryEntry[]
  league?: Pick<
    LeagueRecord,
    | "contracts"
    | "leagueFinancials"
    | "teamFinancials"
    | "spendingProfileEvents"
  > &
    Partial<
      Pick<
        LeagueRecord,
        "draftPickAssets" | "staff" | "staffContracts" | "collegeCoaches"
      >
    >
}

export type StartNextSeasonResult = {
  seasonState: SeasonState
  historyEntry: SeasonHistoryEntry
  freeAgentPool: Player[]
  contracts: Contract[]
  leagueFinancials: LeagueFinancials
  teamFinancials: TeamFinancials[]
  draftPickAssets: DraftPickAsset[]
  playerDevelopmentRecords: PlayerDevelopmentRecord[]
  developmentReport: PreseasonDevelopmentReport
  retiredPlayers: RetirementEntry[]
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
    if (userSize > ROSTER_MAX) {
      throw new Error(
        `Roster over limit (${userSize}/${ROSTER_MAX}) — release players before starting the next season`
      )
    }
    if (userSize < ROSTER_MAX) {
      throw new Error(
        `Roster under limit (${userSize}/${ROSTER_MAX}) — add or keep players before starting the next season`
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
    ),
    league?.contracts ?? []
  )
  freeAgentPool = trimmed.freeAgentPool

  validateRostersForSeasonStart(trimmed.teams, userTeamId)

  const priorSeason = seasonState.season
  const newSeason = priorSeason + 1

  if (league && league.leagueFinancials.currentCapSeason !== newSeason) {
    throw new Error(
      `Financial year ${newSeason} must be opened before starting the season`
    )
  }

  const progression = applyPreseasonProgression({
    teams: trimmed.teams,
    freeAgentPool,
    priorSeason,
    newSeason,
    playerSeasonStats: input.playerSeasonStats ?? seasonState.playerSeasonStats,
    playerSeasonProfiles: input.playerSeasonProfiles ?? [],
    baseSeed: seasonState.baseSeed,
    teamFinancials: league?.teamFinancials,
    seasonHistory: input.seasonHistory ?? [],
  })
  freeAgentPool = progression.freeAgentPool
  const teamsWithService = progression.teams.map((team) => ({
    ...team,
    players: team.players.map((player) => ({
      ...player,
      yearsOfService: player.yearsOfService + 1,
      seasonsWithTeam: player.seasonsWithTeam + 1,
    })),
  }))

  let financialBundle = {
    contracts: trimmed.contracts,
    leagueFinancials: league?.leagueFinancials ?? {
      baseCap: 141,
      growthRate: 0.05,
      currentCapSeason: newSeason,
      bySeason: {},
    },
    teamFinancials: league?.teamFinancials ?? [],
    spendingProfileEvents: league?.spendingProfileEvents ?? [],
    draftPickAssets: league?.draftPickAssets ?? [],
    freeAgentPool,
    seasonState: {
      ...seasonState,
      teams: teamsWithService,
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
    financialBundle = applyMinimumSalaryFloorPenalty(
      {
        ...financialBundle,
        id: "",
        name: "",
        saveVersion: SAVE_VERSION,
        createdAt: "",
        updatedAt: "",
        userTeamId,
        rngNonce: 0,
        seasonHistory: [],
        draftPickAssets: financialBundle.draftPickAssets,
        tradeHistory: [],
        pendingTradeOffers: [],
        contractOffers: [],
        reSigningNegotiations: [],
        draftClassCache: null,
        leagueLog: [],
        owners: [],
        ownerGoals: [],
        seasonAwards: [],
        playerCareerSnapshots: [],
        playerSeasonProfiles: [],
        playerDevelopmentRecords: [],
        developmentReports: [],
        retiredPlayers: [],
        staff: league.staff ?? [],
        staffContracts: league.staffContracts ?? [],
        collegeCoaches: league.collegeCoaches ?? [],
      },
      newSeason
    )
    freeAgentPool = financialBundle.freeAgentPool
  }

  const stateForArchive = {
    ...financialBundle.seasonState,
    teams: teamsWithService,
  }

  const finalized = finalizeSeason(stateForArchive)
  const historyEntry = archiveSeason(finalized, userTeamId)
  let nextSeasonState = createInitialSeason(
    financialBundle.seasonState.teams,
    finalized.baseSeed,
    rng,
    newSeason
  )

  if (league) {
    const purged = purgeCampFringePlayers(
      {
        seasonState: nextSeasonState,
        contracts: financialBundle.contracts,
        freeAgentPool,
      },
      newSeason
    )
    nextSeasonState = purged.seasonState
    financialBundle.contracts = purged.contracts
    freeAgentPool = purged.freeAgentPool

    const withCampContracts = attachMissingRosterContracts(
      {
        seasonState: nextSeasonState,
        contracts: financialBundle.contracts,
        leagueFinancials: financialBundle.leagueFinancials,
        teamFinancials: financialBundle.teamFinancials,
      },
      rng
    )
    nextSeasonState = withCampContracts.seasonState
    financialBundle.contracts = withCampContracts.contracts
  }
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
    playerDevelopmentRecords: progression.records,
    developmentReport: progression.report,
    retiredPlayers: progression.retirements,
  }
}
