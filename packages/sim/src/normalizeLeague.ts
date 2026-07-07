import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type { LeagueRecord, Player, SeasonState } from "@workspace/shared/types"
import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"

import { derivePeakAgeFallback } from "./development/generatePeakAge"
import { ensureDraftPickAssets } from "./draft/generateDraftOrder"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"

function normalizePlayer(player: Player): Player {
  const peakAge =
    player.peakAge ??
    derivePeakAgeFallback(
      player.age,
      player.ratings.overall,
      player.ratings.potential
    )
  const tags = player.tags ?? []
  const nextTags =
    player.age >= VETERAN_MIN_AGE && !tags.includes(VETERAN_TAG)
      ? [...tags, VETERAN_TAG]
      : tags

  return {
    ...player,
    peakAge,
    tags: nextTags,
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
    freeAgentPool: record.freeAgentPool ?? [],
    draftPickAssets: ensureDraftPickAssets(
      record.draftPickAssets ?? [],
      normalizedState.teams.map((team) => team.id),
      normalizedState.season + 1
    ),
    tradeHistory: record.tradeHistory ?? [],
    leagueLog: record.leagueLog ?? [],
    owners: record.owners ?? [],
    ownerGoals: record.ownerGoals ?? [],
    seasonAwards: record.seasonAwards ?? [],
    playerCareerSnapshots: record.playerCareerSnapshots ?? [],
    playerSeasonProfiles: record.playerSeasonProfiles ?? [],
    seasonState: normalizedState,
    rngNonce: record.rngNonce ?? 0,
    saveVersion: SAVE_VERSION,
  }
}
