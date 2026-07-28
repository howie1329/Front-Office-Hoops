# Front Office Hoops v2 Migration Plan

## Recommendation

Develop v2 beside v1 in the existing monorepo. Keep `apps/web` and current packages runnable. Add isolated v2 packages and `apps/web-v2`; do not place a feature flag around two simulation truths in one route tree. This avoids breaking the prototype while allowing a clean domain/save/lifecycle contract.

## Proposed structure

```text
apps/
  web/                         current v1
  web-v2/                      v2 application
packages/
  shared/                      stable UI/general utilities only
  ui/                          shared accessible visual primitives
  sim/                         current v1 simulation
  db/                          adapters; add v2 document repository
  domain-v2/                   v2 entities, commands, events, projections
  sim-v2/                      v2 simulation and economy
  league-schema/               schema, validators, migrations, export profiles
  calibration/                 labs, benchmarks, batch reports
  story-packets/               factual narrative inputs
```

Keep the v1 path intact until v2 passes the replacement gates. `apps/web-v2` may initially have a thin shell and read a v2 golden file; it should not import v1 `LeagueRecord`.

## What can be shared safely

- shadcn/accessibility primitives from `packages/ui`;
- generic formatting, IDs, dates, and serialization utilities after contract tests;
- a deterministic RNG implementation only after seed/replay behavior is specified;
- CI, lint, typecheck, and test infrastructure;
- research documents, benchmark profiles, and fixtures;
- possibly a table wrapper once v2 establishes the API.

## What must remain isolated

- v1 `LeagueRecord`, `SeasonState`, and v1 save version;
- v1 player overall/potential semantics;
- v1 player-value and contract-market functions;
- v1 phase eligibility and automatic advancement;
- v1 game/stat-allocation model;
- v1 trade/draft asset assumptions;
- v1 route components that mutate or assume snapshot shape.

Sharing these too early would create two implementations that appear compatible while encoding different truths.

## Milestones

### M0 — Audit and decision gate

Deliver this audit, freeze new foundational v1 work, identify golden fixtures, and choose default rules/preset targets. No v2 gameplay implementation yet.

### M1 — Schema and deterministic kernel prototype

Build `domain-v2` types, `league-schema`, event envelope, command result, seed scopes, validators, and a tiny document fixture. Demonstrate export/import/migration without a browser.

### M2 — Calibration kernel

Build seeded batch runners and reports. Prototype ratings, player generation, possession/game output, development, and contract market independently. Do not connect to a full UI.

### M3 — Minimal playable v2 engine

Connect league creation, roster, season simulation, lifecycle, draft, free agency, and export/import using calibrated rules. Include events and invariant checks after every command.

### M4 — AI organization and transaction depth

Add persistent team plans, trades, cap scenarios, protected picks, and selected Standard rules. Gate every addition on batch calibration.

### M5 — Web v2 information architecture

Implement shell, action center, roster, rotation, cap, trade, draft, free agency, history, and import/export screens using the table strategy. Add mobile and E2E coverage.

### M6 — Narrative and advanced rules

Add StoryPackets and optional narrative generation. Add advanced rules only if the default economy and lifecycle are stable.

### M7 — Replacement evaluation

Run v1/v2 comparison on usability, performance, save reliability, multi-season validity, and player-facing explanations. V1 remains available until explicit replacement criteria pass.

## Validation gates

- Schema: round-trip full/partial exports; migrations preserve facts; invalid references fail safely.
- Determinism: same document, config, seed, and command stream produce the same facts and event IDs.
- Game: benchmark ranges and reconciliation invariants pass across seeded batches.
- Player generation: class strength, talent tails, positional supply, and role correlations pass.
- Development: age curves, breakouts, declines, injury effects, and career lengths pass.
- Economy: market salaries, continuity, max/min frequency, unsigned players, and cap reconciliation pass.
- AI: rosters, plans, draft behavior, and dynasty/rebuild rates pass ten-year reports.
- UI: critical workflows pass browser E2E on desktop and mobile widths.
- Performance: load, command, batch, memory, and export size budgets are explicit and met.

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| V2 scope grows into an NBA clone | High | Three rules profiles; default Standard only after core validation |
| Calibration never converges | High | Labs before product screens; benchmark ranges and stop criteria |
| V1/v2 sharing causes coupling | High | Isolate domain and sim packages; share only tested primitives |
| Full snapshots become too large | High | Optional data sections, normalized entities, compaction, separate game storage |
| AI narrative invents facts | High | StoryPackets, source event IDs, facts/narrative separation |
| UI rebuild outruns engine | Medium | Screen specs only after command/data contracts exist |
| Non-deterministic IDs break replay | Medium | Seeded IDs from command scope; wall-clock metadata excluded from facts |
| Existing v1 regressions | Medium | Do not alter v1 foundations; run v1 checks in CI |

## Conditions before replacing v1

V2 must support a complete multi-season loop, pass schema and invariant suites, produce stable game/player/economy distributions, support import/export and migrations, provide essential management screens, load and save reliably, and show no critical regression in user workflows. A v2 demo or one successful season is not sufficient.

## Rollback strategy

V1 remains a separate app and data path. V2 writes only v2 documents. A failed v2 release can be rolled back by routing users to v1 without transforming v1 saves. Imported v1 files are copied and migrated into new v2 documents; the original remains untouched. Feature work can be abandoned by removing `apps/web-v2` and v2 packages without deleting v1 code or saves.
