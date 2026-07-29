import type { LeagueDocument, ValidationIssue } from "@workspace/domain-v2"
import { ZodError } from "zod"

import { leagueDocumentSchema } from "./schema"

export type LeagueValidationResult =
  | { valid: true; data: LeagueDocument }
  | { valid: false; issues: ValidationIssue[] }

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
