import type { Contract } from "@workspace/shared/types"

export function validateContractGuarantees(contract: Contract):
  | { ok: true }
  | { ok: false; reason: string } {
  if (contract.guaranteedSalaries.length !== contract.yearlySalaries.length) {
    return { ok: false, reason: "Guarantee schedule must match salary schedule" }
  }
  for (let index = 0; index < contract.yearlySalaries.length; index++) {
    const salary = contract.yearlySalaries[index] ?? 0
    const guaranteed = contract.guaranteedSalaries[index] ?? 0
    if (guaranteed < 0 || guaranteed > salary) {
      return {
        ok: false,
        reason: "Guaranteed salary must be between zero and annual salary",
      }
    }
  }
  return { ok: true }
}

export function assertValidContractGuarantees(contract: Contract): void {
  const validation = validateContractGuarantees(contract)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }
}
