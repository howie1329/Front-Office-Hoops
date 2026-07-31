# Plan 001: Establish game-engine characterization tests and full calibration reports

## Metadata

- Priority: P0 prerequisite for formula calibration
- Effort: Medium
- Risk: Low to medium
- Area: V2 simulation, calibration, schema, tests, documentation
- Planned against commit: 718d9f7
- Date: 2026-07-31
- Depends on: None

## Objective

Create a deterministic baseline that answers two separate questions:

1. Did the simulation preserve its internal accounting and deterministic behavior?
2. Does the distribution of simulated games resemble the intended basketball benchmark?

The first question becomes characterization and invariant coverage. The second becomes a richer calibration report with explicit, versioned benchmark comparisons. This work must happen before changing simulation formulas so later changes can be judged across the whole output profile instead of one headline stat.

The existing user-facing sliders remain part of the effective simulation configuration. This plan does not remove, hide, or reinterpret them. It also does not change how any slider affects the engine; slider sensitivity and dead-control fixes belong in the following engine work once this baseline exists.

## Current state

The V2 simulation already has useful low-level coverage:

- packages/sim-v2/tests/gameSimulation.test.ts covers exact seeded determinism, period and box-score production, reconciliation, creation opportunities, unavailable players, and minutes restrictions.
- packages/calibration/src/index.ts can run deterministic batches, retain failed fixtures, report progress, cancel, and collect a small set of metrics.
- packages/calibration/tests/index.test.ts covers deterministic reports and invalid-fixture retention.
- packages/league-schema/src/schema.ts validates a version-1 matchup calibration report.
- The matchup lab renders calibration metrics dynamically, so it should continue to work if the report retains existing metric keys and adds fields.

The gap is breadth and repeatability. The current report does not expose the main shooting, possession, efficiency, rebounding, passing, defensive, foul, rotation, or concentration distributions needed to diagnose whether a result is an engine problem or a slider/configuration problem. The current tests also do not preserve a compact, reviewable output fingerprint for future formula changes.

The baseline should record the current engine honestly. A metric falling outside the benchmark is a finding, not a test failure until the engine is deliberately calibrated toward that target.

## Scope

### In scope

- Expand calibration metric collection without changing simulation formulas.
- Add typed benchmark profiles and benchmark pass/fail checks outside the simulation config.
- Include the effective simulation config in a report.
- Version the report schema for the new fields.
- Add deterministic characterization and invariant tests.
- Add a checked-in V2 calibration baseline document containing the fixture, seed, sample size, metric definitions, current output, benchmark result, and known failures.
- Run the existing matchup-lab typecheck to verify the report contract remains consumable.

### Out of scope

- Changes to packages/sim-v2/src/gameSimulation.ts or packages/sim-v2/src/gameConfig.ts formulas, weights, randomness, or slider semantics.
- Changes to apps/web-v2/src/routes/developer-labs.game-matchup.tsx or its worker, unless a type-only compatibility issue is discovered and separately approved.
- New league gameplay behavior, database persistence, V1 behavior, or UI redesign.
- Treating benchmark ranges as hard-coded engine constants.
- Adding a large analytics framework or external dependency.
- Fixing dead or weak sliders. The report should make those problems easier to verify, but their implementation is a later plan.

## Design decisions

### 1. Keep report data and benchmark targets separate

Add a calibration-owned benchmark profile, for example modern-balanced-v1, under packages/calibration/src/benchmarkProfiles.ts. It should contain human-readable target ranges for the metrics below and no engine configuration values.

The batch runner should accept an optional benchmark profile. When supplied, the report includes per-metric actual values, target ranges, and a boolean result. A failed benchmark check must not throw or reject the report; it is diagnostic output. When no profile is supplied, the report remains a valid batch report with a null or absent benchmark section.

