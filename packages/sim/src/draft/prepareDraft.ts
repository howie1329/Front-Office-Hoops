import type { DraftPickAsset, LeagueRecord, SeasonState } from "@workspace/shared/types"

import { createRng } from "../rng"
import { buildDraftClassCache } from "./pickValues"
import { generateDraftClass } from "./generateDraftClass"
import {
  generateDraftOrderFromAssets,
  generateDraftOrderFromSeed,
} from "./generateDraftOrder"
import { isDraftRequired } from "./isDraftRequired"

export function prepareDraft(
  state: SeasonState,
  draftPickAssets: DraftPickAsset[] = [],
  rngNonce = 0
): SeasonState {
  if (state.phase !== "offseason") {
    throw new Error("Draft can only be prepared during the offseason")
  }

  if (!isDraftRequired(state.season)) {
    throw new Error("Draft is not required for this offseason")
  }

  if (state.draftState) {
    throw new Error("Draft is already prepared")
  }

  const year = state.season + 1
  const prospects = generateDraftClass(
    state.teams.length,
    year,
    state.baseSeed,
    createRng(`${state.baseSeed}:draft-class:${year}:nonce:${rngNonce}`)
  )
  const order =
    draftPickAssets.length > 0
      ? generateDraftOrderFromAssets(
          state,
          draftPickAssets,
          createRng(`${state.baseSeed}:draft-order:${year}:nonce:${rngNonce}`)
        )
      : generateDraftOrderFromSeed(
          state,
          `${state.baseSeed}:nonce:${rngNonce}`
        )

  return {
    ...state,
    draftState: {
      year,
      prospects,
      order,
      currentPickIndex: 0,
      completed: false,
      selections: [],
    },
  }
}

export function prepareDraftForLeague(
  league: LeagueRecord,
  rngNonce = league.rngNonce,
): LeagueRecord {
  const seasonState = prepareDraft(
    league.seasonState,
    league.draftPickAssets,
    rngNonce,
  )
  const prospects = seasonState.draftState?.prospects ?? []

  return {
    ...league,
    seasonState,
    draftClassCache: buildDraftClassCache(
      { ...league, seasonState },
      prospects,
    ),
  }
}

export function getCurrentDraftPick(state: SeasonState) {
  const draftState = state.draftState
  if (!draftState || draftState.completed) {
    return null
  }

  return draftState.order[draftState.currentPickIndex] ?? null
}

export function isUserOnClock(
  state: SeasonState,
  userTeamId: string | null
): boolean {
  if (!userTeamId) {
    return false
  }

  const currentPick = getCurrentDraftPick(state)
  return currentPick?.teamId === userTeamId
}
