import type {
  PlayerSeasonProfile,
  PlayerSeasonStats,
  Rng,
  TeamWithRoster,
} from "@workspace/shared/types"

import { deriveTeamOverall, recalculatePlayerRatings } from "../playerRatings"
import { progressPlayer } from "./progressPlayer"

export function applyOffseasonProgression(
  teams: TeamWithRoster[],
  season: number,
  playerSeasonStats: PlayerSeasonStats[],
  baseSeed: string,
  _rng: Rng,
  playerSeasonProfiles: PlayerSeasonProfile[] = [],
): TeamWithRoster[] {
  return teams.map((team) => {
    const progressedPlayers = team.players.map((player) =>
      progressPlayer(
        player,
        team,
        season,
        playerSeasonStats,
        baseSeed,
        playerSeasonProfiles,
      ),
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
