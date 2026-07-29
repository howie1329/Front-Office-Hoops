import type { LeagueDocument } from "@workspace/domain-v2"
import {
  deserializeLeagueDocument,
  previewLeagueImport,
  serializeLeagueDocument,
  validateLeagueDocument,
} from "@workspace/league-schema"

import { getDb, type LeagueRow } from "./database"
import type { ImportPreview } from "@workspace/league-schema"

export type LeagueSummary = {
  id: string
  name: string
  updatedAt: string
  season: number
  phase: string
}

export class LeagueRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LeagueRepositoryError"
  }
}

export class V2LeagueRepository {
  async list(): Promise<LeagueSummary[]> {
    const rows = await getDb().leagues.orderBy("updatedAt").reverse().toArray()

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      season: row.document.state.season,
      phase: row.document.state.phase,
    }))
  }

  async load(id: string): Promise<LeagueDocument | null> {
    const row = await getDb().leagues.get(id)
    return row?.document ?? null
  }

  async save(document: LeagueDocument): Promise<void> {
    const validation = validateLeagueDocument(document)

    if (!validation.valid) {
      throw new LeagueRepositoryError(
        `Cannot save invalid league document: ${validation.issues[0]?.message ?? "unknown validation error"}`,
      )
    }

    const row: LeagueRow = {
      id: document.metadata.id,
      name: document.metadata.name,
      updatedAt: document.metadata.updatedAt,
      document,
    }

    await getDb().transaction("rw", getDb().leagues, async () => {
      await getDb().leagues.put(row)
    })
  }

  async remove(id: string): Promise<void> {
    await getDb().leagues.delete(id)
  }

  async export(id: string): Promise<Blob> {
    const document = await this.load(id)

    if (!document) {
      throw new LeagueRepositoryError(`League ${id} was not found.`)
    }

    return new Blob([serializeLeagueDocument(document)], {
      type: "application/json",
    })
  }

  async import(file: Blob): Promise<LeagueDocument> {
    return deserializeLeagueDocument(await file.text())
  }

  async previewImport(file: Blob): Promise<ImportPreview> {
    return previewLeagueImport(await file.text())
  }
}
