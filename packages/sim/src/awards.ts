import type {
  LeagueRecord,
  Player,
  PlayerSeasonStats,
  SeasonAward,
} from "@workspace/shared/types"

import { createLeagueLogEntry } from "./leagueLog"

function playerById(
  league: LeagueRecord,
  playerId: string
): Player | undefined {
  return league.seasonState.teams
    .flatMap((team) => team.players)
    .find((player) => player.id === playerId)
}

function scoreMvp(stat: PlayerSeasonStats, league: LeagueRecord): number {
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === stat.teamId
  )
  return (
    stat.pts * 1.2 +
    stat.reb * 0.7 +
    stat.ast * 0.9 +
    (standing?.wins ?? 0) * 0.8
  )
}

function scoreDefense(stat: PlayerSeasonStats, league: LeagueRecord): number {
  const player = playerById(league, stat.playerId)
  return (
    stat.stl * 2 +
    stat.blk * 2.4 +
    stat.reb * 0.35 +
    (player?.ratings.defense ?? 0) * 0.5
  )
}

function scoreRookie(stat: PlayerSeasonStats, league: LeagueRecord): number {
  const player = playerById(league, stat.playerId)
  if (
    !player?.draftInfo ||
    player.draftInfo.year !== league.seasonState.season
  ) {
    return -1
  }
  return stat.pts + stat.reb * 0.6 + stat.ast * 0.7
}

function topStats(
  league: LeagueRecord,
  scorer: (stat: PlayerSeasonStats, league: LeagueRecord) => number,
  count: number
): PlayerSeasonStats[] {
  return [...league.seasonState.playerSeasonStats]
    .filter((stat) => stat.gp > 0)
    .sort((a, b) => scorer(b, league) - scorer(a, league))
    .slice(0, count)
}

function makeAward(
  league: LeagueRecord,
  type: SeasonAward["type"],
  stat: PlayerSeasonStats,
  rank = 1
): SeasonAward {
  return {
    id: `award_${league.seasonState.season}_${type}_${rank}_${stat.playerId}`,
    season: league.seasonState.season,
    type,
    playerId: stat.playerId,
    teamId: stat.teamId,
    rank,
  }
}

export function assignSeasonAwards(league: LeagueRecord): LeagueRecord {
  const awards: SeasonAward[] = []
  const mvp = topStats(league, scoreMvp, 1)[0]
  const dpoy = topStats(league, scoreDefense, 1)[0]
  const roy = topStats(league, scoreRookie, 1)[0]

  if (mvp) awards.push(makeAward(league, "mvp", mvp))
  if (dpoy) awards.push(makeAward(league, "dpoy", dpoy))
  if (roy && scoreRookie(roy, league) >= 0)
    awards.push(makeAward(league, "roy", roy))

  topStats(league, scoreMvp, 5).forEach((stat, index) => {
    awards.push(makeAward(league, "all_league_first", stat, index + 1))
  })
  topStats(league, scoreDefense, 5).forEach((stat, index) => {
    awards.push(makeAward(league, "all_defense_first", stat, index + 1))
  })

  const championId = league.seasonState.playoffBracket?.championTeamId
  const finalsMvp = championId
    ? topStats(
        {
          ...league,
          seasonState: {
            ...league.seasonState,
            playerSeasonStats: league.seasonState.playerSeasonStats.filter(
              (stat) => stat.teamId === championId
            ),
          },
        },
        scoreMvp,
        1
      )[0]
    : undefined
  if (finalsMvp) awards.push(makeAward(league, "finals_mvp", finalsMvp))

  const entries = awards.map((award, index) =>
    createLeagueLogEntry({
      league,
      type: "award",
      teamId: award.teamId,
      playerId: award.playerId,
      payload: { awardType: award.type, rank: award.rank },
      sequence: index + 1,
    })
  )

  return {
    ...league,
    seasonAwards: [
      ...league.seasonAwards.filter(
        (award) => award.season !== league.seasonState.season
      ),
      ...awards,
    ],
    leagueLog: [...league.leagueLog, ...entries],
  }
}
