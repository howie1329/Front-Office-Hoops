import type { LeagueRecord } from "@workspace/shared/types"

import { waiveContract } from "./createContract"

export function expireOneYearContracts(league: LeagueRecord): LeagueRecord {
  const expiringIds = new Set<string>()
  const contracts = league.contracts.map((contract) => {
    if (contract.status !== "active") {
      return contract
    }
    if (contract.yearlySalaries.length <= 1) {
      expiringIds.add(contract.playerId)
      return { ...contract, status: "expired" as const }
    }
    return contract
  })

  const newFreeAgents = league.seasonState.teams
    .flatMap((team) => team.players)
    .filter((player) => expiringIds.has(player.id))
    .map((player) => ({
      ...player,
      teamId: null,
      status: "free_agent" as const,
      activeContractId: null,
    }))

  const teams = league.seasonState.teams.map((team) => ({
    ...team,
    players: team.players.filter((player) => !expiringIds.has(player.id)),
  }))

  const freeAgentPool = [
    ...league.freeAgentPool.filter((player) => !expiringIds.has(player.id)),
    ...newFreeAgents,
  ]

  return {
    ...league,
    contracts,
    freeAgentPool,
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }
}

export function waivePlayerContract(
  league: LeagueRecord,
  playerId: string,
): LeagueRecord {
  const contract = league.contracts.find(
    (entry) => entry.playerId === playerId && entry.status === "active",
  )
  if (!contract) {
    return league
  }

  return {
    ...league,
    contracts: league.contracts.map((entry) =>
      entry.id === contract.id ? waiveContract(entry) : entry,
    ),
  }
}
