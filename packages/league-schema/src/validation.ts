import type {
  CareerCohortReport,
  CareerIndividualReport,
  ContractMarketFixture,
  LeagueDocument,
  ValidationIssue,
} from "@workspace/domain-v2"
import type {
  ContractMarketScenarioExport,
  EconomyRunExport,
  FreeAgencyRunExport,
} from "./schema"
import { ZodError } from "zod"

import {
  careerCohortReportSchema,
  careerIndividualReportSchema,
  contractMarketScenarioExportSchema,
  contractMarketFixtureSchema,
  economyRunExportSchema,
  freeAgencyRunExportSchema,
  leagueDocumentSchema,
} from "./schema"
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

export class CareerReportValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super("Career report validation failed")
    this.name = "CareerReportValidationError"
    this.issues = issues
  }
}

export class ContractMarketValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super("Contract market fixture validation failed")
    this.name = "ContractMarketValidationError"
    this.issues = issues
  }
}

export class ContractMarketReportValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super("Contract market report validation failed")
    this.name = "ContractMarketReportValidationError"
    this.issues = issues
  }
}

function formatIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number"
    ),
  }))
}

export function validateCareerCohortReport(
  input: unknown
):
  | { valid: true; data: CareerCohortReport }
  | { valid: false; issues: ValidationIssue[] } {
  const result = careerCohortReportSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data as CareerCohortReport }
    : { valid: false, issues: formatIssues(result.error) }
}

export function validateCareerIndividualReport(
  input: unknown
):
  | { valid: true; data: CareerIndividualReport }
  | { valid: false; issues: ValidationIssue[] } {
  const result = careerIndividualReportSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data as CareerIndividualReport }
    : { valid: false, issues: formatIssues(result.error) }
}

export function parseCareerCohortReport(input: unknown): CareerCohortReport {
  const result = validateCareerCohortReport(input)
  if (!result.valid) throw new CareerReportValidationError(result.issues)
  return result.data
}

export function parseCareerIndividualReport(
  input: unknown
): CareerIndividualReport {
  const result = validateCareerIndividualReport(input)
  if (!result.valid) throw new CareerReportValidationError(result.issues)
  return result.data
}

export function serializeCareerCohortReport(
  report: CareerCohortReport
): string {
  parseCareerCohortReport(report)
  return JSON.stringify(report, null, 2)
}

export function deserializeCareerCohortReport(
  serialized: string
): CareerCohortReport {
  try {
    return parseCareerCohortReport(JSON.parse(serialized) as unknown)
  } catch (error) {
    if (error instanceof CareerReportValidationError) throw error
    throw new CareerReportValidationError([
      { code: "invalid_json", message: "The report is not valid JSON." },
    ])
  }
}

export function serializeCareerIndividualReport(
  report: CareerIndividualReport
): string {
  parseCareerIndividualReport(report)
  return JSON.stringify(report, null, 2)
}

export function deserializeCareerIndividualReport(
  serialized: string
): CareerIndividualReport {
  try {
    return parseCareerIndividualReport(JSON.parse(serialized) as unknown)
  } catch (error) {
    if (error instanceof CareerReportValidationError) throw error
    throw new CareerReportValidationError([
      { code: "invalid_json", message: "The report is not valid JSON." },
    ])
  }
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

export function validateContractMarketFixture(
  input: unknown
):
  | { valid: true; data: ContractMarketFixture }
  | { valid: false; issues: ValidationIssue[] } {
  const result = contractMarketFixtureSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data as ContractMarketFixture }
    : { valid: false, issues: formatIssues(result.error) }
}

export function parseContractMarketFixture(
  input: unknown
): ContractMarketFixture {
  const result = validateContractMarketFixture(input)
  if (!result.valid) throw new ContractMarketValidationError(result.issues)
  return result.data
}

