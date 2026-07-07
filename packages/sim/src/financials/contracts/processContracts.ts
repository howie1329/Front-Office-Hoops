import type { Contract, ContractOption } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"

import { calculateRosterKeepValue } from "../../playerValue"
import { createDeadCapFromWaive } from "../deadCap"
import { deriveTeamOverall } from "../../playerRatings"
import { createLeagueLogEntry } from "../../leagueLog"
import { waiveContract } from "./createContract"

function getPendingOption(contract: Contract): ContractOption | null {
  if (!contract.options?.length) {
    return null
  }
  return contract.options.find((option) => option.yearIndex === 0) ?? null
}

function shouldExerciseTeamOption(
  player: Player,
  contract: Contract,
  league: LeagueRecord,
): boolean {
  const mode =
    league.teamFinancials.find((entry) => entry.teamId === contract.teamId)
      ?.strategy.mode ?? "buying"
  const keepValue = calculateRosterKeepValue(player, mode)
  const salary = contract.yearlySalaries[0] ?? 0
  return keepValue >= salary * 0.92
}

function shouldExercisePlayerOption(
  player: Player,
  contract: Contract,
  league: LeagueRecord,
): boolean {
  const mode =
    league.teamFinancials.find((entry) => entry.teamId === contract.teamId)
      ?.strategy.mode ?? "buying"
  if (mode === "contending" && player.ratings.overall >= 72) {
    return true
  }
  return player.mood.loyalty >= 70
}

function movePlayerToFreeAgency(player: Player): Player {
  return {
    ...player,
    teamId: null,
    status: "free_agent",
    activeContractId: null,
    seasonsWithTeam: 0,
  }
}

export function processContractOptions(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let contracts = [...league.contracts]
  const declinedPlayerIds = new Set<string>()
  const logEntries = [...league.leagueLog]

  for (let index = 0; index < contracts.length; index++) {
    const contract = contracts[index]!
    if (contract.status !== "active") {
      continue
    }

    const pendingOption = getPendingOption(contract)
    if (!pendingOption) {
      continue
    }

    const player =
      league.seasonState.teams
        .flatMap((team) => team.players)
        .find((entry) => entry.id === contract.playerId) ??
      league.freeAgentPool.find((entry) => entry.id === contract.playerId)

    if (!player) {
      continue
    }

    const exercise =
      pendingOption.type === "team"
        ? shouldExerciseTeamOption(player, contract, league)
        : shouldExercisePlayerOption(player, contract, league) || rng.next() > 0.35

    if (exercise) {
      contracts[index] = {
        ...contract,
        options: contract.options?.filter((option) => option.yearIndex !== 0),
      }
      logEntries.push(
        createLeagueLogEntry({
          league,
          type: "option",
          teamId: contract.teamId,
          playerId: player.id,
          payload: {
            optionType: pendingOption.type,
            decision: "exercised",
          },
        }),
      )
      continue
    }

    declinedPlayerIds.add(player.id)
    contracts[index] = { ...contract, status: "declined" }
    logEntries.push(
      createLeagueLogEntry({
        league,
        type: "option",
        teamId: contract.teamId,
        playerId: player.id,
        payload: {
          optionType: pendingOption.type,
          decision: "declined",
        },
      }),
    )
  }

  const teams = league.seasonState.teams.map((team) => ({
    ...team,
    players: team.players
      .filter((player) => !declinedPlayerIds.has(player.id))
      .map((player) => {
        const contract = contracts.find(
          (entry) =>
            entry.playerId === player.id &&
            (entry.status === "active" || entry.status === "declined"),
        )
        if (!declinedPlayerIds.has(player.id)) {
          return {
            ...player,
            activeContractId:
              contract?.status === "active" ? contract.id : player.activeContractId,
          }
        }
        return player
      }),
    overall: deriveTeamOverall(
      team.players.filter((player) => !declinedPlayerIds.has(player.id)),
    ),
  }))

  const newFreeAgents = league.seasonState.teams
    .flatMap((team) => team.players)
    .filter((player) => declinedPlayerIds.has(player.id))
    .map(movePlayerToFreeAgency)

  return {
    ...league,
    contracts,
    leagueLog: logEntries,
    freeAgentPool: [
      ...league.freeAgentPool.filter((player) => !declinedPlayerIds.has(player.id)),
      ...newFreeAgents,
    ],
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

  const deadCapCharges = createDeadCapFromWaive(contract, playerId)
  const teamFinancials = league.teamFinancials.map((entry) => {
    if (entry.teamId !== contract.teamId) {
      return entry
    }
    return {
      ...entry,
      deadCapCharges: [...entry.deadCapCharges, ...deadCapCharges],
    }
  })

  return {
    ...league,
    teamFinancials,
    contracts: league.contracts.map((entry) =>
      entry.id === contract.id ? waiveContract(entry) : entry,
    ),
  }
}

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
