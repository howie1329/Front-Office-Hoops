import { RATING_MAX, ROSTER_MAX } from "@workspace/shared/constants"
import type { Player, TeamWithRoster } from "@workspace/shared/types"

import { deriveTeamOverall } from "../playerRatings"

export function computeAiCutScore(player: Player): number {
  return player.age * 10 + (RATING_MAX - player.ratings.overall)
}

export function selectAiCutCandidate(players: Player[]): Player {
  const sorted = [...players].sort((a, b) => {
    const scoreDiff = computeAiCutScore(b) - computeAiCutScore(a)
    if (scoreDiff !== 0) {
      return scoreDiff
    }
    return a.id.localeCompare(b.id)
  })

  const candidate = sorted[0]
  if (!candidate) {
    throw new Error("No player available to cut")
  }

  return candidate
}

export function releasePlayer(
  teams: TeamWithRoster[],
  freeAgentPool: Player[],
  input: { teamId: string; playerId: string },
): { teams: TeamWithRoster[]; freeAgentPool: Player[] } {
  const team = teams.find((entry) => entry.id === input.teamId)
  if (!team) {
    throw new Error(`Team not found: ${input.teamId}`)
  }

  const player = team.players.find((entry) => entry.id === input.playerId)
  if (!player) {
    throw new Error(`Player not found on team: ${input.playerId}`)
  }

  const releasedPlayer: Player = {
    ...player,
    teamId: null,
    status: "free_agent",
  }

  const nextPlayers = team.players.filter((entry) => entry.id !== input.playerId)
  const nextTeams = teams.map((entry) =>
    entry.id === input.teamId
      ? {
          ...entry,
          players: nextPlayers,
          overall: deriveTeamOverall(nextPlayers),
        }
      : entry,
  )

  return {
    teams: nextTeams,
    freeAgentPool: [...freeAgentPool, releasedPlayer],
  }
}

export function applyAiRosterTrimming(
  teams: TeamWithRoster[],
  freeAgentPool: Player[],
  userTeamId: string | null,
): { teams: TeamWithRoster[]; freeAgentPool: Player[] } {
  let nextTeams = teams
  let nextPool = freeAgentPool

  for (const team of teams) {
    if (userTeamId && team.id === userTeamId) {
      continue
    }

    let roster = team.players
    while (roster.length > ROSTER_MAX) {
      const cutCandidate = selectAiCutCandidate(roster)
      const result = releasePlayer(nextTeams, nextPool, {
        teamId: team.id,
        playerId: cutCandidate.id,
      })
      nextTeams = result.teams
      nextPool = result.freeAgentPool
      roster = nextTeams.find((entry) => entry.id === team.id)?.players ?? []
    }
  }

  return {
    teams: nextTeams,
    freeAgentPool: nextPool,
  }
}

export function getTeamRosterSize(teams: TeamWithRoster[], teamId: string): number {
  return teams.find((team) => team.id === teamId)?.players.length ?? 0
}

export function validateRostersForSeasonStart(
  teams: TeamWithRoster[],
  userTeamId: string | null,
): void {
  if (userTeamId) {
    const userSize = getTeamRosterSize(teams, userTeamId)
    if (userSize > ROSTER_MAX) {
      throw new Error(
        `User roster over limit (${userSize}/${ROSTER_MAX}) — release players before starting the season`,
      )
    }
    if (userSize < ROSTER_MAX) {
      throw new Error(
        `User roster under limit (${userSize}/${ROSTER_MAX}) — add or keep players before starting the season`,
      )
    }
  }

  for (const team of teams) {
    if (team.players.length !== ROSTER_MAX) {
      throw new Error(
        `Team ${team.abbrev} roster must be ${ROSTER_MAX} players before season start`,
      )
    }
  }
}
