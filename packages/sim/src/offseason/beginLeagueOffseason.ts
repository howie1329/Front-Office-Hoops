import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { assignSeasonAwards } from "../awards"
import { beginOffseason } from "../beginOffseason"
import { resetPlayerOfferNegotiations } from "../contracts/offerMarket"
import { processOffseasonFinancials } from "../financials"
import { evaluateOwnerGoals } from "../owners"
import { derivePlayerSeasonProfiles } from "../playerSeasonProfiles"
import { archivePlayerCareerSnapshots } from "../playerProfiles"

/** Opens one offseason and its next financial year as a single transaction. */
export function beginLeagueOffseason(
  league: LeagueRecord,
  rng: Rng
): LeagueRecord {
  const completedLeague = archivePlayerCareerSnapshots(
    evaluateOwnerGoals(assignSeasonAwards(league))
  )
  const profiles = derivePlayerSeasonProfiles(
    completedLeague.seasonState.teams,
    completedLeague.seasonState.playerSeasonStats,
    completedLeague.seasonState.games.length,
    completedLeague.seasonState.season
  )
  const seasonState = beginOffseason(completedLeague.seasonState, profiles)

  return resetPlayerOfferNegotiations(
    processOffseasonFinancials(
      {
        ...completedLeague,
        seasonState,
        playerSeasonProfiles: [
          ...completedLeague.playerSeasonProfiles.filter(
            (entry) => entry.season !== completedLeague.seasonState.season
          ),
          ...profiles,
        ],
      },
      rng
    ),
    ["extension", "re_signing"]
  )
}
