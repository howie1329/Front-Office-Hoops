import type { LeagueDocument } from "@workspace/domain-v2"

import { parseLeagueDocument } from "./validation"
import { CURRENT_SCHEMA_VERSION } from "./version"

export { CURRENT_SCHEMA_VERSION }

export class LeagueMigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LeagueMigrationError"
  }
}

export function migrateLeagueDocument(input: unknown): LeagueDocument {
  if (!input || typeof input !== "object" || !("schema" in input)) {
    throw new LeagueMigrationError("The document does not contain a schema envelope.")
  }

  const schema = input.schema

  if (!schema || typeof schema !== "object" || !("version" in schema)) {
    throw new LeagueMigrationError("The document schema version is missing.")
  }

  const version = schema.version

  if (typeof version !== "number" || version !== CURRENT_SCHEMA_VERSION) {
    throw new LeagueMigrationError(
      `No migration is available for schema version ${String(version)}.`,
    )
  }

  return parseLeagueDocument(input)
}
