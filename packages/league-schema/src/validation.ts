import type { LeagueDocument, ValidationIssue } from "@workspace/domain-v2"
import { ZodError } from "zod"

import { leagueDocumentSchema } from "./schema"
import { CURRENT_SCHEMA_VERSION } from "./version"

export type LeagueValidationResult =
  | { valid: true; data: LeagueDocument }
  | { valid: false; issues: ValidationIssue[] }

export type ImportPreview =
  | {
      status: "ready"
      schemaVersion: number
      documentId: string
      leagueName: string
      season: number
      phase: string
      warnings: string[]
    }
  | {
      status: "invalid" | "unsupported"
      schemaVersion: number | null
      issues: ValidationIssue[]
      warnings: string[]
    }

export class LeagueDocumentValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super("League document validation failed")
    this.name = "LeagueDocumentValidationError"
    this.issues = issues
  }
}

function formatIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number",
    ),
  }))
}

export function validateLeagueDocument(input: unknown): LeagueValidationResult {
  const result = leagueDocumentSchema.safeParse(input)

  if (!result.success) {
    return { valid: false, issues: formatIssues(result.error) }
  }

  return { valid: true, data: result.data as LeagueDocument }
}

export function parseLeagueDocument(input: unknown): LeagueDocument {
  const result = validateLeagueDocument(input)

  if (!result.valid) {
    throw new LeagueDocumentValidationError(result.issues)
  }

  return result.data
}

export function serializeLeagueDocument(document: LeagueDocument): string {
  parseLeagueDocument(document)
  return JSON.stringify(document, null, 2)
}

export function deserializeLeagueDocument(serialized: string): LeagueDocument {
  let input: unknown

  try {
    input = JSON.parse(serialized) as unknown
  } catch {
    throw new LeagueDocumentValidationError([
      {
        code: "invalid_json",
        message: "The document is not valid JSON.",
      },
    ])
  }

  return parseLeagueDocument(input)
}

function readSchemaVersion(input: unknown): number | null {
  if (!input || typeof input !== "object" || !("schema" in input)) {
    return null
  }

  const schema = input.schema

  if (!schema || typeof schema !== "object" || !("version" in schema)) {
    return null
  }

  return typeof schema.version === "number" ? schema.version : null
}

export function previewLeagueImport(serialized: string): ImportPreview {
  let input: unknown

  try {
    input = JSON.parse(serialized) as unknown
  } catch {
    return {
      status: "invalid",
      schemaVersion: null,
      issues: [
        {
          code: "invalid_json",
          message: "The document is not valid JSON.",
        },
      ],
      warnings: [],
    }
  }

  const schemaVersion = readSchemaVersion(input)

  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      status: "unsupported",
      schemaVersion,
      issues: [
        {
          code: "unsupported_schema_version",
          message: `Schema version ${String(schemaVersion)} is not supported.`,
          path: ["schema", "version"],
        },
      ],
      warnings: [],
    }
  }

  const result = validateLeagueDocument(input)

  if (!result.valid) {
    return {
      status: "invalid",
      schemaVersion,
      issues: result.issues,
      warnings: [],
    }
  }

  return {
    status: "ready",
    schemaVersion,
    documentId: result.data.metadata.id,
    leagueName: result.data.metadata.name,
    season: result.data.state.season,
    phase: result.data.state.phase,
    warnings: [],
  }
}
