import { DEAD_CAP_STRETCH_YEARS } from "@workspace/shared/financialConstants"
import type { Contract } from "@workspace/shared/contractTypes"
import type { DeadCapCharge } from "@workspace/shared/financialTypes"

import { roundMoney } from "./capMath"

export function getTeamDeadCapPayroll(charges: DeadCapCharge[]): number {
  return roundMoney(
    charges.reduce((sum, charge) => sum + charge.amount, 0),
  )
}

export function createDeadCapFromWaive(
  contract: Contract,
  playerId: string,
): DeadCapCharge[] {
  if (contract.contractType === "non_guaranteed") {
    return []
  }

  const remaining = roundMoney(
    contract.yearlySalaries.reduce((sum, salary) => sum + salary, 0),
  )
  if (remaining <= 0) {
    return []
  }

  const annualHit = roundMoney(remaining / DEAD_CAP_STRETCH_YEARS)
  const charges: DeadCapCharge[] = []

  for (let index = 0; index < DEAD_CAP_STRETCH_YEARS; index++) {
    charges.push({
      id: `dead_${contract.id}_${index + 1}`,
      playerId,
      amount: annualHit,
      seasonsRemaining: DEAD_CAP_STRETCH_YEARS - index,
      origin: "stretch",
    })
  }

  return charges
}

export function advanceDeadCapCharges(charges: DeadCapCharge[]): DeadCapCharge[] {
  return charges
    .map((charge) => ({
      ...charge,
      seasonsRemaining: charge.seasonsRemaining - 1,
    }))
    .filter((charge) => charge.seasonsRemaining > 0)
}
