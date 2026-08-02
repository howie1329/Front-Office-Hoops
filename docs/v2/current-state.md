# Front Office Hoops v2 — Current State

**Last audited:** August 2, 2026
**Status vocabulary:** `implemented` means the code and route exist; `calibration pending` means the behavior is not yet accepted as standard gameplay; `planned` means no production route or authoritative league integration exists.

## Product position

V2 is currently a browser-hosted calibration platform with its first
authoritative league-creation slice, not a playable replacement for V1. It has
the foundation worker/schema/repository round trip, worker-backed developer
labs, and a generated, structured league with dated preseason and regular-
season schedules that can be saved, selected, reloaded, and deleted.

The V2 home page and start flow now demonstrate a validated `LeagueDocument`
moving through league creation, conference/division assignment, team
selection, the worker, Dexie, and JSON import/export paths. New saves open on
the first regular-season date; `SelectUserTeam` is implemented, while
`AdvanceDay` remains intentionally rejected until the in-season integration
slice is implemented.

V1 remains the existing playable local league application and is intentionally
kept runnable beside V2.

## Implementation matrix

| Area                                 | Current state                                          | Evidence                                                                                                                                           | Next gate                                                                                    |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Document, schema, worker, repository | Implemented league bootstrap slice                     | `domain-v2`, `league-schema`, `sim-v2`, `db-v2`, creation worker, and saved league shell                                                           | Add lifecycle commands and checkpoint transitions                                            |
| Population & roster                  | Implemented workbench                                  | Player Generation and Team Assembly routes; deterministic population and roster fixtures                                                           | Accept league-wide distributions and league-creation adapter                                 |
| Game & matchup                       | Implemented initial engine and lab                     | Possession simulation, rotations, availability, reconciliation, worker batches, reports                                                            | Accept benchmark ranges and promote into gameplay                                            |
| Production & value                   | Implemented initial lab and season runner              | Season fixtures, game aggregation, production records, universal player value, worker route                                                        | Accept production/value ranges                                                               |
| Career cohort                        | Implemented worker-backed harness                      | Development, decline, retirement, matched cohorts, reports, settings, explorer UI                                                                  | Accept career distributions and league-loop transitions                                      |
| Market & rules                       | Active implementation/calibration                      | Economy, demand, offer utility, deterministic free agency, target boards, activity reporting, roster cleanup                                       | Accept multi-season market behavior and integrate into league commands                       |
| Draft & decision                     | Implemented calibration workbench; calibration pending | `/developer-labs/draft-decision`, deterministic 75-player/60-pick runs, scouting reports, versioned boards, matched diagnostics, safe/full exports | Accept board behavior across 100+ classes and integrate draft contracts into the league loop |
| League loop and management shell     | Implemented creation shell and dated bootstrap         | `/league/start` creates/selects leagues; `/league` shows phase, date, conference, division, and schedule-backed save                               | Add owner goals, rotations, simulation, and lifecycle recovery                               |

## V2 routes

The current V2 application exposes the start/league shell plus seven lab routes:

- `/league/start`
- `/league`

- `/developer-labs/player-generation`
- `/developer-labs/team-assembly`
- `/developer-labs/game-matchup`
- `/developer-labs/production-value`
- `/developer-labs/development-cohorts`
- `/developer-labs/market-rules`
- `/developer-labs/draft-decision`

These routes represent five active lab surfaces because Player Generation and
Team Assembly are two workbenches inside Population & Roster.

## Package boundaries

The current V2 implementation uses these packages:

- `packages/domain-v2` — canonical V2 entities and report types.
- `packages/league-schema` — strict schemas, validation, serialization, and migrations.
- `packages/sim-v2` — player, game, season, production, career, economy, and market modules.
- `packages/calibration` — seeded cohorts, batches, benchmarks, sensitivity reports, and fixtures.
- `packages/db-v2` — Dexie/IndexedDB repository for V2 league documents.
- `apps/web-v2` — TanStack Start application, workers, lab adapters, and routes.
- `packages/ui` — shared UI primitives.

V2 does not use the V1 `LeagueRecord`, V1 simulation package, or V1 lifecycle
commands as its source of truth.

## Current calibration focus

The latest implementation work is in Market & Rules, especially free-agency
target boards, activity reporting, roster capacity, and unsigned-player cleanup.
The next product gate is not another standalone visual lab; it is calibration
acceptance and promotion of the existing modules into authoritative league
creation and lifecycle commands.

## Validation snapshot

On the audit date:

- V2 tests pass across domain, schema, simulation, calibration, database, and web workspaces.
- V2 typechecks pass across the same workspaces.
- `web-v2` lint still reports two pre-existing diagnostics in the Game & Matchup implementation: one unnecessary assertion in `src/lib/gameMatchupLab.ts` and one import-style issue in `src/routes/developer-labs.game-matchup.tsx`.

Run the focused checks from the repository development guide after changing
simulation contracts or lab adapters.

## Not current V2 functionality

The following remain target-product or later-phase work:

- In-season lifecycle commands, standings, playoffs, and season archives in the authoritative league document. The calendar and schedule contracts now exist, but the worker does not advance them yet.
- The player-facing league management screens beyond the initial shell.
- Authoritative Draft & Decision integration and baseline draft promotion into the league loop.
- Multi-season League Loop Lab.
- Full first-v2 export profiles, migration coverage, browser E2E coverage, and production hardening.
- Advanced CBA, multi-year organizational AI, morale, narrative, accounts, and cloud saves.
