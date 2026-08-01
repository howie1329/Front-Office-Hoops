# Front Office Hoops v2 — Current State

**Last audited:** August 1, 2026  
**Status vocabulary:** `implemented` means the code and route exist; `calibration pending` means the behavior is not yet accepted as standard gameplay; `planned` means no production route or authoritative league integration exists.

## Product position

V2 is currently a browser-hosted calibration platform, not a playable replacement
for V1. It has a foundation worker/schema/repository round trip and a set of
worker-backed developer labs that exercise production simulation modules.

The V2 home page currently demonstrates a validated `LeagueDocument` moving
through the worker, Dexie, and JSON import/export path. The authoritative league
document is still foundation-only: `LeaguePhase` is `"foundation"`, `NoOp` is the
only completed lifecycle command, and `AdvanceDay` remains intentionally
rejected until lifecycle integration is implemented.

V1 remains the existing playable local league application and is intentionally
kept runnable beside V2.

## Implementation matrix

| Area | Current state | Evidence | Next gate |
| --- | --- | --- | --- |
| Document, schema, worker, repository | Implemented foundation | `domain-v2`, `league-schema`, `sim-v2`, `db-v2`, and the V2 home round trip | Promote validated systems into lifecycle commands |
| Population & roster | Implemented workbench | Player Generation and Team Assembly routes; deterministic population and roster fixtures | Accept league-wide distributions and league-creation adapter |
| Game & matchup | Implemented initial engine and lab | Possession simulation, rotations, availability, reconciliation, worker batches, reports | Accept benchmark ranges and promote into gameplay |
| Production & value | Implemented initial lab and season runner | Season fixtures, game aggregation, production records, universal player value, worker route | Accept production/value ranges |
| Career cohort | Implemented worker-backed harness | Development, decline, retirement, matched cohorts, reports, settings, explorer UI | Accept career distributions and league-loop transitions |
| Market & rules | Active implementation/calibration | Economy, demand, offer utility, deterministic free agency, target boards, activity reporting, roster cleanup | Accept multi-season market behavior and integrate into league commands |
| Draft & decision | Planned | No V2 route or authoritative draft integration | Build after player value, market, and league contracts stabilize |
| League loop and management shell | Planned | No V2 playable league shell; lifecycle command remains foundation-only | Generate, select, simulate, save, reload, and advance a complete league |

## V2 routes

The current V2 application exposes six lab routes plus the foundation home page:

- `/developer-labs/player-generation`
- `/developer-labs/team-assembly`
- `/developer-labs/game-matchup`
- `/developer-labs/production-value`
- `/developer-labs/development-cohorts`
- `/developer-labs/market-rules`

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

- Complete league creation and team selection flow.
- In-season lifecycle commands, standings, playoffs, and season archives in the authoritative league document.
- The player-facing league shell and management screens.
- Draft & Decision Lab and baseline draft integration.
- Multi-season League Loop Lab.
- Full first-v2 export profiles, migration coverage, browser E2E coverage, and production hardening.
- Advanced CBA, multi-year organizational AI, morale, narrative, accounts, and cloud saves.