Use broad ranges initially. The reference study provides NBA-oriented anchors, but this first profile is a diagnostic calibration envelope rather than a claim that every league or user slider setup must land on one exact number. Keep the profile versioned so target changes are reviewable.

### 2. Preserve existing keys and add richer metrics

Do not rename the current report keys used by tests and the matchup lab. Add metrics with stable definitions. At minimum, cover:

- Team output: team points, possessions, offensive efficiency, overtime periods, and injury events.
- Shooting: field-goal percentage, three-point percentage, free-throw percentage, three-point attempt rate, and free-throw attempt rate.
- Possession quality: turnover rate, assists, and reconciliation pass rate.
- Team activity: total rebounds, offensive rebounds, steals, blocks, and fouls.
- Rotation and concentration: top-player points, top-player opportunity share, bench points share, starter minutes, and bench minutes.
- Reliability: completed and failed counts already present, plus any safe failure-rate metric that does not obscure the retained failure records.

Collect team-level samples across both teams so a three-game batch produces six team observations for team metrics. Document this explicitly in the report and tests. Keep game-level metrics such as total score at one observation per completed game.

Use safe denominator behavior. For example, a zero-attempt shooting percentage should be represented consistently as zero with a documented count, rather than producing NaN or Infinity.

### 3. Add effective configuration to the report

Include the effective GameSimulationConfig used by the batch. The fixture factory must produce a consistent config for a batch; if mixed configs are possible, fail validation with a clear diagnostic rather than silently labeling the report with the first game’s config.

Reuse the league schema’s game-config schema instead of duplicating its shape. If the current schema is private, extract/export it through packages/league-schema/src/index.ts as the smallest necessary change.

### 4. Use an explicit report version

The current report schema is a strict version-1 shape. Bump the report to version 2 when adding the effective config and benchmark section. Treat the matchup-lab JSON as a versioned export artifact. Do not add a permissive migration layer unless repository search finds a current consumer that requires reading old reports; if one exists, preserve a focused v1 parser or migration test rather than weakening the v2 schema.

### 5. Separate characterization from quality gates

Characterization snapshots describe what the current engine does for a fixed fixture and seed. Invariant tests protect facts that must remain true after formula changes. Benchmark checks describe distance from the intended output envelope. They must not be conflated:

- Characterization values may intentionally change during calibration and require an explicit baseline update.
- Invariants should fail immediately if accounting or determinism regresses.
- Benchmark checks should be visible in reports and baseline documentation, but initially remain diagnostic.

## Implementation steps

### Step 1: Establish the deterministic baseline fixture

Files:

- packages/sim-v2/tests/gameSimulation.test.ts
- packages/calibration/tests/fixture.ts (new, if sharing the fixture is useful)
- packages/calibration/tests/index.test.ts

Actions:

1. Extract or add one small, deterministic fixture factory used by calibration tests. Keep the existing production fixture contract and explicitly disable injuries for the core distribution baseline so an injury-reconciliation defect does not contaminate ordinary scoring metrics.
2. Define the baseline seed, batch size, and fixture configuration in one test/documented location. Use enough games to expose distribution problems while keeping the unit suite fast; 25 to 100 games is appropriate for the checked-in baseline, with the exact count chosen after measuring test runtime.
3. Add a compact single-seed characterization assertion covering result status, period count, team scores, possessions, shooting totals, key player totals, and reconciliation.
4. Add a batch characterization assertion that compares a compact deterministic summary, not a giant full-result snapshot. Label expected values as current-engine characterization values.

Expected result: the same fixture and seed produce the same characterization summary on every run, and the test clearly distinguishes current behavior from desired benchmark ranges.

### Step 2: Expand the calibration collector

Files:

- packages/calibration/src/index.ts
- packages/calibration/tests/index.test.ts

Actions:

