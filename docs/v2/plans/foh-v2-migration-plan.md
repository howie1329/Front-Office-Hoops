# Front Office Hoops v2 Migration Plan

## Recommendation

Develop v2 beside v1 in the existing monorepo. Keep the current `apps/web` and v1 packages runnable. Add an isolated v2 application and domain/simulation packages. Do not put two simulation truths behind feature flags in the same route tree.

V2 is a browser-first TanStack Start application with no gameplay backend. It uses a Web Worker for simulation, Dexie/IndexedDB for local persistence, and JSON as the canonical portable league document.

## Proposed structure

```text
apps/
  web/                         current v1 application
  web-v2/                      v2 TanStack Start application
packages/
  shared/                      stable UI/general utilities only
  ui/                          shared shadcn/ui primitives
  sim/                         current v1 simulation
  db/                          v1 adapter plus v2 repository adapter
  domain-v2/                   v2 entities, commands, events, projections
  sim-v2/                      v2 simulation, markets, lifecycle, worker protocol
  league-schema/               JSON Schema, validators, migrations, export profiles
  calibration/                 labs, benchmarks, batch reports
  story-packets/               later factual narrative inputs
```

The v2 application can initially render a shell and a generated fixture while engine experiments run independently. It should not import v1 `LeagueRecord` or v1 valuation functions.

## What can be shared safely

- shadcn/ui and accessibility primitives;
- generic formatting, dates, serialization, and stable ID utilities after tests;
- table primitives after the v2 table API is defined;
- CI, lint, typecheck, and test infrastructure;
- benchmark profiles and research fixtures;
- a random-source interface, but not v1’s deterministic game semantics.

## What must remain isolated

- v1 `LeagueRecord`, `SeasonState`, and save version;
- v1 player overall/potential semantics;
- v1 player-value and contract-market functions;
- v1 phase eligibility and automatic advancement;
- v1 game/stat-allocation model;
- v1 trade/draft asset assumptions;
- v1 route components coupled to snapshot shape.

## Roadmap relationship

The [v2 roadmap](./foh-v2-roadmap.md) is the delivery sequence. This document defines coexistence, migration, rollback, and replacement gates. The current [v1 roadmap](../../roadmap.md) remains the record of the shipped prototype and should not be rewritten as if v2 already exists.

## Migration and coexistence milestones

### M0 — Decision and documentation baseline

- Approve the v2 product brief and settings boundary.
- Keep v1 production behavior untouched.
- Identify v1 golden saves and current invariant fixtures.
- Define the v2 schema/version namespace.

### M1 — V2 foundation without gameplay

- Add `domain-v2`, `league-schema`, and the worker protocol.
- Define `LeagueDocument`, `LeagueCommand`, `LeagueEvent`, `SimulationConfig`, and validation errors.
- Build JSON round-trip fixtures.
- Build a minimal Dexie repository adapter.
- Prove TanStack Start ↔ worker ↔ repository data flow with a fixture.

### M2 — Calibration prototypes

- Implement ratings and player-generation experiments.
- Implement simple production and visible universal player value.
- Implement game, development, injury, and contract-market benchmark runners.
- Do not connect unstable prototypes to the full v2 UI.

### M3 — First playable v2 engine

- Generate the complete 30-team league before team selection.
- Add owners, three goals, four staff roles, fog-of-war, rotations, box scores, and phase gates.
- Add soft-cap-plus-tax economy, simple trades, draft day, and three-stage free agency.
- Save snapshots and events after commands/days.
- Run invariant checks after every command.

### M4 — V2 management shell

- Build league creation/settings and team selection.
- Build dashboard, calendar, roster, rotation, player, standings, box score, owner goals, staff, cap, trade, draft, free agency, history, and save screens.
- Use TanStack Table for dense screens.
- Add worker progress and error/recovery states.

### M5 — Calibration and hardening

- Run multi-season reports and golden save replays.
- Tune standard defaults and advanced setting bounds.
- Add browser E2E for league creation, next game, rotation, trade, free agency, draft, export, import, and reload.
- Establish load-time, simulation-time, memory, and file-size budgets.

### M6 — Later expansion

- Multi-year organizational AI.
- Morale, role promises, playing-time security, and trait evolution.
- Rich draft scouting with reports/interviews/workouts.
- Advanced cap/apron rules and complex pick protections.
- Optional AI narrative and future account/cloud-save services.

## Validation gates

- **Schema:** round-trip full/partial exports; migrations preserve facts; invalid references fail safely.
- **Worker:** long simulations do not block the UI; interrupted work can recover from the last committed snapshot.
- **Randomness:** normal leagues vary across creation runs; lab fixtures reproduce exact expected results.
- **Game:** benchmark means, percentiles, correlations, and reconciliation pass.
- **Players:** generated profiles are coherent, archetypes are derived, and class/talent tails are plausible.
- **Economy:** contracts have continuity, max/min frequency is plausible, payroll reconciles, and unusual outcomes have explanations.
- **Lifecycle:** every phase saves/resumes and blocks only for explicit actionable reasons.
- **AI:** baseline teams satisfy legal actions without creating impossible rosters or cap states.
- **UI:** critical workflows pass desktop/mobile E2E and accessible keyboard flows.
- **Portability:** exports import cleanly across browser sessions and schema migrations.

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| V2 scope grows into an NBA clone | High | Fixed format, soft-cap-plus-tax default, defer aprons and complex exceptions |
| User settings become raw magic numbers | High | Standard preset, grouped advanced settings, bounds, descriptions, config version |
| Calibration never converges | High | Experiments before full UI; benchmark ranges and explicit stop criteria |
| V1/v2 sharing causes semantic coupling | High | Isolate domain and sim packages; share only tested primitives |
| Worker/repository boundaries lose state | High | Command protocol, snapshot validation, transactional saves, interruption fixtures |
| Full snapshots become too large | Medium | Compact box scores, optional exports, separate large-data tables if needed |
| Normal randomness is impossible to debug | Medium | Explicit deterministic lab mode, random scopes, diagnostics, failed-seed bundles |
| AI teams create invalid states | Medium | Baseline legal-action planner, invariant checks, bounded behavior |
| UI rebuild outruns the engine | Medium | Screen specs only after command/data contracts exist |
| Advanced features distract from core loop | Medium | Gate morale, narrative, multi-year AI, and advanced CBA behind calibration |

## Conditions before replacing v1

V2 must:

1. Run the complete multi-season loop from league creation through at least ten seasons.
2. Pass schema, migration, entity, accounting, and lifecycle invariants.
3. Produce stable game, player, development, injury, and salary distributions.
4. Support all required first-v2 user decisions without manual data repair.
5. Support local save/reload and JSON export/import without data loss.
6. Provide the core management screens and responsive table workflows.
7. Explain blocked actions, contract outcomes, trades, owner goals, and major simulation events.
8. Meet defined performance and save-size budgets.

## Rollback strategy

V1 remains a separate application and data path. V2 writes only v2 documents. A failed v2 release can route users back to v1 without transforming v1 saves. Imported v1 files are copied and migrated into new v2 documents; the original remains untouched. V2 work can be paused or removed without deleting v1 code or local saves.
