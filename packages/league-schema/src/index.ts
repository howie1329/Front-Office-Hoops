export { createFoundationLeague } from "@workspace/domain-v2"
export { CURRENT_SCHEMA_VERSION, LeagueMigrationError, migrateLeagueDocument } from "./migrations"
export { leagueDocumentSchema } from "./schema"
export type { LeagueDocumentInput } from "./schema"
export {
  LeagueDocumentValidationError,
  deserializeLeagueDocument,
  parseLeagueDocument,
  serializeLeagueDocument,
  validateLeagueDocument,
} from "./validation"
