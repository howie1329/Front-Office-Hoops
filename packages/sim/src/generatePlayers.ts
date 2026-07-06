import type { Rng, Team, TeamWithRoster } from "@workspace/shared/types"

import { generateTeamRoster } from "./playerGeneration/rosterPipeline"

export function generatePlayers(team: Team, rng: Rng) {
  return generateTeamRoster(team, { mode: "tier_offset" }, rng).players
}

export function generateTeamWithRoster(team: Team, rng: Rng): TeamWithRoster {
  return generateTeamRoster(team, { mode: "tier_offset" }, rng)
}