1. Add small typed helpers for percentage/rate calculations and team/player aggregation.
2. Preserve the existing metrics and add the full metric set described above.
3. Make metric counts explicit and test that game-level and team-level counts differ as documented.
4. Ensure failed runs are excluded from completed-run distribution metrics while remaining in failures.
5. Add effectiveConfig to the report using the fixture config.
6. Add an optional benchmark profile argument and produce benchmark checks without changing simulation behavior.
7. Keep serialization deterministic: stable object keys where practical, stable result ordering, and exact seeded output.

Expected result: a batch report is useful for diagnosing pace, scoring, efficiency, shot mix, percentages, rebounds, assists, turnovers, defense, fouls, rotations, concentration, injuries, and accounting.

### Step 3: Add the benchmark profile and report types

Files:

- packages/calibration/src/benchmarkProfiles.ts (new)
- packages/calibration/src/index.ts
- docs/v2/research/basketball-sim-reference-study.md (read-only reference; do not rewrite unless the implementation uncovers a factual conflict)

Actions:

1. Add a modern-balanced-v1 profile with broad ranges for the supported metrics.
2. Base the initial envelope on the existing V2 reference anchors: pace around the high 90s/low 100s, team scoring roughly in the modern NBA range, shooting percentages, three-point attempt share, free-throw rate, turnover rate, rebounds, assists, steals, blocks, and fouls.
3. Keep target ranges in calibration code and documentation, never in GameSimulationConfig.
4. Add a profile identifier and benchmark result to the report so future target revisions are distinguishable.
5. Include the fixture’s effective config and benchmark profile identifier in the baseline document.

Expected result: a standard-preset report can say both “the engine produced X” and “X is inside/outside the current diagnostic envelope,” without changing a user’s sliders.

### Step 4: Update and test the league schema

Files:

- packages/league-schema/src/schema.ts
- packages/league-schema/src/index.ts
- packages/league-schema/tests/leagueSchema.test.ts

Actions:

1. Export/reuse the game simulation config schema.
2. Add schemas for benchmark targets, benchmark checks, and the version-2 batch report.
3. Change the report version literal to 2 for the new shape.
4. Add tests for:
   - a valid version-2 report with effective config and benchmark results;
   - missing required effective config;
   - malformed metric values and invalid target bounds;
   - version-1 rejection or an explicit v1 migration path, depending on repository consumers found in Step 0.
5. Keep the schema strict enough to catch malformed exports, but do not make benchmark failure itself a schema failure.

Expected result: serialized calibration reports are validated at the boundary and future report changes cannot silently drift from the types.

### Step 5: Write the checked-in calibration baseline

File:

- docs/v2/audits/foh-v2-game-calibration-baseline.md (new)

Include:

- commit and date;
- fixture factory and effective config;
- base seed and batch size;
- whether injuries were enabled;
- metric definitions and sample-count conventions;
- current characterization summary;
- full metric table or machine-readable report excerpt;
- benchmark profile and pass/fail results;
- retained failure count and representative failure reasons;
- exact commands used to reproduce the report;
- a clear statement that current values are a baseline, not an acceptance gate.

Also record any known slider sensitivity observations that are visible from the report or dedicated probes, but do not turn those observations into formula changes in this plan.

Expected result: a reviewer can reproduce the baseline and tell whether a later change improved the engine globally, merely shifted one stat, or changed only the reporting layer.

### Step 6: Verify the existing matchup lab contract

Files:

- apps/web-v2/src/routes/developer-labs.game-matchup.tsx
- its existing worker module, only for inspection unless type errors require a separate compatibility patch

Actions:

1. Confirm the UI continues to consume the preserved metric keys.
2. Run the V2 web typecheck and tests.
3. Do not add UI controls or hide any sliders as part of this plan.

Expected result: users retain access to the current slider controls and the lab can display the expanded report without a route rewrite.

## Metric definitions to lock in tests

Use the engine’s existing box-score fields and document the exact aggregation:

