# Plan 005: Calibrate core game distributions and harden independent reconciliation

> **Executor instructions**: Follow this plan after reading it in full. The
> five-player lineup implementation is already present; do not rebuild lineup
> selection as part of this plan. Preserve the possession-based result model,
> deterministic seeds, current user-facing sliders, and V1 behavior. Stop on
> any condition listed under **STOP conditions** instead of inventing a new
> public contract.
>
> **Drift check (run first)**:
> `git diff --stat 6273b69..HEAD -- packages/sim-v2/src packages/sim-v2/tests packages/calibration/src packages/calibration/tests packages/domain-v2/src packages/league-schema/src apps/web-v2/src/lib/gameMatchupLab.ts`
> If any in-scope file changed after this plan was written, compare the
> current-state facts below with the live code before proceeding.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — this changes the statistical behavior of every simulated game
- **Depends on**: [001-game-calibration-baseline.md](001-game-calibration-baseline.md), [002-slider-sensitivity-and-wiring.md](002-slider-sensitivity-and-wiring.md), and the implemented lineup work described in [004-five-player-lineup-possession.md](004-five-player-lineup-possession.md)
- **Category**: bug
- **Planned at**: commit `6273b69`, 2026-07-31

## Why this matters

The latest Game & Matchup Lab export has the correct structural shape, but its
single-game distribution still shows likely engine-level bias: 91 and 84 team
points on 97 and 104 possessions, 7 and 12 assists on 31 and 33 made field
goals, zero blocks for both teams, and only 5 and 10 fouls. Rebounds (48/49)
and offensive rebounds (11/13) look more credible, but second-chance scoring is
not represented as an explicit outcome. These are not slider problems; they
come from how the possession branches create shots, fouls, assists, rebounds,
and points.

The current result reports 42 passing reconciliation checks, which is a strong
baseline. The remaining concern is independence: the hot possession path
increments player and team counters in the same branch, so a mirrored bug could
still make both sides agree. This plan calibrates the event model first and
then makes a compact internal possession ledger the independent source for
reconciliation.

## Current state

- `packages/sim-v2/src/gameSimulation.ts:1377-1689` resolves each possession.
  It selects the current five-player offense/defense lineups, then branches in
  order through turnover, foul/free throws, shot, assist, block, and rebound.
- `packages/sim-v2/src/gameSimulation.ts:1416-1464` uses bounded turnover and
  foul rates. A foul creates two or three free throws immediately, but the
  model does not distinguish shooting and non-shooting fouls.
- `packages/sim-v2/src/gameSimulation.ts:1615-1635` assigns assists with one
  made-shot probability and selects the passer from the current lineup.
- `packages/sim-v2/src/gameSimulation.ts:1637-1685` assigns blocks and then
  either an offensive or defensive rebound. An offensive rebound increments
  rebound totals but does not currently resolve a second-chance continuation
  or second-chance points.
- `packages/sim-v2/src/gameSimulation.ts:1970-2062` reconciles player/team
  totals, shot profiles, period totals, possessions, minutes, restrictions, and
  lineup validity. It does not validate a possession/event ledger because no
  ledger exists yet.
- `packages/calibration/src/index.ts:214-334` collects team-level shooting,
  scoring, possession, assist, turnover, rebounding, defensive, foul, and
  rotation metrics. It does not yet collect second-chance metrics or event
  rates that distinguish shooting fouls, non-shooting fouls, and rebound
  continuations.
- `packages/domain-v2/src/types.ts` and
  `packages/league-schema/src/schema.ts` define the current v2 result and box
  score. Any new persisted stat requires a deliberate result/report version
  decision; do not silently add fields to the existing v2 contract.

Repository conventions to preserve:

- Keep `packages/sim-v2` pure and authoritative; calibration orchestration
  belongs in `packages/calibration`.
- Use deterministic named random forks. Do not consume random values while
  building a plan or while calculating diagnostics.
- Keep accepted benchmark ranges in calibration profiles, not in
  `GameSimulationConfig`.
- Add focused Vitest coverage beside the existing simulation and calibration
  tests. Use `npm test --workspace=...` and `npm run typecheck --workspace=...`
  as the verification gates.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Simulation tests | `npm test --workspace=@workspace/sim-v2` | All simulation tests pass |
