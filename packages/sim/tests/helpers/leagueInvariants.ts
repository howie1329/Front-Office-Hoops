import { expect } from "vitest"

import {
  CAMP_ROSTER_MAX,
  ROSTER_MAX,
  ROSTER_MIN,
} from "@workspace/shared/constants"
import type { LeagueRecord, Player } from "@workspace/shared/types"

function expectUnique(values: string[], label: string): void {
  expect(new Set(values).size, `${label} must be unique`).toBe(values.length)
}

function allRosterPlayers(league: LeagueRecord): Player[] {
  return league.seasonState.teams.flatMap((team) => team.players)
}

export function expectLeagueInvariants(league: LeagueRecord): void {
  expect(league.leagueFinancials.currentCapSeason).toBe(
    league.seasonState.phase === "offseason"
      ? league.seasonState.season + 1
      : league.seasonState.season
  )
  for (const contract of league.contracts.filter(
    (entry) => entry.status === "active"
  )) {
    expect(contract.yearlySalaries.length).toBeGreaterThan(0)
    expect(contract.guaranteedSalaries).toHaveLength(
      contract.yearlySalaries.length
    )
  }
  for (const hold of league.teamFinancials.flatMap((entry) => entry.capHolds)) {
    if (hold.status === "active") {
      expect(hold.season).toBe(league.leagueFinancials.currentCapSeason)
    }
  }
  const teams = league.seasonState.teams
  const teamIds = new Set(teams.map((team) => team.id))
  const rosterPlayers = allRosterPlayers(league)
  const rosterPlayerIds = new Set(rosterPlayers.map((player) => player.id))
  const freeAgentIds = new Set(league.freeAgentPool.map((player) => player.id))
  const allPlayerIds = [
    ...rosterPlayers.map((player) => player.id),
    ...league.freeAgentPool.map((player) => player.id),
  ]
  const enforceRosterMinimum = league.seasonState.phase !== "offseason"
  const maxRosterSize =
    league.seasonState.phase === "preseason"
      ? CAMP_ROSTER_MAX
      : league.seasonState.phase === "offseason"
        ? ROSTER_MAX + 3
        : ROSTER_MAX

  expectUnique(
    teams.map((team) => team.id),
    "team IDs"
  )
  expectUnique(allPlayerIds, "player IDs")

  for (const team of teams) {
    if (enforceRosterMinimum) {
      expect(
        team.players.length,
        `${team.id} roster must be above minimum`
      ).toBeGreaterThanOrEqual(ROSTER_MIN)
    }
    expect(
      team.players.length,
      `${team.id} roster must be below maximum`
    ).toBeLessThanOrEqual(maxRosterSize)

    for (const player of team.players) {
      expect(player.teamId, `${player.id} teamId must match roster`).toBe(
        team.id
      )
      expect(
        player.status,
        `${player.id} roster status must not be free agent`
      ).not.toBe("free_agent")
      expect(
        league.contracts.some(
          (contract) =>
            contract.id === player.activeContractId &&
            contract.playerId === player.id &&
            contract.teamId === team.id &&
            contract.status === "active"
        ),
        `${player.id} must have an active contract on roster team`
      ).toBe(true)
    }
  }

  for (const player of league.freeAgentPool) {
    expect(player.teamId, `${player.id} free agent teamId`).toBeNull()
    expect(player.status, `${player.id} free agent status`).toBe("free_agent")
  }

  for (const contract of league.contracts.filter(
    (entry) => entry.status === "active"
  )) {
    expect(
      rosterPlayerIds.has(contract.playerId),
      `${contract.id} player`
    ).toBe(true)
    expect(teamIds.has(contract.teamId), `${contract.id} team`).toBe(true)
  }

  for (const pick of league.draftPickAssets) {
    expect(teamIds.has(pick.currentTeamId), `${pick.id} current owner`).toBe(
      true
    )
    expect(teamIds.has(pick.originalTeamId), `${pick.id} original owner`).toBe(
      true
    )
  }

  expect(league.owners).toHaveLength(teams.length)
  expectUnique(
    league.owners.map((owner) => owner.teamId),
    "owner team IDs"
  )
  for (const owner of league.owners) {
    expect(teamIds.has(owner.teamId), `${owner.id} team`).toBe(true)
  }

  for (const goal of league.ownerGoals) {
    expect(teamIds.has(goal.teamId), `${goal.id} team`).toBe(true)
  }

  for (const game of league.seasonState.schedule) {
    expect(teamIds.has(game.homeTeamId), `${game.id} home team`).toBe(true)
    expect(teamIds.has(game.awayTeamId), `${game.id} away team`).toBe(true)
    if (game.status === "final") {
      expect(game.gameId, `${game.id} final game link`).toBeTruthy()
    }
  }

  for (const game of league.seasonState.games) {
    expect(teamIds.has(game.homeTeamId), `${game.id} home team`).toBe(true)
    expect(teamIds.has(game.awayTeamId), `${game.id} away team`).toBe(true)
    expect(teamIds.has(game.result.winnerId), `${game.id} winner`).toBe(true)
    for (const line of [
      ...game.result.homePlayerStats,
      ...game.result.awayPlayerStats,
    ]) {
      expect(teamIds.has(line.teamId), `${game.id}/${line.playerId} team`).toBe(
        true
      )
    }
  }

  for (const stats of league.seasonState.playerSeasonStats) {
    expect(teamIds.has(stats.teamId), `${stats.id} team`).toBe(true)
  }

  for (const profile of league.playerSeasonProfiles) {
    expect(teamIds.has(profile.teamId), `${profile.id} team`).toBe(true)
  }

  if (league.seasonState.phase === "offseason") {
    expect(league.seasonState.offseasonPhase).toBeTruthy()
  } else {
    expect(league.seasonState.offseasonPhase).toBeUndefined()
  }

  if (league.userTeamId) {
    expect(teamIds.has(league.userTeamId), "user team").toBe(true)
  }

  expect(freeAgentIds.size).toBe(league.freeAgentPool.length)
}
