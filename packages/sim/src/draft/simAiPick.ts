import type { Player, SeasonState } from "@workspace/shared/types"

import { aiSelectProspect } from "./aiSelectProspect"
import { makeDraftPick } from "./makeDraftPick"
import { getCurrentDraftPick } from "./prepareDraft"

export function simAiPick(
  state: SeasonState,
  freeAgentPool: Player[],
): { seasonState: SeasonState; freeAgentPool: Player[] } {
  const draftState = state.draftState
  if (!draftState || draftState.completed) {
    throw new Error("Draft is not in progress")
  }

  const currentPick = getCurrentDraftPick(state)
  if (!currentPick) {
    throw new Error("No current draft pick")
  }

  const team = state.teams.find((entry) => entry.id === currentPick.teamId)
  if (!team) {
    throw new Error(`Team not found: ${currentPick.teamId}`)
  }

  const prospect = aiSelectProspect(team, draftState.prospects)
  return makeDraftPick(state, prospect.id, freeAgentPool)
}

export function simToUserPick(
  state: SeasonState,
  userTeamId: string | null,
  freeAgentPool: Player[],
): { seasonState: SeasonState; freeAgentPool: Player[] } {
  let workingState = state
  let workingPool = freeAgentPool
  let safety = 0

  while (
    workingState.draftState &&
    !workingState.draftState.completed &&
    safety < 200
  ) {
    const currentPick = getCurrentDraftPick(workingState)
    if (!currentPick) {
      break
    }

    if (userTeamId && currentPick.teamId === userTeamId) {
      break
    }

    const result = simAiPick(workingState, workingPool)
    workingState = result.seasonState
    workingPool = result.freeAgentPool
    safety += 1
  }

  return {
    seasonState: workingState,
    freeAgentPool: workingPool,
  }
}

export function simDraftUntilComplete(
  state: SeasonState,
  freeAgentPool: Player[],
): { seasonState: SeasonState; freeAgentPool: Player[] } {
  let workingState = state
  let workingPool = freeAgentPool
  let safety = 0

  while (
    workingState.draftState &&
    !workingState.draftState.completed &&
    safety < 200
  ) {
    const result = simAiPick(workingState, workingPool)
    workingState = result.seasonState
    workingPool = result.freeAgentPool
    safety += 1
  }

  return {
    seasonState: workingState,
    freeAgentPool: workingPool,
  }
}
