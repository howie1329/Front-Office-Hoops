import {
  PLAYOFF_TEAMS_PER_CONFERENCE,
  SIX_TEAM_PLAYOFF_TEAMS,
} from "@workspace/shared/constants"
import type { SeasonState, Standing } from "@workspace/shared/types"

import { sortStandings } from "../deriveStandings"

export type SeededTeam = {
  teamId: string
  seed: number
  conferenceId?: "east" | "west"
}

function getConferenceStandings(
  standings: Standing[],
  teams: SeasonState["teams"],
  conferenceId: "east" | "west",
): Standing[] {
  const conferenceTeamIds = new Set(
    teams
      .filter((team) => team.conferenceId === conferenceId)
      .map((team) => team.id),
  )

  return sortStandings(
    standings.filter((standing) => conferenceTeamIds.has(standing.teamId)),
  )
}

export function seedPlayoffTeams(state: SeasonState): SeededTeam[] {
  const standings = sortStandings(state.standings)

  if (state.teams.length === 30) {
    const seeded: SeededTeam[] = []

    for (const conferenceId of ["east", "west"] as const) {
      const conferenceStandings = getConferenceStandings(
        standings,
        state.teams,
        conferenceId,
      ).slice(0, PLAYOFF_TEAMS_PER_CONFERENCE)

      conferenceStandings.forEach((standing, index) => {
        seeded.push({
          teamId: standing.teamId,
          seed: index + 1,
          conferenceId,
        })
      })
    }

    return seeded
  }

  if (state.teams.length === 6) {
    return standings.slice(0, SIX_TEAM_PLAYOFF_TEAMS).map((standing, index) => ({
      teamId: standing.teamId,
      seed: index + 1,
    }))
  }

  throw new Error(`Unsupported playoff seeding for ${state.teams.length} teams`)
}

export function getPlayoffTeamIds(seeded: SeededTeam[]): Set<string> {
  return new Set(seeded.map((team) => team.teamId))
}
