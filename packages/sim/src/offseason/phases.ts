import type { SeasonState } from "@workspace/shared/types"
import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { processAiFreeAgency } from "../financials"
import { getCurrentCalendar } from "../calendar"
import { generateAiFreeAgencyMarketOffers, advanceFreeAgencyMarketDay } from "../contracts/offerMarket"

export function advanceToDraftPhase(state: SeasonState): SeasonState {
  if (state.phase !== "offseason") {
    throw new Error("Draft phase can only start during the offseason")
  }

  if ((state.offseasonPhase ?? "re_signing") !== "re_signing") {
    throw new Error("Draft phase can only follow re-signing")
  }

  return {
    ...state,
    currentDay: Math.max(
      state.currentDay,
      getCurrentCalendar(state).milestones.draftDay
    ),
    offseasonPhase: "draft",
  }
}

export function advanceToFreeAgencyPhase(state: SeasonState): SeasonState {
  if (state.phase !== "offseason") {
    throw new Error("Free agency phase can only start during the offseason")
  }

  if (state.offseasonPhase !== "draft") {
    throw new Error("Free agency phase can only follow the draft")
  }

  if (!state.draftState?.completed) {
    throw new Error("Draft must be completed before free agency")
  }

  return {
    ...state,
    currentDay: Math.max(
      state.currentDay,
      getCurrentCalendar(state).milestones.freeAgencyStartDay
    ),
    offseasonPhase: "free_agency",
  }
}

export function advanceLeagueToFreeAgencyPhase(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  return generateAiFreeAgencyMarketOffers(
    {
      ...league,
      seasonState: advanceToFreeAgencyPhase(league.seasonState),
    },
    rng,
  )
}

export function completeFreeAgencyPhase(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Free agency can only be completed during the offseason")
  }

  if (league.seasonState.offseasonPhase !== "free_agency") {
    throw new Error("AI free agency can only run during free agency")
  }

  return processAiFreeAgency(advanceFreeAgencyMarketDay(league, rng), rng)
}
