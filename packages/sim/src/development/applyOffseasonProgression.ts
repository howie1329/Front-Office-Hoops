import type { PlayerSeasonStats, Rng, TeamWithRoster } from "@workspace/shared/types"

import { deriveTeamOverall, recalculatePlayerRatings } from "../playerRatings"
import { progressPlayer } from "./progressPlayer"

export function applyOffseasonProgression(
  teams: TeamWithRoster[],
  season: number,
  playerSeasonStats: PlayerSeasonStats[],
  baseSeed: string,
  _rng: Rng,
): TeamWithRoster[] {
  return teams.map((team) => {
    const progressedPlayers = team.players.map((player) =>
      progressPlayer(player, team, season, playerSeasonStats, baseSeed),
    )
    const players = progressedPlayers.map((player) => ({
      ...player,
      ratings: recalculatePlayerRatings(player, progressedPlayers),
    }))

    return {
      ...team,
      overall: deriveTeamOverall(players),
      players,
    }
  })
}
