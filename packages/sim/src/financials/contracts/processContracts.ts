import type { Contract, ContractOption } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"

import { getFairSalary } from "../../playerValue"
import { createDeadCapFromWaive } from "../deadCap"
import { deriveTeamOverall } from "../../playerRatings"
import { createLeagueLogEntry } from "../../leagueLog"
import { waiveContract } from "./createContract"
import { getSeasonFinancials } from "../capMath"
import { getTeamFinancialPosition } from "../teamFinancialPosition"
import { setOpeningExceptions } from "../assessSeasonFinances"
import { addCapHoldForPlayer } from "../capHolds"

export type ContractOptionDecisionReason =
  | "team_option_bargain"
  | "team_option_overpay"
  | "player_option_security"
  | "player_option_market_upgrade"

type ContractOptionDecision = {
  exercise: boolean
  reason: ContractOptionDecisionReason
}

function getPendingOption(contract: Contract): ContractOption | null {
  if (!contract.options?.length) {
    return null
  }
  return contract.options.find((option) => option.yearIndex === 0) ?? null
}

export function getPendingUserTeamOptions(
  league: LeagueRecord,
  teamId = league.userTeamId
): Contract[] {
  if (!teamId) {
    return []
  }

  return league.contracts.filter(
    (contract) =>
      contract.status === "active" &&
      contract.teamId === teamId &&
      getPendingOption(contract)?.type === "team"
  )
}

export function decideTeamOption(
  league: LeagueRecord,
  contractId: string,
  decision: "exercise" | "decline"
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "contract_options"
  ) {
    throw new Error(
      "Team options can only be decided during the contract options phase"
    )
  }
  if (!league.userTeamId) {
    throw new Error("User team must be selected before deciding a team option")
  }

  const contract = league.contracts.find((entry) => entry.id === contractId)
  const pendingOption = contract ? getPendingOption(contract) : null
  if (
    !contract ||
    contract.status !== "active" ||
    contract.teamId !== league.userTeamId ||
    pendingOption?.type !== "team"
  ) {
    throw new Error(
      "Contract does not have a pending team option for the user team"
    )
  }

  const player = league.seasonState.teams
    .find((team) => team.id === contract.teamId)
    ?.players.find((entry) => entry.id === contract.playerId)
  if (!player) {
    throw new Error("Player for team option was not found on the user roster")
  }

  if (decision === "exercise") {
    const guaranteedSalaries = [...contract.guaranteedSalaries]
    guaranteedSalaries[0] = contract.yearlySalaries[0] ?? 0
    return setOpeningExceptions({
      ...league,
      contracts: league.contracts.map((entry) =>
        entry.id === contract.id
          ? {
              ...entry,
              guaranteedSalaries,
              options: entry.options?.filter(
                (option) => option.yearIndex !== 0
              ),
            }
          : entry
      ),
      leagueLog: [
        ...league.leagueLog,
        createLeagueLogEntry({
          league,
          type: "option",
          teamId: contract.teamId,
          playerId: player.id,
          payload: {
            optionType: "team",
            decision: "exercised",
            reasonCode: "user_decision",
          },
        }),
      ],
    })
  }

  const teams = league.seasonState.teams.map((team) => {
    if (team.id !== contract.teamId) {
      return team
    }
    const players = team.players.filter((entry) => entry.id !== player.id)
    return { ...team, players, overall: deriveTeamOverall(players) }
  })
  let updated: LeagueRecord = {
    ...league,
    contracts: league.contracts.map((entry) =>
      entry.id === contract.id
        ? {
            ...entry,
            status: "declined" as const,
            options: entry.options?.filter((option) => option.yearIndex !== 0),
          }
        : entry
    ),
    freeAgentPool: [
      ...league.freeAgentPool.filter((entry) => entry.id !== player.id),
      movePlayerToFreeAgency(player),
    ],
    seasonState: { ...league.seasonState, teams },
    leagueLog: [
      ...league.leagueLog,
      createLeagueLogEntry({
        league,
        type: "option",
        teamId: contract.teamId,
        playerId: player.id,
        payload: {
          optionType: "team",
          decision: "declined",
          reasonCode: "user_decision",
        },
      }),
    ],
  }
  updated = addCapHoldForPlayer(
    updated,
    player,
    contract.teamId,
    contract.priorSeasonSalary ?? 0,
    league.leagueFinancials.currentCapSeason
  )
  return setOpeningExceptions(updated)
}

