# Front Office Hoops v2 Data and Export Design

**Status:** Target portability contract; foundation round trip implemented<br>
**Current implementation:** [V2 Current State](../current-state.md)

## Data decisions

- The league document is a first-class user-facing JSON contract.
- IndexedDB/Dexie is a local repository adapter, not the canonical schema.
- A current snapshot is loaded directly; event history is stored alongside it.
- Every completed game retains a final box score and player game log.
- Play-by-play is not stored in the first v2.
- JSON import/export works without accounts or a server.
- Completed simulation outcomes are authoritative saved facts.
- Normal runtime randomness is fresh and not required to be perfectly replayable; explicit lab mode supports deterministic replay.

## Canonical document

```ts
type LeagueDocument = {
  schema: {
    name: "foh-league"
    version: number
    rulesVersion: number
  }
  metadata: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
  settings: {
    standardPresetId: string
    resolvedConfig: SimulationConfig
    advancedOverrides: Record<string, unknown>
    gameConfig?: GameSimulationConfig
    productionConfig?: SeasonProductionConfig
  }
  randomness: {
    mode: "normal" | "deterministic-lab"
    createdWithEntropy: boolean
    debugScopes?: Record<string, string>
  }
  state: {
    season: number
    phase: string
    leagueDay: number
    userTeamId: string
    calendar: CalendarState
    phaseTasks: PhaseTaskState[]
  }
  entities: {
    teams: Record<string, TeamEntity>
    players: Record<string, PlayerEntity>
    owners: Record<string, OwnerEntity>
    staff: Record<string, StaffEntity>
    contracts: Record<string, ContractEntity>
    draftAssets: Record<string, DraftAssetEntity>
    offers: Record<string, OfferEntity>
  }
  projections: DerivedLeagueViews
  history: {
    events: LeagueEvent[]
    seasonArchives: SeasonArchive[]
    records: RecordEntry[]
  }
  optionalData?: {
    games?: GameRecord[]
    playerGameLogs?: PlayerGameLog[]
    labDiagnostics?: LabReport[]
    scoutingDiagnostics?: ScoutingDiagnostic[]
  }
  narratives?: StoryPacketCache
}
```

The exact schema belongs in `packages/league-schema` and should produce JSON Schema plus TypeScript types. Entity maps use stable IDs. Projections are derived and rebuildable; they are not the only copy of a fact.

## League creation settings boundary

League creation accepts an optional typed `GameSimulationConfig`. When omitted,
creation resolves the standard game preset. When supplied, creation validates
and normalizes the config once, then persists the complete resolved object in
`LeagueDocument.settings.gameConfig`.

The first custom setup screen may edit only a bounded subset of that config;
all other fields remain at standard defaults until a later advanced-settings
surface exposes them. `advancedOverrides` is retained for compatibility and
diagnostics but is not authoritative for supported creation settings. Legacy
documents without `gameConfig` continue to resolve to the standard game
configuration at runtime.

## Snapshot plus event history

The current snapshot answers “what is the league now?” It contains current rosters, contracts, standings, phase, injuries, staff, owners, goals, draft state, finances, and settings.

The event history answers “what happened?” It contains compact records for games, injuries, trades, signings, releases, extensions, draft selections, development, awards, owner goals, job-security strikes, milestones, playoff eliminations, championships, and configuration changes.

The application loads the snapshot directly. It does not rebuild the league by replaying every event. Events support history screens, player/team timelines, transactions, explanations, future StoryPackets, and debugging.

## Event shape

```ts
type LeagueEvent = {
  id: string
  type: LeagueEventType
  season: number
  phase: string
  leagueDay: number
  entityRefs: Array<{ type: string; id: string }>
  payload: Record<string, unknown>
  summary: string
  importance: "routine" | "notable" | "major"
  storyTags: string[]
  source: {
    kind: "command" | "simulation" | "migration"
    id: string
  }
}
```

Event IDs must be stable within a saved league. Wall-clock timestamps may exist as metadata but must not be used as simulation facts or deterministic IDs.

## Persistence through Dexie