| Simulation types | `npm run typecheck --workspace=@workspace/sim-v2` | Exit 0 with no TypeScript errors |
| Calibration tests | `npm test --workspace=@workspace/calibration` | All calibration tests pass |
| Calibration types | `npm run typecheck --workspace=@workspace/calibration` | Exit 0 with no TypeScript errors |
| Schema tests | `npm test --workspace=@workspace/league-schema` | All schema tests pass |
| Web V2 types/tests | `npm run typecheck --workspace=web-v2` and `npm test --workspace=web-v2` | Both exit 0 |

## Scope

### In scope

- Internal possession outcome/ledger representation.
- Scoring, shot selection/make rates, free-throw generation, foul branches,
  assist attribution, blocks, rebounds, and second-chance continuations.
- Calibration metrics and benchmark reporting needed to tune those outcomes.
- Independent reconciliation against the internal ledger.
- Domain/schema changes only if second-chance stats are intentionally persisted
  in `GameResult`.
- Deterministic unit, invariant, calibration, and schema tests.

### Out of scope

- Rebuilding five-player lineup planning or substitution timing.
- Removing, renaming, hiding, or repurposing user-facing sliders.
- Adding play-by-play storage or a live game-watch surface.
- Changing V1 simulation packages.
- Raising or lowering standard sliders merely to make one report look better.
- New player traits, contracts, league lifecycle, production/value logic, or UI
  redesign.

## Design decisions

### 1. Establish a multi-game acceptance baseline before changing formulas

Use the existing deterministic calibration runner and a fixed standard config.
Run enough games to expose distributions—prefer 1,000 games for the review
baseline, with a smaller count in unit tests. Record team-level sample counts and
game-level sample counts separately.

At minimum report:

- points, possessions, offensive efficiency;
- FGM/FGA, 3PM/3PA, FTM/FTA and their rates;
- assist rate as assists divided by made field goals;
- turnover rate, team fouls, shooting fouls, non-shooting fouls;
- total rebounds, offensive rebounds, defensive rebounds;
- blocks and steals;
- second-chance attempts, second-chance points, and second-chance points per
  offensive rebound;
- starter/bench minutes and opportunity concentration.

Do not tune from the one-game JSON alone. The JSON is a diagnostic example,
not a statistically reliable acceptance sample.

### 2. Use a compact internal possession ledger

Add an internal, non-serialized `PossessionOutcome`/ledger entry that records
the terminal possession owner, period, offense/defense teams, current lineup
IDs, primary player, shot attempts, makes, free throws, foul type, assist,
block, rebound, points, and any second-chance continuation. Keep it in
simulation state and discard it after reconciliation; do not expose play-by-play
through `GameResult`.

One team possession must have exactly one terminal outcome. An offensive
rebound may create a bounded continuation within that same possession, but it
must not increment team possessions again. Use a maximum continuation count and
a named random fork so the model cannot loop indefinitely.

### 3. Treat shot, foul, and rebound branches as related event chains

Refactor `simulatePossession` into small internal resolution functions without
changing the public result shape unless explicitly required:

1. Resolve turnover or live-ball foul.
2. Resolve shot type and shot attempt.
3. On a miss, resolve block and exactly one rebound.
4. On an offensive rebound, resolve a second-chance attempt/continuation.
5. On a made field goal, resolve assist attribution.
6. Apply player/team projections from the ledger entry.

Keep the following invariants explicit:

- 3PA is a subset of FGA; 3PM is a subset of 3PA.
- FGM is no greater than FGA; FTM is no greater than FTA.
- Every made field goal can have at most one assist and assists cannot exceed
  made field goals.
- Every missed shot has exactly one rebound outcome; offensive and defensive
  rebounds are mutually exclusive.
- A shooting foul creates the configured free throws; a non-shooting foul does
  not accidentally create free throws.
- Second-chance points come only from a prior offensive rebound and remain
  inside the same team possession.

### 4. Calibrate formulas in dependency order

Tune one family at a time, preserving deterministic seeds and checking the
whole distribution after each family:

1. Possessions and shot volume.
2. Shot mix and field-goal make rates.
3. Fouls and free throws.
4. Assists and turnovers.
5. Blocks and steals.
6. Rebound ownership and second-chance continuations.

Use broad benchmark ranges rather than matching one exact target. A change is
accepted only when it improves the targeted distribution without materially
breaking scoring, pace, rotation minutes, deterministic behavior, or
reconciliation.

### 5. Decide the second-chance public contract explicitly

