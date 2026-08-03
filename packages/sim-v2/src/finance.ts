import type {
  ContractLifecycleStatus,
  ContractEntity,
  JsonRecord,
  LeagueDocument,
} from "@workspace/domain-v2"

import { createEconomySnapshot } from "./economy"
import { STANDARD_ECONOMY_CONFIG } from "./marketConfig"

export type FinanceSeasonProjection = {
  season: number
  softCap: number
  taxLine: number
  payroll: number
  deadMoney: number
  capRoom: number
  taxRoom: number
}

export type FinanceContractProjection = {
  contractId: string | null
  playerId: string
  teamId: string | null
  annualSalary: number[]
  years: number
  startSeason: number | null
  endSeason: number | null
  totalValue: number
  source: string | null
  expiringSeason: number | null
  status?: ContractLifecycleStatus
}

export type TeamFinanceProjection = {
  version: 1
  teamId: string
  currentSeason: number
  horizon: number
  seasons: FinanceSeasonProjection[]
  contracts: FinanceContractProjection[]
}

type NormalizedContract = FinanceContractProjection & {
  teamId: string | null
  status: ContractLifecycleStatus
}

function numberField(record: JsonRecord, key: string): number | null {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function stringField(record: JsonRecord, key: string): string | null {
  const value = record[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function isReleasedContract(
  contract: Pick<NormalizedContract, "status">
): boolean {
  return contract.status === "released"
}

function isTypedContract(
  contract: JsonRecord
): contract is JsonRecord & ContractEntity {
  return (
    typeof contract.playerId === "string" &&
    typeof contract.teamId === "string" &&
    typeof contract.startSeason === "number" &&
    typeof contract.endSeason === "number" &&
    typeof contract.years === "number" &&
    Array.isArray(contract.annualSalary) &&
    contract.annualSalary.every(
      (salary): salary is number =>
        typeof salary === "number" && Number.isFinite(salary)
    )
  )
}

function normalizeContract(
  id: string,
  contract: JsonRecord,
  currentSeason: number
): NormalizedContract | null {
  if (isTypedContract(contract)) {
    const annualSalary = contract.annualSalary.map((salary) =>
      Math.max(0, salary)
    )

    return {
      contractId: id,
      playerId: contract.playerId,
      teamId: contract.teamId,
      annualSalary,
      years: annualSalary.length,
      startSeason: contract.startSeason,
      endSeason: contract.endSeason,
      totalValue: annualSalary.reduce((sum, salary) => sum + salary, 0),
      source: contract.source,
      expiringSeason: contract.endSeason,
      status: contract.status ?? "active",
    }
  }

  const salary = numberField(contract, "salary")
  const yearsRemaining = numberField(contract, "yearsRemaining")
  if (salary === null || yearsRemaining === null || yearsRemaining <= 0) {
    return null
  }

  const years = Math.max(1, Math.floor(yearsRemaining))
  const annualSalary = Array.from({ length: years }, () => Math.max(0, salary))
  const endSeason = currentSeason + years - 1

  return {
    contractId: id,
    playerId: stringField(contract, "playerId") ?? "",
    teamId: stringField(contract, "teamId"),
    annualSalary,
    years,
    startSeason: currentSeason,
    endSeason,
    totalValue: annualSalary.reduce((sum, value) => sum + value, 0),
    source: stringField(contract, "source"),
    expiringSeason: endSeason,
    status: "active",
  }
}

function playerIdsForTeam(league: LeagueDocument, teamId: string): string[] {
  return league.entities.teams[teamId]?.rosterPlayerIds ?? []
}

function getTeamContracts(
  league: LeagueDocument,
  teamId: string
): NormalizedContract[] {
  const currentSeason = league.state.season
  const rosterPlayerIds = new Set(playerIdsForTeam(league, teamId))
  const freeAgentIds = new Set(
    Object.values(league.entities.players)
      .filter((player) => player.leagueStatus.kind === "free-agent")
      .map((player) => player.id)
  )

  return Object.entries(league.entities.contracts)
    .map(([id, contract]) => normalizeContract(id, contract, currentSeason))
    .filter((contract): contract is NormalizedContract =>
      Boolean(contract && contract.teamId === teamId)
    )
    .map((contract) => {
      const isLegacyRelease =
        !rosterPlayerIds.has(contract.playerId) &&
        freeAgentIds.has(contract.playerId)

      return isLegacyRelease && contract.status !== "released"
        ? { ...contract, status: "released" as const }
        : contract
    })
}

function salaryForSeason(contract: NormalizedContract, season: number): number {
  if (
    contract.startSeason === null ||
    season < contract.startSeason ||
    contract.endSeason === null ||
    season > contract.endSeason
  ) {
    return 0
  }

  const index = season - contract.startSeason
  return contract.annualSalary[index] ?? 0
}

function emptyContract(playerId: string): NormalizedContract {
  return {
    contractId: null,
    playerId,
    teamId: null,
    annualSalary: [],
    years: 0,
    startSeason: null,
    endSeason: null,
    totalValue: 0,
    source: null,
    expiringSeason: null,
    status: "active",
  }
}

export function projectTeamFinance(
  league: LeagueDocument,
  teamId: string,
  horizon = 5
): TeamFinanceProjection {
  const safeHorizon = Math.max(1, Math.floor(horizon))
  const currentSeason = league.state.season
  const teamContracts = getTeamContracts(league, teamId)
  const contractByPlayerId = new Map(
    teamContracts
      .filter((contract) => !isReleasedContract(contract))
      .map((contract) => [contract.playerId, contract])
  )
  const deadMoneyContracts = teamContracts.filter(isReleasedContract)
  const contracts = playerIdsForTeam(league, teamId).map(
    (playerId) => contractByPlayerId.get(playerId) ?? emptyContract(playerId)
  )
  const seasons = Array.from({ length: safeHorizon }, (_, index) => {
    const season = currentSeason + index
    const economy = createEconomySnapshot(season, STANDARD_ECONOMY_CONFIG)
    const activePayroll = contracts.reduce(
      (sum, contract) => sum + salaryForSeason(contract, season),
      0
    )
    const deadMoney = deadMoneyContracts.reduce(
      (sum, contract) => sum + salaryForSeason(contract, season),
      0
    )
    const payroll = activePayroll + deadMoney

    return {
      season,
      softCap: economy.softCap,
      taxLine: economy.taxLine,
      payroll,
      deadMoney,
      capRoom: economy.softCap - payroll,
      taxRoom: economy.taxLine - payroll,
    }
  })

  return {
    version: 1,
    teamId,
    currentSeason,
    horizon: safeHorizon,
    seasons,
    contracts,
  }
}

export function getContractSalary(
  contract: JsonRecord | undefined,
  season = 1
): number | null {
  if (!contract) return null

  if (isTypedContract(contract)) {
    const index = season - contract.startSeason
    const salary = contract.annualSalary[index]
    return typeof salary === "number" && Number.isFinite(salary) ? salary : null
  }

  return numberField(contract, "salary")
}

export function getContractYearsRemaining(
  contract: JsonRecord | undefined,
  currentSeason = 1
): number | null {
  if (!contract) return null

  if (isTypedContract(contract)) {
    return Math.max(0, contract.endSeason - currentSeason + 1)
  }

  return numberField(contract, "yearsRemaining")
}
