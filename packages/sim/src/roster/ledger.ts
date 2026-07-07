import type {
  LeagueRecord,
  Player,
  SeasonState,
  TeamWithRoster,
} from "@workspace/shared/types"

import { attachRookieContractsForDraftSelections } from "../financials"
import { waivePlayerContract } from "../financials/contracts/processContracts"
import { appendLeagueLog, createLeagueLogEntry } from "../leagueLog"
import { deriveTeamOverall } from "../playerRatings"
import { releasePlayer } from "./rosterManagement"

export function findPlayer(
  league: LeagueRecord,
  playerId: string
): Player | null {
  const onRoster = league.seasonState.teams
    .flatMap((team) => team.players)
    .find((player) => player.id === playerId)

  if (onRoster) {
    return onRoster
  }

  return league.freeAgentPool.find((player) => player.id === playerId) ?? null
}

export function findPlayerTeam(
  league: LeagueRecord,
  playerId: string
): TeamWithRoster | null {
  return (
    league.seasonState.teams.find((team) =>
      team.players.some((player) => player.id === playerId)
    ) ?? null
  )
}

export function findTeam(
  league: LeagueRecord,
  teamId: string
): TeamWithRoster | undefined {
  return league.seasonState.teams.find((team) => team.id === teamId)
}

export function findPlayersOnTeam(
  team: TeamWithRoster,
  playerIds: string[]
): Player[] {
  const ids = new Set(playerIds)
  return team.players.filter((player) => ids.has(player.id))
}

export function getUserRosterSize(league: LeagueRecord): number {
  if (!league.userTeamId) {
    return 0
  }

  return (
    league.seasonState.teams.find((team) => team.id === league.userTeamId)
      ?.players.length ?? 0
  )
}

export function cutCampInviteFromTeam(
  league: LeagueRecord,
  input: { teamId: string; playerId: string },
): LeagueRecord {
  const updated = waivePlayerContract(league, input.playerId)
  const team = updated.seasonState.teams.find((entry) => entry.id === input.teamId)
  if (!team) {
    throw new Error(`Team not found: ${input.teamId}`)
  }

  const nextPlayers = team.players.filter((entry) => entry.id !== input.playerId)
  const nextTeams = updated.seasonState.teams.map((entry) =>
    entry.id === input.teamId
      ? {
          ...entry,
          players: nextPlayers,
          overall: deriveTeamOverall(nextPlayers),
        }
      : entry,
  )

  return {
    ...updated,
    seasonState: {
      ...updated.seasonState,
      teams: nextTeams,
    },
  }
}

export function releasePlayerFromTeam(
  league: LeagueRecord,
  input: { teamId: string; playerId: string }
): LeagueRecord {
  const updated = waivePlayerContract(league, input.playerId)
  const result = releasePlayer(
    updated.seasonState.teams,
    updated.freeAgentPool,
    input
  )

  const withRoster: LeagueRecord = {
    ...updated,
    seasonState: {
      ...updated.seasonState,
      teams: result.teams,
    },
    freeAgentPool: result.freeAgentPool,
  }

  return appendLeagueLog(withRoster, [
    createLeagueLogEntry({
      league: withRoster,
      type: "release",
      teamId: input.teamId,
      playerId: input.playerId,
      payload: {},
    }),
  ])
}

export function applyDraftSelections(
  league: LeagueRecord,
  before: LeagueRecord,
  result: { seasonState: SeasonState; freeAgentPool: Player[] }
): LeagueRecord {
  const updated: LeagueRecord = {
    ...league,
    seasonState: result.seasonState,
    freeAgentPool: result.freeAgentPool,
  }

  const withContracts = attachRookieContractsForDraftSelections(updated)
  const priorSelections = new Set(
    before.seasonState.draftState?.selections.map(
      (selection) => selection.playerId
    ) ?? []
  )
  const nextSelections =
    withContracts.seasonState.draftState?.selections.filter(
      (selection) => !priorSelections.has(selection.playerId)
    ) ?? []

  if (nextSelections.length === 0) {
    return withContracts
  }

  return appendLeagueLog(
    withContracts,
    nextSelections.map((selection, index) =>
      createLeagueLogEntry({
        league: withContracts,
        type: "draft_selection",
        teamId: selection.teamId,
        playerId: selection.playerId,
        payload: {
          round: selection.round,
          overallPick: selection.overallPick,
          prospectId: selection.prospectId,
        },
        sequence: index + 1,
      })
    )
  )
}
