import { DRAFT_CLASS_MULTIPLIER, DRAFT_ROUNDS } from "@workspace/shared/constants"

export function isDraftRequired(completedSeason: number): boolean {
  return completedSeason >= 1
}

export function getDraftPickCount(teamCount: number): number {
  return teamCount * DRAFT_ROUNDS
}

export function getDraftClassSize(teamCount: number): number {
  return Math.ceil(getDraftPickCount(teamCount) * DRAFT_CLASS_MULTIPLIER)
}
