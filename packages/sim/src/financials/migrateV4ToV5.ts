import type { LeagueRecord } from "@workspace/shared/types"

import { initializeFinancialsForLeague } from "./index"
import { createRng } from "../rng"

export function migrateV4ToV5(record: LeagueRecord): LeagueRecord {
  const baseSeed = record.seasonState.baseSeed
  const rng = createRng(`${baseSeed}:financials:migrate`)

  const withDefaults: LeagueRecord = {
    ...record,
    contracts: record.contracts ?? [],
    leagueFinancials: record.leagueFinancials ?? {
      baseCap: 141,
      growthRate: 0.05,
      bySeason: {},
    },
    teamFinancials: record.teamFinancials ?? [],
    spendingProfileEvents: record.spendingProfileEvents ?? [],
    freeAgentPool: (record.freeAgentPool ?? []).map((player) => ({
      ...player,
      activeContractId: player.activeContractId ?? null,
      seasonsWithTeam: player.seasonsWithTeam ?? 0,
      yearsOfService: player.yearsOfService ?? Math.max(0, player.age - 19),
    })),
    seasonState: {
      ...record.seasonState,
      teams: record.seasonState.teams.map((team) => ({
        ...team,
        players: team.players.map((player) => ({
          ...player,
          activeContractId: player.activeContractId ?? null,
          seasonsWithTeam:
            player.seasonsWithTeam ?? Math.max(0, player.age - 19),
          yearsOfService:
            player.yearsOfService ?? Math.max(0, player.age - 19),
        })),
      })),
    },
  }

  if (withDefaults.contracts.length > 0) {
    return withDefaults
  }

  return initializeFinancialsForLeague(withDefaults, rng)
}
