import type { Contract } from "@workspace/shared/contractTypes"
import type { TeamFinancials } from "@workspace/shared/financialTypes"

import { roundMoney } from "./capMath"
import { getTeamDeadCapPayroll } from "./deadCap"

export function getActiveContracts(contracts: Contract[]): Contract[] {
  return contracts.filter((contract) => contract.status === "active")
}

export function getContractById(
  contracts: Contract[],
  contractId: string | null | undefined,
): Contract | undefined {
  if (!contractId) {
    return undefined
  }
  return contracts.find((contract) => contract.id === contractId)
}

export function getPlayerContract(
  contracts: Contract[],
  player: { activeContractId: string | null },
): Contract | undefined {
  return getContractById(contracts, player.activeContractId)
}

export function getContractPayroll(
  teamId: string,
  contracts: Contract[],
): number {
  const active = getActiveContracts(contracts).filter(
    (contract) => contract.teamId === teamId,
  )

  return roundMoney(
    active.reduce((sum, contract) => sum + (contract.yearlySalaries[0] ?? 0), 0),
  )
}

export function getTeamPayroll(
  teamId: string,
  contracts: Contract[],
  teamFinance?: Pick<TeamFinancials, "deadCapCharges">,
): number {
  const contractPayroll = getContractPayroll(teamId, contracts)
  const deadCap = teamFinance
    ? getTeamDeadCapPayroll(teamFinance.deadCapCharges)
    : 0
  return roundMoney(contractPayroll + deadCap)
}

export function getCurrentSalary(contract: Contract | undefined): number {
  return contract?.yearlySalaries[0] ?? 0
}

export function getYearsRemaining(contract: Contract | undefined): number {
  return contract?.yearlySalaries.length ?? 0
}