function shouldExerciseTeamOption(
  player: Player,
  contract: Contract,
  league: LeagueRecord
): ContractOptionDecision {
  const mode =
    league.teamFinancials.find((entry) => entry.teamId === contract.teamId)
      ?.strategy.mode ?? "buying"
  const salary = contract.yearlySalaries[0] ?? 0
  const season = league.leagueFinancials.currentCapSeason
  const fairSalary = getFairSalary(
    player,
    getSeasonFinancials(league.leagueFinancials, season),
    league
  )
  const position = getTeamFinancialPosition(league, contract.teamId, season)
  const taxCost = position.isOverTax
    ? Math.max(0, position.projectedTax) * 0.03
    : 0
  const modeBuffer = mode === "contending" ? 2 : mode === "selling" ? -1 : 0
  const exercise = fairSalary + modeBuffer >= salary + taxCost
  return {
    exercise,
    reason: exercise ? "team_option_bargain" : "team_option_overpay",
  }
}

function shouldExercisePlayerOption(
  player: Player,
  contract: Contract,
  league: LeagueRecord
): ContractOptionDecision {
  const season = league.leagueFinancials.currentCapSeason
  const salary = contract.yearlySalaries[0] ?? 0
  const fairSalary = getFairSalary(
    player,
    getSeasonFinancials(league.leagueFinancials, season),
    league
  )
  const loyaltySecurity = (player.mood.loyalty - 50) * 0.025
  const winningSecurity =
    league.teamFinancials.find((entry) => entry.teamId === contract.teamId)
      ?.strategy.mode === "contending"
      ? 0.75
      : 0
  const exercise = salary + loyaltySecurity + winningSecurity >= fairSalary
  return {
    exercise,
    reason: exercise
      ? "player_option_security"
      : "player_option_market_upgrade",
  }
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
  _rng: Rng
): LeagueRecord {
  let contracts = [...league.contracts]
  const declinedPlayerIds = new Set<string>()
  const declinedContracts = new Map<string, Contract>()
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

    if (
      pendingOption.type === "team" &&
      contract.teamId === league.userTeamId
    ) {
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

    const decision =
      pendingOption.type === "team"
        ? shouldExerciseTeamOption(player, contract, league)
        : shouldExercisePlayerOption(player, contract, league)

    if (decision.exercise) {
      const guaranteedSalaries = [...contract.guaranteedSalaries]
      guaranteedSalaries[0] = contract.yearlySalaries[0] ?? 0
      contracts[index] = {
        ...contract,
        guaranteedSalaries,
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
            reasonCode: decision.reason,
          },
        })
      )
      continue
    }

    declinedPlayerIds.add(player.id)
    contracts[index] = {
      ...contract,
      status: "declined",
      options: contract.options?.filter((option) => option.yearIndex !== 0),
    }
    declinedContracts.set(player.id, contracts[index]!)
    logEntries.push(
      createLeagueLogEntry({
        league,
        type: "option",
        teamId: contract.teamId,
        playerId: player.id,
        payload: {
          optionType: pendingOption.type,
          decision: "declined",
          reasonCode: decision.reason,
        },
      })
    )
  }

  const teams = league.seasonState.teams.map((team) => ({
    ...team,
    players: team.players
      .filter((player) => !declinedPlayerIds.has(player.id))
      .map((player) => {
        const contract = contracts.find(
          (entry) => entry.playerId === player.id && entry.status === "active"
        )
        if (!declinedPlayerIds.has(player.id)) {
          return {
            ...player,
            activeContractId:
              contract?.status === "active"
                ? contract.id
                : player.activeContractId,
          }
        }
        return player
      }),
    overall: deriveTeamOverall(
      team.players.filter((player) => !declinedPlayerIds.has(player.id))
    ),
  }))

  const newFreeAgents = league.seasonState.teams
    .flatMap((team) => team.players)
    .filter((player) => declinedPlayerIds.has(player.id))
    .map(movePlayerToFreeAgency)

  let updated: LeagueRecord = {
    ...league,
    contracts,
    leagueLog: logEntries,
    freeAgentPool: [
      ...league.freeAgentPool.filter(
        (player) => !declinedPlayerIds.has(player.id)
      ),
      ...newFreeAgents,
    ],
    seasonState: {
      ...league.seasonState,
      teams,
    },
  }

  for (const player of league.seasonState.teams
    .flatMap((team) => team.players)
    .filter((candidate) => declinedPlayerIds.has(candidate.id))) {
    const contract = declinedContracts.get(player.id)
    if (contract) {
      updated = addCapHoldForPlayer(
        updated,
        player,
        contract.teamId,
        contract.priorSeasonSalary ?? 0,
        league.leagueFinancials.currentCapSeason
      )
    }
  }

  return updated
}

export function waivePlayerContract(
  league: LeagueRecord,
  playerId: string
): LeagueRecord {
  const contract = league.contracts.find(
    (entry) => entry.playerId === playerId && entry.status === "active"
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
      entry.id === contract.id ? waiveContract(entry) : entry
    ),
  }
}