Prefer adding `secondChancePoints` and `secondChanceAttempts` to team and
player box scores if the Game & Matchup Lab is expected to explain this part of
the engine. If second-chance outcomes remain internal for the first pass, add
them to calibration metrics and diagnostics only, and document that choice.

If persisted `GameResult` fields are added, bump the result and matchup-lab
export versions from `2` to `3`, update the migration path, and update strict
schemas/tests together. Do not add optional fields while leaving the version at
2 without a migration decision.

## Steps

### Step 1: Freeze the current multi-game baseline

Files:

- `packages/calibration/src/index.ts`
- `packages/calibration/src/benchmarkProfiles.ts`
- `packages/calibration/tests/index.test.ts`
- `docs/v2/audits/foh-v2-game-calibration-baseline.md` (new or updated)

Actions:

1. Add or update a deterministic standard-preset batch baseline with explicit
   seed and sample size.
2. Add the event-rate metrics listed above, preserving existing metric keys.
3. Record current benchmark misses as diagnostics, not test failures.
4. Confirm the latest single-game result can be explained by the same metrics.

**Verify**: calibration tests pass, the report serializes deterministically,
and the baseline records sample counts for every metric.

### Step 2: Add the internal ledger and projection boundary

Files:

- `packages/sim-v2/src/gameSimulation.ts` or a new internal module under
  `packages/sim-v2/src/`
- `packages/sim-v2/tests/gameSimulation.test.ts`

Actions:

1. Define the internal outcome types and ledger state.
2. Route possession branches through the ledger instead of incrementing team
   and player totals ad hoc in the same branch.
3. Keep lineup IDs/players attached to each entry for causal validation.
4. Add a test-only inspection/helper path if needed; do not serialize the
   ledger in `GameResult`.

**Verify**: seeded results remain deterministic, all existing game tests pass,
and a crafted possession fixture proves that the ledger projection and final
box score agree.

### Step 3: Rework scoring, shooting, fouls, and free throws

Files:

- `packages/sim-v2/src/gameSimulation.ts`
- `packages/sim-v2/tests/gameSimulation.test.ts`

Actions:

1. Separate shot-type selection from make probability, preserving lineup
   spacing, player skill, defender fit, fatigue, coaching, and slider inputs as
   bounded modifiers.
2. Replace arbitrary overlapping make-rate bonuses with named terms whose
   contribution can be measured in calibration output.
3. Split shooting and non-shooting fouls. Ensure free throws, fouls, points,
   and possession termination follow the selected foul type.
4. Add deterministic tests for shot-profile direction, foul-to-free-throw
   accounting, and no free throws on non-shooting fouls.

**Verify**: the 1,000-game standard batch moves scoring, FG%, FT rate, and foul
rate toward the benchmark without creating invalid attempt/make totals.

### Step 4: Rework assists, blocks, rebounds, and second chances

Files:

- `packages/sim-v2/src/gameSimulation.ts`
- `packages/domain-v2/src/types.ts` if persisted stats are approved
- `packages/league-schema/src/schema.ts` if persisted stats are approved
- `packages/sim-v2/tests/gameSimulation.test.ts`
- `packages/league-schema/tests/leagueSchema.test.ts` if schemas change

Actions:

1. Calibrate assist attribution against made field goals, lineup passing, ball
   movement, and isolation; keep the passer on the current offense lineup and
   never credit the shooter.
2. Make block probability depend on shot location, defender rim protection,
   vertical, wingspan, help defense, and fatigue without making blocks vanish
   in standard games.
3. Select rebounds from the current five-player lineup using rebounding,
   strength, size, positioning, and fatigue.
4. Add bounded offensive-rebound continuations and second-chance metrics. A
   continuation must reuse the same team possession count.
5. Add tests for assist ceilings, block visibility, mutually exclusive rebound
   outcomes, and second-chance possession accounting.

**Verify**: batch metrics show directional changes in assist rate, block rate,
offensive-rebound rate, and second-chance scoring while total possessions and
reconciliation remain stable.

### Step 5: Make reconciliation ledger-backed and comprehensive

Files:

- `packages/sim-v2/src/gameSimulation.ts` or the new ledger module
- `packages/sim-v2/tests/gameSimulation.test.ts`
- `packages/calibration/tests/index.test.ts`

Actions:

1. Recompute expected player and team totals from the internal ledger rather
   than trusting the same mutable counters that produced the output.
