import Dexie, { type Table } from "dexie"

import type {
  LeagueDocument,
  LeagueRecoveryCheckpoint,
} from "@workspace/domain-v2"

export const V2_DATABASE_NAME = "front-office-hoops-v2"

export type LeagueRow = {
  id: string
  name: string
  updatedAt: string
  document: LeagueDocument
}

export type LeagueCheckpointRow = LeagueRecoveryCheckpoint

export class FOHV2Database extends Dexie {
  leagues!: Table<LeagueRow, string>
  checkpoints!: Table<LeagueCheckpointRow, string>

  constructor() {
    super(V2_DATABASE_NAME)

    this.version(1).stores({
      leagues: "id, updatedAt, name",
    })
    this.version(2).stores({
      leagues: "id, updatedAt, name",
      checkpoints: "id, leagueId, commandId, createdAt",
    })
  }
}

let dbInstance: FOHV2Database | null = null

export function getDb(): FOHV2Database {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is not available (SSR or non-browser environment)"
    )
  }

  if (!dbInstance) {
    dbInstance = new FOHV2Database()
  }

  return dbInstance
}

export async function resetDbForTests(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete()
    dbInstance = null
  }
}
