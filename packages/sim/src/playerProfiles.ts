import type {
  LeagueRecord,
  PlayerCareerSnapshot,
  PlayerSeasonStats,
} from "@workspace/shared/types"

import {
  getCurrentSalary,
  getPlayerContract,
  getYearsRemaining,
} from "./financials/payroll"

function emptyStats(
  playerId: string,
  teamId: string,
  season: number
): PlayerSeasonStats {
  return {
    id: `pss_${season}_${playerId}`,
    playerId,
    teamId,
    season,
    gp: 0,
    gs: 0,
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  }
}

export function archivePlayerCareerSnapshots(
  league: LeagueRecord
): LeagueRecord {
  const season = league.seasonState.season
  const awardsByPlayer = new Map<string, string[]>()
  for (const award of league.seasonAwards.filter(
    (entry) => entry.season === season
  )) {
    awardsByPlayer.set(award.playerId, [
      ...(awardsByPlayer.get(award.playerId) ?? []),
      award.type,
    ])
  }

  const snapshots: PlayerCareerSnapshot[] = league.seasonState.teams.flatMap(
    (team) =>
      team.players.map((player) => {
        const stats =
          league.seasonState.playerSeasonStats.find(
            (entry) => entry.playerId === player.id
          ) ?? emptyStats(player.id, team.id, season)
        const contract = getPlayerContract(league.contracts, player)
        return {
          id: `career_${season}_${player.id}`,
          playerId: player.id,
          season,
          teamId: team.id,
          age: player.age,
          overall: player.ratings.overall,
          potential: player.ratings.potential,
          contractSalary: getCurrentSalary(contract),
          contractYearsRemaining: getYearsRemaining(contract),
          gp: stats.gp,
          gs: stats.gs,
          min: stats.min,
          pts: stats.pts,
          reb: stats.reb,
          ast: stats.ast,
          stl: stats.stl,
          blk: stats.blk,
          awards: awardsByPlayer.get(player.id) ?? [],
        }
      })
  )

  return {
    ...league,
    playerCareerSnapshots: [
      ...league.playerCareerSnapshots.filter(
        (entry) => entry.season !== season
      ),
      ...snapshots,
    ],
  }
}
