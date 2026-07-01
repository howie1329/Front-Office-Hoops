import Dexie, { type Table } from "dexie"

import type { LeagueRecord } from "@workspace/shared/types"

const DB_NAME = "front-office-hoops"

export class FOHDatabase extends Dexie {
  leagues!: Table<LeagueRecord, string>

  constructor() {
    super(DB_NAME)

    this.version(1).stores({
      leagues: "id, updatedAt, name",
    })
  }
}

let dbInstance: FOHDatabase | null = null

export function getDb(): FOHDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is not available (SSR or non-browser environment)",
    )
  }

  if (!dbInstance) {
    dbInstance = new FOHDatabase()
  }

  return dbInstance
}

export async function resetDbForTests(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete()
    dbInstance = null
  }
}