- Field-goal percentage = FGM / FGA × 100.
- Three-point percentage = 3PM / 3PA × 100.
- Free-throw percentage = FTM / FTA × 100.
- Three-point attempt rate = 3PA / FGA × 100.
- Free-throw attempt rate = FTA / FGA × 100.
- Turnover rate = turnovers / possessions × 100.
- Offensive efficiency = points / possessions × 100.
- Top-player opportunity share = the highest player opportunity total on a team divided by that team’s possessions.
- Bench points share = non-starter points divided by team points.
- Starter and bench minutes = summed player minutes for the corresponding group.
- Reconciliation pass rate = reconciled completed results divided by completed results.

If a field is unavailable or has a different canonical meaning in the schema, stop and resolve that contract before inventing a proxy. Every metric needs a named unit, numerator, denominator, sample count, and zero-denominator rule.

## Test plan

### Simulation package

Run:

- npm test --workspace=@workspace/sim-v2
- npm run typecheck --workspace=@workspace/sim-v2

The new tests should cover:

- exact seeded determinism;
- stable single-seed characterization;
- exact team/player accounting;
- shot-profile and attempt constraints;
- team totals equal player sums;
- minutes and rotation invariants;
- reconciliation and result status.

### Calibration package

Run:

- npm test --workspace=@workspace/calibration
- npm run typecheck --workspace=@workspace/calibration

The new tests should cover:

- deterministic batch report and serialization;
- every required metric key;
- documented game-level and team-level counts;
- percentage/rate calculations, including zero denominators;
- effective-config capture;
- benchmark pass/fail reporting without throwing;
- invalid fixtures retained as failures;
- cancellation/progress behavior remaining intact.

### Schema package

Run:

- npm test --workspace=@workspace/league-schema
- npm run typecheck --workspace=@workspace/league-schema

### Web contract

Run:

- npm test --workspace=web-v2
- npm run typecheck --workspace=web-v2

If the web package does not have a stable test command in the current checkout, record that fact and rely on its typecheck plus the calibration/schema suites.

### Final repository check

Run git diff --check and confirm the implementation changes are limited to the approved V2 calibration, schema, test, and documentation files. Do not include the pre-existing .codex/config.toml change.

## Done criteria

- The calibration report is version 2, schema-validated, deterministic, and contains the effective config, expanded metrics, benchmark checks, results, and failures.
- Existing metric keys remain available to the matchup lab.
- Characterization tests provide a compact, reproducible fingerprint of current single-game and batch behavior.
- Invariant tests protect accounting and determinism independently of benchmark quality.
- The baseline document records the exact fixture, seed, count, definitions, current output, and benchmark interpretation.
- Benchmark targets are calibration-owned and do not alter user-accessible sliders or simulation config.
- All applicable package tests and typechecks pass.
- No simulation formula or slider behavior changed.

## Stop conditions

Stop and report before expanding scope if any of the following occurs:

- A current consumer requires reading version-1 reports and no safe migration boundary is found.
- A requested metric cannot be derived from the existing result schema without changing simulation semantics.
- Capturing effective config requires changing gameSimulation.ts rather than using the existing fixture/result contract.
- The same seeded fixture produces different characterization output across repeated runs.
- The web route requires a structural rewrite rather than accepting preserved keys plus additive report fields.
- Benchmark ranges cannot be justified from the existing reference material; use a clearly labeled provisional profile and document the uncertainty instead of presenting it as an authoritative target.

## Maintenance notes

- Any future formula change must run the baseline before and after the change and explain characterization deltas.
- Update characterization expectations only when the behavior change is intentional and reviewed.
- Keep benchmark profiles versioned and outside engine/user configuration.
- Add new metrics only with definitions, zero-denominator rules, count semantics, and schema coverage.
- Keep report version changes explicit; do not silently widen a strict export schema.
- The next plan should use this report to run slider sensitivity/monotonicity sweeps and then fix the highest-confidence no-op or miswired controls without removing user access.
