import type { LeagueRecord } from "@workspace/shared/types"

import { getSeasonFinancials } from "./capMath"
import { assignInitialTeamStrategy, ensureTeamStrategy } from "./teamStrategy"

export function migrateV5ToV6(record: LeagueRecord): LeagueRecord {
  const season = record.seasonState.season
  const seasonFinancials = getSeasonFinancials(record.leagueFinancials, season)

  const teamFinancials = record.teamFinancials.map((teamFinance) => {
    if (teamFinance.strategy) {
      return teamFinance
    }

    const team = record.seasonState.teams.find(
      (entry) => entry.id === teamFinance.teamId,
    )
    if (!team) {
      return ensureTeamStrategy(teamFinance, season)
    }

    return {
      ...teamFinance,
      strategy: assignInitialTeamStrategy(
        team,
        record.contracts,
        seasonFinancials,
        season,
      ),
    }
  })

  return {
    ...record,
    teamFinancials,
  }
}
