import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type { LeagueRecord, Player, SeasonState } from "@workspace/shared/types"
import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"
import { emptyFuzz } from "@workspace/shared/skillRatings"

import { derivePeakAgeFallback } from "./development/generatePeakAge"
import { ensureDraftPickAssets } from "./draft/generateDraftOrder"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"
import { deriveReachRating } from "./playerGeneration/physicalProfile"
import {
  DEFAULT_PLAYER_MOOD,
  seedPlayerMood,
} from "./playerValue/moodSeed"

function normalizePlayer(player: Player): Player {
  const peakAge =
    player.peakAge ??
    derivePeakAgeFallback(
      player.age,
      player.ratings.overall,
      player.ratings.potential,
    )
  const tags = player.tags ?? []
  const nextTags =
    player.age >= VETERAN_MIN_AGE && !tags.includes(VETERAN_TAG)
      ? [...tags, VETERAN_TAG]
      : tags
  const wingspanInches = player.wingspanInches ?? player.heightInches + 2

  return {
    ...player,
    peakAge,
    wingspanInches,
    reachRating:
      player.reachRating ??
      deriveReachRating(wingspanInches - 2, wingspanInches),
    ratings: {
      ...player.ratings,
      fuzz: player.ratings.fuzz ?? emptyFuzz(),
    },
    tags: nextTags,
    mood: player.mood ?? seedPlayerMood(player.id) ?? DEFAULT_PLAYER_MOOD,
    performanceDrift: player.performanceDrift ?? 0,
    status:
      player.status === "injured" && !player.injury ? "active" : player.status,
    injury: player.injury ?? null,
  }
}

function normalizeTeams(state: SeasonState): SeasonState {
  return {
    ...state,
    teams: state.teams.map((team) => ({
      ...team,
      players: team.players.map(normalizePlayer),
    })),
  }
}

export function normalizeSeasonState(state: SeasonState): SeasonState {
  const withTeams = normalizeTeams(state)
  const withSchedule = {
    ...withTeams,
    schedule: withTeams.schedule.map((game) => ({
      ...game,
      gameType:
        game.gameType ??
        (game.seriesId ? ("playoff" as const) : ("regular" as const)),
    })),
  }

  if (withSchedule.phase) {
    return withSchedule
  }

  if (withSchedule.playoffBracket?.championTeamId) {
    return { ...withSchedule, phase: "complete" }
  }

  if (withSchedule.playoffBracket) {
    return { ...withSchedule, phase: "playoffs" }
  }

  if (isRegularSeasonComplete({ ...withSchedule, phase: "regular" })) {
    return { ...withSchedule, phase: "regular" }
  }

  return { ...withSchedule, phase: "regular" }
}

export function normalizeLeagueRecord(record: LeagueRecord): LeagueRecord {
  const normalizedState = normalizeSeasonState(record.seasonState)

  return {
    ...record,
    seasonHistory: record.seasonHistory ?? [],
    freeAgentPool: (record.freeAgentPool ?? []).map(normalizePlayer),
    draftPickAssets: ensureDraftPickAssets(
      record.draftPickAssets ?? [],
      normalizedState.teams.map((team) => team.id),
      normalizedState.season + 1
    ),
    tradeHistory: record.tradeHistory ?? [],
    pendingTradeOffers: record.pendingTradeOffers ?? [],
    draftClassCache: record.draftClassCache ?? null,
    leagueLog: record.leagueLog ?? [],
    owners: record.owners ?? [],
    ownerGoals: record.ownerGoals ?? [],
    seasonAwards: record.seasonAwards ?? [],
    playerCareerSnapshots: record.playerCareerSnapshots ?? [],
    playerSeasonProfiles: record.playerSeasonProfiles ?? [],
    teamFinancials: (record.teamFinancials ?? []).map((teamFinance) => ({
      ...teamFinance,
      deadCapCharges: teamFinance.deadCapCharges ?? [],
      roomMleUsed: teamFinance.roomMleUsed ?? 0,
      roomMleRemaining:
        teamFinance.roomMleRemaining ??
        record.leagueFinancials?.bySeason?.[normalizedState.season]?.mleRoom ??
        0,
      tradeExceptions: teamFinance.tradeExceptions ?? [],
    })),
    seasonState: normalizedState,
    rngNonce: record.rngNonce ?? 0,
    saveVersion: SAVE_VERSION,
  }
}
