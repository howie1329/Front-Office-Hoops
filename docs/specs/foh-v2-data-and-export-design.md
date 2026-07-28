# Front Office Hoops v2 Data and Export Design

## Design goals

The league file is a versioned product contract. It must be portable, inspectable, validated before import, migration-safe, usable without IndexedDB, and able to omit large data without damaging core history.

## Canonical document

```ts
type LeagueDocument = {
  schema: { name: "foh-league"; version: number; rulesVersion: number }
  metadata: { id: string; name: string; createdAt: string; updatedAt: string }
  determinism: { baseSeed: string; commandSequence: string[]; configHash: string }
  rules: LeagueRulesConfig
  state: {
    season: number
    phase: string
    leagueDay: number
    userTeamId: string
    calendar: CalendarState
  }
  entities: {
    teams: Record<string, TeamEntity>
    players: Record<string, PlayerEntity>
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
    playByPlay?: PlayEvent[]
    labDiagnostics?: LabReport[]
    scoutingObservations?: ScoutingObservation[]
  }
  narratives?: StoryPacketCache
}
```

The exact schema should be defined in `packages/league-schema` and generated as JSON Schema plus TypeScript types. Normalized maps reduce duplication and make references explicit. `projections` can be rebuilt and should never be the only copy of an authoritative fact.

## Snapshot plus event ledger

Use a hybrid model:

- A complete current snapshot makes loading and normal export simple.
- An append-only event ledger powers history, explanation, replay, and StoryPackets.
- Periodic checkpoints or compacted snapshots avoid replaying a thirty-year league from day one.
- Derived standings, payroll, scouting views, and rankings can be rebuilt from entities, events, and the rules/config version.

This is preferable to pure event sourcing for a browser-first product while preserving auditability.

## Validation

Import runs in order:

1. JSON parse and size limits.
2. Schema validation.
3. Version and rules compatibility check.
4. Migration chain to the current schema.
5. Reference and uniqueness checks.
6. Domain invariants: roster membership, contract ownership, payroll, standings, pick ownership, phase tasks, and history immutability.
7. Rebuild projections and report warnings.

Validation errors should identify a JSON path and entity ID. Optional corrupt game or play-by-play sections may be dropped with a warning if the core snapshot remains valid. Core entity corruption must fail safely without replacing the current save.

## Migrations and compatibility

Migrations are pure functions:

```text
v1 -> v2 -> v3 -> ... -> current
```

Each migration has a version, input/output contract, fixture, and report. Keep an import adapter for v1 `LeagueRecord` as a best-effort migration only; do not make v2 depend on every v1 field. Preserve unsupported v1 facts in an `importNotes` section when they cannot be represented exactly.

The application should write only the current version. It should retain the original imported file in memory for diagnostics, never overwrite it, and offer a migrated export.

## Export profiles

| Profile | Includes | Excludes |
|---|---|---|
| Full league | All entities, contracts, events, archives, games if selected, config | Nothing except optional play-by-play by default |
| Operational save | Current entities, rules, pending tasks, recent history | Old games, play-by-play, verbose diagnostics |
| Storytelling package | Season context, standings, series, transactions, contracts, injuries, development, awards, important games, relationships, decisions, event tags | Raw internal diagnostics and hidden true ratings unless explicitly requested |
| Player career | Player identity, season profiles, teams, contracts, injuries, awards, events, milestones | Unrelated league entities |
| Draft class | Prospects, public scouting reports, measurements, class context, pick results | Other league history |
| Team history | Team seasons, rosters, transactions, contracts, staff, awards, records, strategy decisions | Unrelated players except referenced history |
| Debug | Full data plus config hash, command sequence, RNG scopes, diagnostics | Nothing; developer-only |

Users can select season range and include/exclude box scores. Detailed game events are never required for the core save.

## StoryPacket

```ts
type StoryPacket = {
  packetVersion: number
  leagueContext: { leagueId: string; season: number; phase: string; rulesPreset: string }
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
    frontOfficeDecisions: unknown[]
  }
  sourceEventIds: string[]
  generatedNarrative?: { id: string; text: string; model: string; createdAt: string }
}
```

The external AI receives facts and source IDs. Generated narrative is cached separately, clearly marked, and safe to delete. A narrative cannot change a fact or be required to reconstruct the simulation.

## Persistence strategy

`packages/db` may continue to use Dexie, but the table should store a versioned `LeagueDocument` envelope and export metadata. Save writes should be transactional and debounced at the adapter boundary. Large game sections may be stored in separate keyed tables or compressed chunks while the exported document remains canonical. The web app should never assume IndexedDB exists; import, export, validation, and batch tools should work in Node.

## Compatibility and recovery

- Maintain a golden file for every released schema version.
- Support forward-compatible unknown optional fields.
- Reject unknown required schema versions with a clear upgrade message.
- Keep automatic backups before import and migration.
- Provide a repair report that lists dropped optional sections.
- Never silently rewrite simulation facts during migration.
