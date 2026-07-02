import type { Contract } from "@workspace/shared/contractTypes"

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

export function getTeamPayroll(
  teamId: string,
  contracts: Contract[],
): number {
  const active = getActiveContracts(contracts).filter(
    (contract) => contract.teamId === teamId,
  )

  return active.reduce((sum, contract) => sum + (contract.yearlySalaries[0] ?? 0), 0)
}

export function getCurrentSalary(contract: Contract | undefined): number {
  return contract?.yearlySalaries[0] ?? 0
}

export function getYearsRemaining(contract: Contract | undefined): number {
  return contract?.yearlySalaries.length ?? 0
}