`packages/db-v2` should expose the V2 repository interface:

```ts
interface LeagueRepository {
  list(): Promise<LeagueSummary[]>
  load(id: string): Promise<LeagueDocument | null>
  save(document: LeagueDocument): Promise<void>
  remove(id: string): Promise<void>
  export(id: string, profile: ExportProfile): Promise<Blob>
  import(file: Blob): Promise<ImportPreview>
}
```

The current repository proves save/load, validation, serialization, and JSON
round-trip behavior for the foundation document. Export profiles, large-data
separation, and full phase-specific league data remain target-product work.

Dexie stores the current document envelope and may later store large game sections separately. The UI and worker must not know Dexie table names. The repository writes transactionally after each completed command/day and before changing the active save pointer.

The worker owns active simulation state. The main thread receives a completed document and persists it. A long “simulate to” operation may report daily checkpoints; the initial safe behavior is to commit each completed day, with batching allowed after performance measurement.

## Validation and import

Import runs in this order:

1. Parse JSON and enforce file-size limits.
2. Validate JSON Schema.
3. Check schema/rules version compatibility.
4. Apply pure migrations to the current schema.
5. Validate IDs, references, uniqueness, and required fields.
6. Validate domain invariants: rosters, contracts, payroll, standings, draft ownership, phase tasks, and event references.
7. Rebuild projections and report warnings.

Optional corrupt game logs or diagnostic data may be dropped with a warning if the core snapshot remains valid. Core entity corruption must fail without replacing the current local save. The original file remains untouched and a migrated export can be downloaded.

## Migrations

Migrations are pure, versioned functions:

```text
v1 LeagueRecord → import adapter → v2 LeagueDocument → v3 ... → current
```

Each migration requires fixtures, a report, and fact-preservation tests. The v2 importer may preserve unsupported v1 data in `importNotes`; it must not make v2’s domain model depend on the v1 `LeagueRecord` shape.

## Export profiles

| Profile | Includes | Excludes |
|---|---|---|
| Full league | All entities, settings, events, archives, box scores, game logs | Play-by-play by default |
| Operational save | Current state, required entities, settings, pending tasks, recent events | Older games and diagnostics |
| Storytelling package | Season context, standings, playoff series, transactions, contracts, injuries, development, awards, important games, decisions, source event IDs | Hidden true ratings and internal diagnostics by default |
| Player career | Player identity, seasons, production, teams, contracts, injuries, awards, events, milestones | Unrelated league data |
| Draft class | Prospects, public scouting ranges, measurements, production, class context, mock draft, selections | Unrelated history |
| Team history | Team seasons, rosters, transactions, contracts, staff, owners, goals, awards, records | Unrelated teams except referenced facts |
| Debug | Full data, settings, random mode/scopes, command diagnostics, failed validation context | Nothing; advanced use only |

Users can choose whether to include box scores and player game logs. Detailed play-by-play is not a first-v2 export option because it is not a first-v2 simulation/storage feature.

## StoryPacket

```ts
type StoryPacket = {
  packetVersion: number
  leagueContext: {
    leagueId: string
    season: number
    phase: string
    rulesPreset: string
  }
  facts: {
    standings: unknown[]
    playoffSeries: unknown[]
    transactions: unknown[]
    contracts: unknown[]
    injuries: unknown[]
    development: unknown[]
    draft: unknown[]
    awards: unknown[]
    importantGames: unknown[]
    relationships: unknown[]
    ownerGoals: unknown[]
    frontOfficeDecisions: unknown[]
  }
  sourceEventIds: string[]
  generatedNarrative?: {
    id: string
    text: string
    model: string
    createdAt: string
  }
}
```

The future narrative layer receives facts and source IDs. Generated prose is cached separately, clearly marked, optional, regenerable, and safe to delete.

## Compatibility and recovery

- Keep a golden file for every released schema version.
- Support unknown optional fields where possible.
- Reject unknown required schema versions with an upgrade message.
- Create a backup before import or migration.
- Provide a repair report listing dropped optional sections.
- Never silently reroll or rewrite saved simulation facts during import.
