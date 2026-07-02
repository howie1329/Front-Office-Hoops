import { DRAFT_ROUNDS } from "@workspace/shared/constants"

export function isDraftRequired(completedSeason: number): boolean {
  return completedSeason >= 2
}

export function getDraftPickCount(teamCount: number): number {
  return teamCount * DRAFT_ROUNDS
}
