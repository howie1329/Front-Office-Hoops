import type { Contract } from "@workspace/shared/types"

export function getNextContractOptionLabel(
  contract: Contract | undefined,
  yearsRemaining: number,
): string | null {
  if (!contract?.options?.length || yearsRemaining <= 0) {
    return null
  }

  const nextOption = contract.options.find(
    (option) => option.yearIndex === yearsRemaining - 1,
  )
  if (!nextOption) {
    return null
  }

  return nextOption.type === "team" ? "Team option next" : "Player option next"
}

export function getTradableRestrictionLabel(
  contract: Contract | undefined,
  currentDay: number | null,
): string | null {
  if (!contract?.tradableAfterDay || currentDay === null) {
    return null
  }

  if (currentDay >= contract.tradableAfterDay) {
    return null
  }

  return `Tradeable after day ${contract.tradableAfterDay}`
}
