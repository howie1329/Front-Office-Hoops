import type { Rng, Team, TeamWithRoster } from "@workspace/shared/types"

import {
  buildArchetypeList,
  generateTeamRoster,
} from "./playerGeneration/rosterPipeline"

export function generateLeagueRostersFromArchetypes(
  teams: Team[],
  rng: Rng
): TeamWithRoster[] {
  const archetypes = buildArchetypeList(rng)

  return teams.map((team, index) => {
    const archetype = archetypes[index] ?? "middle_team"
    return generateTeamRoster(team, { mode: "archetype_slots", archetype }, rng)
  })
}
