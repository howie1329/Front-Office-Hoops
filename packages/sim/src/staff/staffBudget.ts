import type { Owner, OwnerArchetype } from "@workspace/shared/types"

const BUDGET_BY_ARCHETYPE: Record<OwnerArchetype, number> = {
  frugal: 4,
  patient: 6,
  win_now: 10,
  meddling: 7,
  hands_off: 7,
  analytics: 6,
}

export function staffBudgetForOwner(owner: Owner | undefined): number {
  if (!owner) {
    return 6
  }
  return BUDGET_BY_ARCHETYPE[owner.archetype] ?? 6
}
