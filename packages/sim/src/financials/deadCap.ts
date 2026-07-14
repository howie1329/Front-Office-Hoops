import type { Contract } from "@workspace/shared/contractTypes"
import type { DeadCapCharge } from "@workspace/shared/financialTypes"

import { roundMoney } from "./capMath"
import { assertValidContractGuarantees } from "./contracts/validateContract"

export function getTeamDeadCapPayroll(charges: DeadCapCharge[]): number {
  return roundMoney(
    charges.reduce((sum, charge) => sum + charge.amount, 0),
  )
}

export function createDeadCapFromWaive(
  contract: Contract,
  playerId: string,
): DeadCapCharge[] {
  assertValidContractGuarantees(contract)
  return contract.guaranteedSalaries.flatMap((amount, index) => {
    const rounded = roundMoney(amount)
    return rounded <= 0
      ? []
      : [{
      id: `dead_${contract.id}_${index + 1}`,
      playerId,
      amount: rounded,
      seasonsRemaining: index + 1,
      origin: "waive" as const,
    }]
  })
}

export function advanceDeadCapCharges(charges: DeadCapCharge[]): DeadCapCharge[] {
  return charges
    .map((charge) => ({
      ...charge,
      seasonsRemaining: charge.seasonsRemaining - 1,
    }))
    .filter((charge) => charge.seasonsRemaining > 0)
}
