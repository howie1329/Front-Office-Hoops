import type { LeagueRecord, LeagueSummary } from "@workspace/shared/types"

import { getDb } from "./db"

export async function listLeagues(): Promise<LeagueSummary[]> {
  const rows = await getDb().leagues.orderBy("updatedAt").reverse().toArray()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt,
    userTeamId: row.userTeamId,
    teamCount: row.seasonState.teams.length,
  }))
}

export async function getLeague(id: string): Promise<LeagueRecord | undefined> {
  return getDb().leagues.get(id)
}

export async function getMostRecentLeague(): Promise<LeagueRecord | undefined> {
  const rows = await getDb().leagues.orderBy("updatedAt").reverse().limit(1).toArray()
  return rows[0]
}

export async function saveLeague(record: LeagueRecord): Promise<LeagueRecord> {
  const updated: LeagueRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  }

  await getDb().leagues.put(updated)
  return updated
}

export async function deleteLeague(id: string): Promise<void> {
  await getDb().leagues.delete(id)
}