export function serializeContractMarketFixture(
  fixture: ContractMarketFixture
): string {
  parseContractMarketFixture(fixture)
  return JSON.stringify(fixture, null, 2)
}

export function deserializeContractMarketFixture(
  serialized: string
): ContractMarketFixture {
  try {
    return parseContractMarketFixture(JSON.parse(serialized) as unknown)
  } catch (error) {
    if (error instanceof ContractMarketValidationError) throw error
    throw new ContractMarketValidationError([
      { code: "invalid_json", message: "The fixture is not valid JSON." },
    ])
  }
}

export function validateContractMarketScenarioExport(
  input: unknown
):
  | { valid: true; data: ContractMarketScenarioExport }
  | { valid: false; issues: ValidationIssue[] } {
  const result = contractMarketScenarioExportSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data }
    : { valid: false, issues: formatIssues(result.error) }
}

export function serializeContractMarketScenarioExport(
  report: ContractMarketScenarioExport
): string {
  const result = validateContractMarketScenarioExport(report)
  if (!result.valid)
    throw new ContractMarketReportValidationError(result.issues)
  return JSON.stringify(result.data, null, 2)
}

export function deserializeContractMarketScenarioExport(
  serialized: string
): ContractMarketScenarioExport {
  try {
    const result = validateContractMarketScenarioExport(
      JSON.parse(serialized) as unknown
    )
    if (!result.valid)
      throw new ContractMarketReportValidationError(result.issues)
    return result.data
  } catch (error) {
    if (error instanceof ContractMarketReportValidationError) throw error
    throw new ContractMarketReportValidationError([
      {
        code: "invalid_json",
        message: "The market scenario is not valid JSON.",
      },
    ])
  }
}

export function validateFreeAgencyRunExport(
  input: unknown
):
  | { valid: true; data: FreeAgencyRunExport }
  | { valid: false; issues: ValidationIssue[] } {
  const result = freeAgencyRunExportSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data }
    : { valid: false, issues: formatIssues(result.error) }
}

export function serializeFreeAgencyRunExport(
  report: FreeAgencyRunExport
): string {
  const result = validateFreeAgencyRunExport(report)
  if (!result.valid)
    throw new ContractMarketReportValidationError(result.issues)
  return JSON.stringify(result.data, null, 2)
}

export function deserializeFreeAgencyRunExport(
  serialized: string
): FreeAgencyRunExport {
  try {
    const result = validateFreeAgencyRunExport(
      JSON.parse(serialized) as unknown
    )
    if (!result.valid)
      throw new ContractMarketReportValidationError(result.issues)
    return result.data
  } catch (error) {
    if (error instanceof ContractMarketReportValidationError) throw error
    throw new ContractMarketReportValidationError([
      {
        code: "invalid_json",
        message: "The free-agency report is not valid JSON.",
      },
    ])
  }
}

export function validateEconomyRunExport(
  input: unknown
):
  | { valid: true; data: EconomyRunExport }
  | { valid: false; issues: ValidationIssue[] } {
  const result = economyRunExportSchema.safeParse(input)
  return result.success
    ? { valid: true, data: result.data }
    : { valid: false, issues: formatIssues(result.error) }
}

export function serializeEconomyRunExport(report: EconomyRunExport): string {
  const result = validateEconomyRunExport(report)
  if (!result.valid)
    throw new ContractMarketReportValidationError(result.issues)
  return JSON.stringify(result.data, null, 2)
}

export function deserializeEconomyRunExport(
  serialized: string
): EconomyRunExport {
  try {
    const result = validateEconomyRunExport(JSON.parse(serialized) as unknown)
    if (!result.valid)
      throw new ContractMarketReportValidationError(result.issues)
    return result.data
  } catch (error) {
    if (error instanceof ContractMarketReportValidationError) throw error
    throw new ContractMarketReportValidationError([
      {
        code: "invalid_json",
        message: "The economy report is not valid JSON.",
      },
    ])
  }
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
