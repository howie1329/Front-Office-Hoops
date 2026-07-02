import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type { LeagueRecord, Player, SeasonState } from "@workspace/shared/types"
import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"

import { migratePeakAge } from "./development/generatePeakAge"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"
import { migrateV4ToV5 } from "./financials/migrateV4ToV5"

function normalizePlayer(player: Player): Player {
  const peakAge =
    player.peakAge ??
    migratePeakAge(player.age, player.ratings.overall, player.ratings.potential)
  const tags = player.tags ?? []
  const nextTags =
    player.age >= VETERAN_MIN_AGE && !tags.includes(VETERAN_TAG)
      ? [...tags, VETERAN_TAG]
      : tags

  return {
    ...player,
    peakAge,
    tags: nextTags,
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

  if (withTeams.phase) {
    return withTeams
  }

  if (withTeams.playoffBracket?.championTeamId) {
    return { ...withTeams, phase: "complete" }
  }

  if (withTeams.playoffBracket) {
    return { ...withTeams, phase: "playoffs" }
  }

  if (isRegularSeasonComplete({ ...withTeams, phase: "regular" })) {
    return { ...withTeams, phase: "regular" }
  }

  return { ...withTeams, phase: "regular" }
}

export function normalizeLeagueRecord(record: LeagueRecord): LeagueRecord {
  const normalizedState = normalizeSeasonState(record.seasonState)
  const saveVersion = record.saveVersion ?? 2

  let normalized: LeagueRecord = {
    ...record,
    seasonHistory: record.seasonHistory ?? [],
    freeAgentPool: record.freeAgentPool ?? [],
    seasonState: normalizedState,
    saveVersion,
  }

  if (saveVersion < 5) {
    normalized = migrateV4ToV5(normalized)
  }

  return {
    ...normalized,
    saveVersion: SAVE_VERSION,
  }
}