2. Add checks for terminal outcome count, possession ownership, shot/make/FT
   subsets, foul-to-FT relationships, assist ceilings, block/miss
   relationships, rebound exclusivity, second-chance lineage, period totals,
   lineup coverage, minutes, availability, and player/team aggregation.
3. Add a deliberate test mutation that corrupts one final counter and confirms
   reconciliation fails with a precise check code.
4. Keep reconciliation results diagnostic and machine-readable; do not throw
   from the normal completed-game path.

**Verify**: normal games pass all ledger checks; the corruption test fails the
intended check; invalid/incomplete results remain rejected or failed with a
useful diagnostic.

### Step 6: Calibrate and accept the result as a batch, not a single game

Files:

- `packages/calibration/src/index.ts`
- `packages/calibration/src/benchmarkProfiles.ts`
- `packages/calibration/tests/index.test.ts`
- `docs/v2/audits/foh-v2-game-calibration-baseline.md`

Actions:

1. Run the standard preset at the agreed batch size using fixed seeds.
2. Compare the full output profile, not only total points.
3. Update formula coefficients only when the targeted metric and adjacent
   invariants improve together.
4. Record remaining misses explicitly and stop if the benchmark requires a
   product decision rather than a formula adjustment.

**Verify**: the final baseline is reproducible, all package tests/typechecks
pass, and the report identifies each metric’s count, mean, p10, median, p90,
and benchmark status.

## Test plan

Use the existing `packages/sim-v2/tests/gameSimulation.test.ts` as the
simulation-test pattern and `packages/calibration/tests/index.test.ts` as the
batch-report pattern.

Required coverage:

- same seed produces the same full result and ledger-derived summary;
- shot profile, makes, attempts, free throws, fouls, assists, blocks, and
  rebounds obey all subset relationships;
- non-shooting fouls do not create free throws;
- second-chance points derive from offensive-rebound continuations and do not
  add a second team possession;
- only current-lineup players receive possession-linked stats;
- deliberate final-counter corruption fails independent reconciliation;
- calibration reports preserve deterministic ordering and safe zero-denominator
  metrics;
- if the public box score changes, strict schema and v2-to-v3 migration tests
  cover both old and new reports.

## Done criteria

- [ ] A fixed 1,000-game standard batch (or an explicitly documented smaller
  review batch) reports all core distribution metrics with sample counts.
- [ ] Scoring, shooting, FT/foul, assist, block, rebound, and second-chance
  formulas are engine-level and retain slider sensitivity without relying on
  slider-only retuning.
- [ ] Every possession has one terminal ledger outcome; continuations do not
  inflate team possessions.
- [ ] Reconciliation is ledger-backed, comprehensive, and catches deliberate
  output corruption.
- [ ] `npm test --workspace=@workspace/sim-v2` passes.
- [ ] `npm run typecheck --workspace=@workspace/sim-v2` passes.
- [ ] `npm test --workspace=@workspace/calibration` passes.
- [ ] `npm run typecheck --workspace=@workspace/calibration` passes.
- [ ] `npm test --workspace=@workspace/league-schema` passes.
- [ ] `npm run typecheck --workspace=web-v2` and `npm test --workspace=web-v2` pass.
- [ ] No V1 package or surface is modified.
- [ ] Any persisted stat change has an explicit result/report version and
  migration update.

## STOP conditions

Stop and report instead of improvising if:

- the current lineup implementation or result version differs materially from
  the state described above;
- the benchmark profile does not define an accepted target for a proposed
  metric;
- adding second-chance stats requires a UI or production/value contract change
  outside the scope above;
- the ledger cannot distinguish terminal possession outcomes from continuations
  without storing public play-by-play;
- a formula change improves one distribution only by materially degrading
  scoring, pace, minutes, determinism, or reconciliation;
- any verification command fails twice after a focused fix attempt;
- a change appears to require touching V1 files.

## Maintenance notes

- Keep internal ledger types private to `sim-v2`; future UI work should consume
  aggregate result fields or calibration metrics, not recreate ledger logic.
- Review random-fork naming and continuation bounds carefully; random-stream
  drift changes characterization results even when averages improve.
- Re-run the standard batch after changes to lineup timing, fatigue, injuries,
  or coaching because each affects the distributions in this plan.
- If second-chance points are persisted, update the report migration and all
  downstream production aggregators before accepting the new result version.
