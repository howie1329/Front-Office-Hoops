# Front Office Hoops v2 — Current State

**Last audited:** August 10, 2026
**Status vocabulary:** `implemented` means the code and route exist; `calibration pending` means the behavior is not yet accepted as standard gameplay; `planned` means no production route or authoritative league integration exists.

## Product position

V2 is currently a browser-hosted calibration platform with an authoritative
league-creation and regular-season vertical slice, not a playable replacement
for V1. It has the foundation worker/schema/repository round trip,
worker-backed developer labs, and a generated, structured league with dated
preseason and regular-season schedules that can be saved, selected, reloaded,
simulated, and deleted.

The V2 home page and start flow now demonstrate a validated `LeagueDocument`
moving through league creation, conference/division assignment, team
selection, the worker, Dexie, and JSON import/export paths. New saves open on
the first regular-season date. Date advancement, simulation targets, rotation
updates, player releases, standings, injuries, production/value updates, and
season archives are implemented. Playoffs and the authoritative offseason
phase sequence remain the next lifecycle boundary.

V1 remains the existing playable local league application and is intentionally
kept runnable beside V2.

## Implementation matrix

| Area                                 | Current state                                          | Evidence                                                                                                                                           | Next gate                                                                                      |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Document, schema, worker, repository | Implemented authoritative foundation                   | `domain-v2`, `league-schema`, `sim-v2`, `db-v2`, creation/lifecycle workers, recovery checkpoints, and saved league shell                          | Extend phase transitions through playoffs and offseason                                        |
| Population & roster                  | Implemented workbench                                  | Player Generation and Team Assembly routes; deterministic population and roster fixtures                                                           | Accept league-wide distributions and league-creation adapter                                   |
| Game & matchup                       | Initial standard benchmark accepted and promoted       | Possession simulation, rotations, availability, reconciliation, 1,000-game baseline, worker batches, and authoritative regular-season games        | Retain cross-lab acceptance and injury-specific evidence                                       |
| Production & value                   | Implemented lab, season runner, and league promotion   | Season fixtures, game aggregation, production records, universal player value, worker route, and authoritative checkpoint updates                  | Accept production/value distributions                                                          |
| Career cohort                        | Implemented worker-backed harness                      | Development, decline, retirement, matched cohorts, reports, settings, explorer UI                                                                  | Accept career distributions and league-loop transitions                                        |
| Market & rules                       | Isolated standard calibration accepted                 | 100-seed market baseline and 30-season line-growth/tax-boundary evidence; demand, utility, free agency, target boards, capacity, and cleanup       | Promote typed market state and validate turnover/tax incidence in the League Loop              |
| Draft & decision                     | Implemented calibration workbench; calibration pending | `/developer-labs/draft-decision`, deterministic 75-player/60-pick runs, scouting reports, versioned boards, matched diagnostics, safe/full exports | Accept board behavior across 100+ classes and integrate draft contracts into the league loop   |
| League loop and management shell     | Implemented regular-season vertical slice              | Creation, dashboard, roster/rotation, finance, free agents, player detail, simulation targets, recovery, standings, and season archives            | Add playoffs, offseason phases, draft/market commands, staff, owner goals, and multi-season AI |

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

The isolated standard Market & Rules gate now passes a reproducible 100-seed
market batch and a 30-season line-growth/tax-boundary harness. The next product
gate is the cross-lab acceptance review for production/value, career,
population, and draft behavior, followed by promotion of typed market and
draft state into authoritative playoff/offseason lifecycle commands.

## Validation snapshot

On the audit date:

- The focused market calibration tests and calibration package typecheck pass.
- The standard market baseline completed 100 of 100 seeds with no run,
  accounting, accepted-legality, hard-cap, or roster-capacity failures.
- The 30-season stable, standard, high-growth, low-tax-pressure, and
  high-tax-pressure line scenarios pass their ordering, monotonicity, relative
  drift, and sensitivity checks.

Run the focused checks from the repository development guide after changing
simulation contracts or lab adapters.

## Not current V2 functionality

The following remain target-product or later-phase work:

- Playoff scheduling and the authoritative offseason phase sequence. The
  regular-season worker commands, standings, and season archives now exist.
- Player-facing management screens beyond the dashboard, roster/rotation,
  finance, free-agency listing, and player detail surfaces.
- Authoritative Draft & Decision integration and baseline draft promotion into the league loop.
- Integrated multi-season League Loop evidence for roster turnover, tax
  incidence, draft inflow, development, and retirement.
- Full first-v2 export profiles, migration coverage, browser E2E coverage, and production hardening.
- Advanced CBA, multi-year organizational AI, morale, narrative, accounts, and cloud saves.
