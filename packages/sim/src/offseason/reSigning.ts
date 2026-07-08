import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { processAiReSigningOffers } from "../contracts/offerMarket"
import { advanceToDraftPhase } from "./phases"

export function completeReSigningPhase(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  if (league.seasonState.phase !== "offseason") {
    throw new Error("Re-signing can only be completed during the offseason")
  }

  if ((league.seasonState.offseasonPhase ?? "re_signing") !== "re_signing") {
    throw new Error("AI re-signings can only run during re-signing")
  }

  const updated = processAiReSigningOffers(league, rng)

  return {
    ...updated,
    seasonState: advanceToDraftPhase(updated.seasonState),
  }
}
