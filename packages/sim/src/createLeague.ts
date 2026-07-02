import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type { LeagueRecord, Rng, TeamWithRoster } from "@workspace/shared/types"

import { createInitialSeason } from "./createInitialSeason"
import { generateLeagueRosters } from "./generateTeams"
import { SAMPLE_ROSTERS } from "./sampleRosters"

export type CreateLeagueInput = {
  name: string
  teams?: TeamWithRoster[]
  baseSeed: string
  rng: Rng
  userTeamId?: string | null
  id?: string
  useMiniLeague?: boolean
}

function createLeagueId(): string {
  return `league_${crypto.randomUUID()}`
}

export function createLeague(input: CreateLeagueInput): LeagueRecord {
  const teams =
    input.teams ??
    (input.useMiniLeague ? SAMPLE_ROSTERS : generateLeagueRosters(input.rng))
  const now = new Date().toISOString()
  const seasonState = createInitialSeason(teams, input.baseSeed, input.rng)

  return {
    id: input.id ?? createLeagueId(),
    name: input.name,
    saveVersion: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    userTeamId: input.userTeamId ?? null,
    seasonState,
    seasonHistory: [],
    freeAgentPool: [],
  }
}
