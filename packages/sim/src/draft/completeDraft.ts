import type { DraftState, Player, SeasonState } from "@workspace/shared/types"

import { convertProspectToFreeAgent } from "./convertProspect"

export function finalizeDraftPool(
  draftState: DraftState,
  freeAgentPool: Player[],
): { draftState: DraftState; freeAgentPool: Player[] } {
  const undrafted = draftState.prospects.map(convertProspectToFreeAgent)

  return {
    draftState: {
      ...draftState,
      prospects: [],
      completed: true,
    },
    freeAgentPool: [...freeAgentPool, ...undrafted],
  }
}

export function completeDraftIfNeeded(
  state: SeasonState,
  freeAgentPool: Player[],
): { seasonState: SeasonState; freeAgentPool: Player[] } {
  const draftState = state.draftState
  if (!draftState || draftState.completed) {
    return { seasonState: state, freeAgentPool }
  }

  if (draftState.currentPickIndex < draftState.order.length) {
    return { seasonState: state, freeAgentPool }
  }

  const finalized = finalizeDraftPool(draftState, freeAgentPool)

  return {
    seasonState: {
      ...state,
      draftState: finalized.draftState,
    },
    freeAgentPool: finalized.freeAgentPool,
  }
}
