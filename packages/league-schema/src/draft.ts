import type { DraftDecisionResult, DraftDecisionExportProfile } from "@workspace/domain-v2"

export type DraftDecisionExportOptions = {
  profile: DraftDecisionExportProfile
  selectedTeamId?: string | null
  pairedDiagnostics?: unknown
}

export function createDraftDecisionExport(
  result: DraftDecisionResult,
  options: DraftDecisionExportOptions
): Record<string, unknown> {
  const selectedTeamId = options.selectedTeamId ?? null
  if (options.profile === "full-developer") {
    return {
      schema: "foh-draft-decision-export",
      version: 1,
      profile: options.profile,
      run: options.pairedDiagnostics === undefined
        ? result
        : { ...result, pairedDiagnostics: options.pairedDiagnostics },
    }
  }

  const selectedProfile = selectedTeamId ? result.fixture.teamProfiles[selectedTeamId] : null
  const selectedReport = selectedTeamId
    ? Object.fromEntries(
        result.fixture.draftProspectIds.flatMap((playerId) => {
          const report = result.fixture.privateReports[selectedTeamId]?.[playerId]
          return report ? [[playerId, report]] : []
        })
      )
    : {}
  const selectedBoard = selectedTeamId ? result.fixture.boards[selectedTeamId] : null
  const visibleOutcomes = result.outcomes.map((outcome) => ({
    playerId: outcome.playerId,
    draftSlot: outcome.draftSlot,
    draftRound: outcome.draftRound,
    potentialForecast: outcome.potentialForecast,
    scoutEstimate: outcome.scoutEstimate,
    seasonsSimulated: outcome.seasonsSimulated,
  }))
  return {
    schema: "foh-draft-decision-export",
    version: 1,
    profile: options.profile,
    run: {
      schema: result.schema,
      version: result.version,
      picks: result.picks,
      contracts: result.contracts,
      undraftedPlayerIds: result.undraftedPlayerIds,
      outcomes: visibleOutcomes,
      teamImpact: result.teamImpact,
      diagnostics: {
        legal: result.diagnostics.legal,
        unfilledSelections: result.diagnostics.unfilledSelections,
      },
      fixture: {
        version: result.fixture.version,
        seed: result.fixture.seed,
        season: result.fixture.season,
        config: result.fixture.config,
        teams: result.fixture.teams,
        rosters: result.fixture.rosters,
        draftProspectIds: result.fixture.draftProspectIds,
        draftOrder: result.fixture.draftOrder,
        teamProfiles: selectedProfile ? { [selectedTeamId as string]: selectedProfile } : {},
        publicReports: result.fixture.publicReports,
        publicMock: result.fixture.publicMock,
        economy: result.fixture.economy,
        selectedTeamId,
        selectedTeamReports: selectedReport,
        selectedTeamBoard: selectedBoard,
      },
    },
  }
}

export function serializeDraftDecisionExport(
  result: DraftDecisionResult,
  options: DraftDecisionExportOptions
): string {
  return JSON.stringify(createDraftDecisionExport(result, options), null, 2)
}

const safeExportForbiddenKeys = new Set([
  "players",
  "privateReports",
  "boards",
  "realizedPeakAbility",
  "abilityAfterFollowUp",
  "preDraftAbility",
  "forecastError",
])

export function validateDraftDecisionSafeExport(input: unknown): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`))
      return
    }
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      if (safeExportForbiddenKeys.has(key)) issues.push(`${path}.${key} is not allowed in a safe export.`)
      visit(child, `${path}.${key}`)
    }
  }
  if (!input || typeof input !== "object" || (input as { profile?: unknown }).profile !== "selected-team-safe") {
    issues.push("The export profile must be selected-team-safe.")
  }
  visit(input, "export")
  return { valid: issues.length === 0, issues }
}
