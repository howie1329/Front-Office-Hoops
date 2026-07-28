import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { setOpeningExceptions } from "../financials"
import { beginStaffMarket } from "./staffPhase"

/** Completes the opening contract-options phase and initializes the staff market. */
export function completeContractOptions(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  if (
    league.seasonState.phase !== "offseason" ||
    league.seasonState.offseasonPhase !== "contract_options"
  ) {
    throw new Error("Contract options phase is not active")
  }

  return beginStaffMarket(
    setOpeningExceptions({
      ...league,
      seasonState: { ...league.seasonState, offseasonPhase: "staff" },
    }),
    rng,
  )
}
