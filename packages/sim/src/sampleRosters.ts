import { SAMPLE_TEAMS } from "@workspace/shared/sampleTeams"
import type { TeamWithRoster } from "@workspace/shared/types"

import { createRng } from "./rng"
import { generateTeamWithRoster } from "./generatePlayers"

export const SAMPLE_ROSTERS: TeamWithRoster[] = SAMPLE_TEAMS.map((team) =>
  generateTeamWithRoster(team, createRng(team.id)),
)

export function getRosterByTeamId(id: string): TeamWithRoster | undefined {
  return SAMPLE_ROSTERS.find((roster) => roster.id === id)
}
