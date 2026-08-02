# Plan 002: Prove slider causality and repair high-confidence no-op controls

## Metadata

- Priority: P0 calibration follow-up
- Effort: Medium
- Risk: Medium
- Area: V2 simulation, calibration, shared config access, tests, schema, documentation
- Planned against commit: 98d59a5
- Date: 2026-07-31
- Depends on: Plan 001, implemented in the planned-against commit

## Objective

Build a deterministic sensitivity and monotonicity report for every numeric
setting exposed by the V2 game matchup lab, then repair only the controls whose
current behavior is proven to be missing, masked, or mathematically canceled.

The result should answer, for each slider:

1. Does changing the value change the simulation?
2. Does it change the intended basketball behavior?
3. Is the effect visible in the default fixture, only in a meaningful matched
   fixture, or not yet safe to implement without a larger engine model?

Users must retain access to the same semantic sliders. This plan does not
replace them with raw coefficients, hide weak controls, or make the UI a
developer-only surface.

## Current state

### The settings contract exists and is user-visible

packages/sim-v2/src/gameConfig.ts:71-304 defines the numeric
GAME_SETTING_DESCRIPTORS, including 29 paths across environment, offense,
defense, rotation, coaching, and injury settings. The descriptors provide
labels, descriptions, min/max bounds, and steps.

apps/web-v2/src/routes/developer-labs.game-matchup.tsx:54-75 currently reads and
writes settings by splitting a string path and casting the config to a nested
record. The same route renders every descriptor in its section at lines
139-160, marks the config custom, and keeps the controls accessible.

The controls should remain descriptor-driven. The path handling should become a
small typed helper shared by the UI and calibration harness so a sensitivity
test cannot accidentally mutate a different config shape than the user-facing
slider.

### The engine reads only part of the exposed contract

packages/sim-v2/src/gameSimulation.ts currently reads the following relevant
groups:

- Rotation starter workload, bench usage, and fatigue impact at lines 441-444
  and 549-559.
- Offense three-point, rim, and mid-range rates at lines 603-627; star usage,
  ball movement, isolation, and offensive rebounding elsewhere in the
  possession loop.
- Defense pressure, help defense, turnover pressure, and foul discipline at
  lines 753-816 and 873-888.
- Pace, game variance, coach pace influence, and home-court advantage in
  period creation at lines 935-950.
- Injury maximum duration at lines 695-701.

Static inspection shows no read of
offense.shotSelectionDiscipline, offense.transitionRate, defense.switching,
defense.doubleTeamRate, rotation.adherence, coaching.shotSelectionInfluence,
or coaching.defensiveInfluence in the simulation path.

coaching.influence is read at gameSimulation.ts:556-557 as a common multiplier
for every player on one team. Because weightedChoice at lines 363-376
normalizes weights, a common multiplier cancels and has no observable effect on
the choice distribution.

coaching.paceInfluence is wired, but the default matchup-lab fixture creates
every coach with pace, offensive style, defensive pressure, shot selection, and
rotation depth set to 50 at apps/web-v2/src/lib/gameMatchupLab.ts:87-95. A
neutral fixture correctly hides the effect of a coach influence slider; it
cannot be used as the only sensitivity fixture.

environment.homeCourtAdvantage currently contributes to home-team pace only at
gameSimulation.ts:935-943, while its descriptor promises both an efficiency
and pace edge. That is a contract mismatch to verify and either repair or
explicitly defer.

### The calibration report is ready for an additive sensitivity report

packages/calibration/src/index.ts:63-75 already produces a deterministic
version-2 matchup report with the effective config, metrics, completed results,
and retained failures. It does not currently compare multiple configs or
classify slider behavior.

packages/calibration/tests/index.test.ts:16-87 provides a useful small fixture:
eight players per team, five starters, three bench players, injuries disabled,
and neutral coaching profiles. It should remain the core baseline fixture, with
additional asymmetric, non-neutral-coach, and injury-enabled fixtures added for
settings whose semantics require them.

The V2 implementation plan requires coaching modifiers and bench/role changes
to be directionally correct, while keeping accepted ranges separate from the
user config. This plan operationalizes that requirement without changing the
existing matchup batch report contract.

## Scope

### In scope

- Add a typed numeric-setting path and clone/update helper shared by the UI and
  calibration code.
- Add a calibration-owned slider sensitivity harness with deterministic paired
  seeds, five-point sweeps, expected directions, and classifications.
- Test every numeric descriptor, including controls that are conditional on
  coach profiles or injury events.
- Add matched fixtures for asymmetric talent, non-neutral coaching, manual
  rotation targets, and enabled injuries.
- Repair high-confidence missing or canceled behavior in the simulation:
  shot-selection discipline, transition behavior, rotation adherence, overall
  coaching influence, coach shot-selection influence, coach defensive
  influence, double-team pressure, and the home-court descriptor mismatch when
  the sweep confirms it.
- Add focused simulation and calibration tests for directional behavior,
  determinism, accounting, and reconciliation.
- Add a separate version-1 slider-sensitivity report schema and serializer
  rather than changing the existing version-2 matchup batch report shape.
- Check in a reproducible sensitivity baseline and a classification table.
- Preserve the current user-facing controls, preset/custom behavior, and
  effective-config reporting.

### Out of scope

- Recalibrating the whole scoring, field-goal, rebound, or pace distribution
  against the benchmark profile.
- Rewriting the possession engine, adding a full defender-assignment system, or
  redesigning rotation substitution events.
- Exposing raw random draws, formula coefficients, or internal tuning constants
  as gameplay settings.
- Removing, renaming, hiding, or silently changing the range of an existing
  user-facing slider.
- Adding a new gameplay stat solely to make a slider appear sensitive.
- Changing V1 packages, league persistence, or the authoritative league shell.
- Adding a new runtime dependency just for report generation.
- Adding a sensitivity panel to the matchup-lab UI. The existing controls must
  keep working; displaying the diagnostic report in the UI is a later,
  separately scoped lab feature.

## Design decisions

### 1. Keep one semantic settings source

Make GAME_SETTING_DESCRIPTORS the source for numeric setting paths, labels, and
bounds. Export a typed path union or equivalent canonical descriptor type from
packages/sim-v2.

Add small helpers with explicit behavior:

- Read a numeric value by a validated descriptor path.
- Clone a GameSimulationConfig and set one numeric value.
- Clamp or reject values using the descriptor min/max/step contract.
- Set presetId to custom after a user or sweep mutation.

Use those helpers from
apps/web-v2/src/routes/developer-labs.game-matchup.tsx and the calibration
harness. Do not leave a second unsafe string-path mutation implementation in
the route.

### 2. Use paired five-point sweeps

For each descriptor, run the same fixture factory and seed list at:

- the descriptor minimum;
- the 25th-percentile value between min and max;
- the effective baseline value;
- the 75th-percentile value between min and max;
- the descriptor maximum.

For each arm, first snap the quartile or baseline candidate to the descriptor
step, then clamp it to the descriptor bounds, then deduplicate equal effective
values while retaining the surviving arm label. Every arm must record that
snapped-and-clamped value in the effective config passed to the engine. Keep
the five-arm structure whenever all five effective values are distinct; when
values collide, retain the labels for the arms that remain under the UI
contract.

Use the same seeds in every arm. The harness should report both aggregate
metric deltas and the number of paired games whose compact result fingerprint
changed. Same-seed pairing improves diagnosis; it does not imply that the
random stream remains aligned after a config change adds or removes an event.

Use 50 games per arm for the checked-in sensitivity baseline. Use a smaller
count in unit tests when testing report structure and determinism, then use
targeted 20- to 50-game runs for directional assertions. The count must always
be explicit in the report.

### 3. Distinguish no-op, conditional, saturation, and noise

The report must not label a control as broken merely because a neutral fixture
or a noisy small sample hides its effect.

Classify each result as one of:

- wired: the primary signal changes in the expected direction across the
  endpoint arms and the sweep is not explained by a clamp;
- no-op: all paired result fingerprints and selected metric values are equal
  across the tested arms;
- conditional: the control changes an appropriate matched fixture but is
  neutral in the default fixture, such as coach pace influence with all coach
  values at 50 or maximum games out with injuries disabled;
- saturated: the control changes an input but the selected output is already
  bounded at a clamp or invariant, so a formula change is not yet justified;
- unknown: output changes, but the expected direction is not stable enough to
  distinguish engine behavior from sample noise or an unclear product
  contract.

The report should include exact endpoint deltas, the five arm means, p10/p90
values, paired changed-game count, and a short reason for the classification.
Each arm must also record requested-game count, completed-game count, and
retained failure count. Define paired seeds as the intersection of successful
seeds common to every compared arm, retain that seed set (or equivalent
per-seed data), and calculate changed-game counts and endpoint comparisons from
that set so failures and cancellation cannot create false pairings.

Before generating a baseline, define a versioned registry of metric-specific
diagnostic floors. Each entry owns an explicit numeric value and owner (the
initial registry is calibration-owned); maintenance requires updating the
registry version and its documentation when a metric or floor changes. Use
this deterministic classification precedence: conditional when a wired result
is present only in a required matched scenario while the default scenario is
no-op; otherwise wired when the directional floor and adjacent-arm rule pass;
otherwise saturated when the metric is unchanged because an input/output
bound is active; otherwise no-op when all compared outputs and fingerprints are
equal; otherwise unknown. This order resolves overlaps consistently. These
report-only thresholds remain separate from GameSimulationConfig.

For declared directional metrics, use the endpoint sign plus the five-arm
sequence as evidence. A directional pass requires the endpoint delta to exceed
the metric's documented diagnostic floor and at least three of the four
adjacent arm comparisons to move in the expected direction. If a metric is
intrinsically a spread or distance measure, the expectation must say so
explicitly instead of forcing an increase/decrease interpretation.

### 4. Keep sensitivity data separate from benchmark targets

Add packages/calibration/src/sensitivity.ts with a focused report type. The
report should contain:

- schema identifier foh-slider-sensitivity and version 1;
- base seed, arm count, paired seed count, and fixture/scenario identifier;
- baseline effective config;
- one result per numeric descriptor;
- arm values and effective configs;
- requested, completed, and retained-failure counts per arm;
- selected metric summaries and endpoint deltas;
- expected direction and primary metric;
- successful paired seed intersection and paired changed-game count;
- classification and diagnostic note.

Do not add sensitivity results to MatchupBatchReport or bump its version. The
existing worker and UI can continue consuming the current report unchanged.
Add a separate serializer and league-schema contract for the diagnostic report
so exported sensitivity artifacts are still machine-readable and strict.

### 5. Fix semantics before coefficients

All new modifiers must be bounded around a neutral value of 50 and use existing
clamp/reconciliation patterns. The implementation must define what each
repaired setting means in terms of existing events and box-score fields before
choosing coefficients.

Do not fix a dead slider with a common multiplier applied to every choice
weight. That pattern is specifically what cancels coaching.influence today.

## Sensitivity specification

Add a calibration-owned expectation registry. Each descriptor must have a
primary signal, fixture requirement, and direction type. Use the following
initial contract; revise only when the first report reveals a genuine
measurement ambiguity.

| Setting                         | Primary signal                                           | Fixture/scenario                         | Expected behavior                                                                    |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| environment.pace                | teamPossessions                                          | Standard, injuries off                   | Higher values increase possessions.                                                  |
| environment.scoringEnvironment  | teamPoints and offensiveEfficiency                       | Standard, injuries off                   | Higher values increase scoring output.                                               |
| environment.gameVariance        | total-score or possession p90-p10 spread                 | Standard, injuries off                   | Higher values increase outcome spread, not necessarily the mean.                     |
| environment.talentSeparation    | strong-team advantage spread                             | Asymmetric talent fixture                | Higher values make skill differences more visible.                                   |
| environment.homeCourtAdvantage  | home-minus-away score/efficiency delta                   | Matched teams, alternating home identity | Higher values increase the home edge.                                                |
| offense.threePointRate          | threePointAttemptRate                                    | Standard, injuries off                   | Higher values increase three-point share.                                            |
| offense.rimRate                 | rimAttemptRate                                           | Standard, injuries off                   | Higher values increase rim share.                                                    |
| offense.midrangeRate            | midrangeAttemptRate                                      | Standard, injuries off                   | Higher values increase mid-range share.                                              |
| offense.shotSelectionDiscipline | fieldGoalPercentage plus shot-quality mix                | Standard and varied-skill fixture        | Higher values favor the player's more efficient supported attempts.                  |
| offense.starUsage               | topPlayerOpportunityShare                                | Standard, injuries off                   | Higher values concentrate creation around the best players.                          |
| offense.ballMovement            | assists per team                                         | Standard, injuries off                   | Higher values increase assisted scoring opportunities.                               |
| offense.isolationRate           | assists per team                                         | Standard, injuries off                   | Higher values reduce assisted scoring opportunities.                                 |
| offense.transitionRate          | transition proxy: early-offense shot mix and possessions | Standard, injuries off                   | Higher values increase the defined early-offense proxy without double-counting pace. |
| offense.offensiveRebounding     | offensiveRebounds                                        | Standard, injuries off                   | Higher values increase second-chance rebounds.                                       |
| defense.pressure                | turnovers, fouls, and field-goal percentage              | Standard, injuries off                   | Higher pressure forces more mistakes but carries the existing foul tradeoff.         |
| defense.helpDefense             | blocks and opponent field-goal percentage                | Standard, injuries off                   | Higher values improve contests and blocks within bounds.                             |
| defense.turnoverPressure        | turnovers                                                | Standard, injuries off                   | Higher values force more turnovers.                                                  |
| defense.switching               | mismatch/contest signal                                  | Mismatched role fixture                  | Classify conditionally until a matchup assignment contract exists.                   |
| defense.doubleTeamRate          | creator turnovers and creator shot share                 | Star-versus-support fixture              | Higher values create more pressure on primary creators.                              |
| defense.foulDiscipline          | defensive fouls                                          | Standard, injuries off                   | Higher values reduce defensive fouls.                                                |
| rotation.adherence              | distance from configured target minutes                  | Manual target-minute fixture             | Higher values keep final minutes closer to the configured targets.                   |
| rotation.benchUsage             | bench opportunity and bench points share                 | Standard, injuries off                   | Higher values increase bench opportunity.                                            |
| rotation.starterWorkload        | starter minutes and opportunities                        | Standard, injuries off                   | Higher values favor starters.                                                        |
| rotation.fatigueImpact          | late-period efficiency delta                             | Standard, injuries off                   | Higher values increase the late-stint penalty.                                       |
| coaching.influence              | difference between matched coach profiles                | Non-neutral coach fixture                | Higher values amplify profile differences around neutral 50.                         |
| coaching.paceInfluence          | possessions by coach pace                                | Non-neutral coach fixture                | Higher values amplify coach pace differences.                                        |
| coaching.shotSelectionInfluence | shot mix by coach shot-selection profile                 | Non-neutral coach fixture                | Higher values amplify coach shot-profile differences.                                |
| coaching.defensiveInfluence     | turnovers/field-goal percentage by coach defense profile | Non-neutral coach fixture                | Higher values amplify coach defensive differences.                                   |
| injuries.maxGamesOut            | generated injury duration                                | Injuries enabled and enough bench depth  | Higher values increase the upper duration bound, not injury frequency.               |

The registry must make exceptions visible. A conditional control is not a
failed slider, and a control whose product meaning cannot be measured from the
current result contract must be marked unknown rather than assigned an invented
proxy.

## Implementation steps

### Step 0: Reconfirm contracts before editing engine code

Files to inspect:

- packages/sim-v2/src/gameConfig.ts
- packages/sim-v2/src/gameSimulation.ts
- packages/calibration/src/index.ts
- packages/calibration/tests/index.test.ts
- packages/league-schema/src/schema.ts
- apps/web-v2/src/routes/developer-labs.game-matchup.tsx

Actions:

1. Confirm the descriptor count, path names, bounds, and current report version
   against the planned-against commit.
2. Confirm the standard calibration fixture and add named scenario factories
   rather than mutating one fixture in place.
3. Confirm that the result contract contains enough box-score and period data
   for the primary signals in the registry.
4. If a required signal is unavailable, stop and resolve the contract before
   adding a proxy metric.

Expected result: the sensitivity report tests the same settings users edit and
the same result fields the engine treats as authoritative.

### Step 1: Add the shared typed setting helper

Files:

- packages/sim-v2/src/gameConfig.ts
- packages/sim-v2/src/index.ts
- apps/web-v2/src/routes/developer-labs.game-matchup.tsx

Actions:

1. Make the descriptor paths a type-safe canonical union, or export an
   equivalent type tied to the descriptor source.
2. Add a read helper and a clone/update helper that validate the path and
   preserve all unrelated config sections.
3. Clamp values at the shared boundary using descriptor metadata and set
   presetId to custom after a change.
4. Replace the route's string-split record casts with the shared helper.
5. Keep the current labels, sections, min/max/step values, reset behavior, and
   custom preset behavior unchanged.

Expected result: the lab and sensitivity harness cannot silently diverge in
how a numeric path is interpreted, and every existing slider remains
accessible.

### Step 2: Implement the calibration sensitivity harness

Files:

- packages/calibration/src/sensitivity.ts (new)
- packages/calibration/src/index.ts
- packages/calibration/tests/sensitivity.test.ts (new)
- packages/calibration/tests/fixtures.ts (new, if the current fixture should be
  shared)

Actions:

1. Define typed sensitivity options for base seed, count, fixture scenario,
   selected paths, and optional expected-profile overrides.
2. Generate the five arms for each descriptor using the shared config helper.
3. Run the same seeds for every arm and retain effective configs, results,
   failures, selected metrics, and compact paired fingerprints.
4. Calculate arm summaries, endpoint deltas, direction evidence, and
   classifications.
5. Implement stable serialization with sorted descriptor and metric keys.
6. Ensure cancellation/failure handling cannot produce a report that claims
   more paired games than actually completed.
7. Add scenario factories for:
   - the current standard fixture with injuries off and neutral coaches;
   - asymmetric talent for talent separation and star usage;
   - non-neutral coach profiles for all coaching controls;
   - manual target-minute differences for rotation adherence;
   - enabled injuries with more than five available players for maximum
     games-out.
8. Keep the core MatchupBatchReport unchanged and expose the new report through
   the calibration package index.

Expected result: one deterministic report classifies all 29 numeric settings
and explains whether a no-op is engine wiring, fixture neutralization,
saturation, or unresolved product semantics.

### Step 3: Add the separate sensitivity schema

Files:

- packages/league-schema/src/schema.ts
- packages/league-schema/src/index.ts
- packages/league-schema/tests/leagueSchema.test.ts
- packages/calibration/src/sensitivity.ts

Actions:

1. Define a strict version-1 schema for foh-slider-sensitivity.
2. Validate path, arm values, effective configs, metric summaries, direction,
   classification, paired counts, and diagnostic notes.
3. Reuse the existing GameSimulationConfig schema instead of duplicating
   config fields.
4. Validate that paired counts cannot exceed the requested count and that
   metric ranges are finite.
5. Add valid, malformed, and unknown-classification cases.
6. Do not change the existing foh-matchup-calibration version-2 schema.

Expected result: a sensitivity artifact can be exported and checked at the
schema boundary without creating a report-version migration for the existing
matchup lab.

### Step 4: Repair high-confidence engine wiring

Files:

- packages/sim-v2/src/gameSimulation.ts
- packages/sim-v2/src/gameConfig.ts if a small private helper belongs there
- packages/sim-v2/tests/gameSimulation.test.ts

Apply only after Step 2 reproduces the no-op or contract mismatch. Keep each
change small enough that its sensitivity result identifies the affected
metric.

#### 4a. Rotation adherence

In buildRotationPlan, blend the configured target minutes with a clearly
defined neutral/default rotation according to rotation.adherence before
normalization. At 100, the configured target remains authoritative; at 0,
the engine follows the neutral depth-based allocation. Continue applying
availability and minutes restrictions, and preserve the 240 team-minute
invariant.

Do not implement adherence as a common multiplier. The test signal is distance
from the requested target, not raw starter minutes.

#### 4b. Coaching influence and profile-specific influence

Derive an effective coaching profile around neutral 50:

- coaching.influence controls how far raw coach fields move from neutral;
- coaching.paceInfluence gates the effective pace delta;
- coaching.shotSelectionInfluence gates the effective shot-selection delta;
- coaching.defensiveInfluence gates the effective defensive delta.

Use the effective profile in the existing pace, shot-selection, turnover,
foul, and make-quality paths. Do not multiply every player-choice weight by
the same coach value. The matched-coach tests must show zero or near-zero
profile difference when overall influence is zero and an amplified difference
when it is high.

Use the coach profile field that matches the setting name. In particular,
coach shot-selection behavior should flow through the shotSelection field
rather than treating offensiveStyle as a substitute without documenting the
contract.

#### 4c. Shot-selection discipline and transition rate

Add bounded behavior to attempt selection:

- shotSelectionDiscipline should tilt a player's selected attempts toward the
  more efficient shot types supported by that player's skills as discipline
  rises, while lower discipline permits a flatter, less efficient mix;
- transitionRate should create a named early-offense decision or equivalent
  shot-profile modifier that is observable in the sensitivity report;
- do not let transitionRate silently become a second uncapped pace slider;
- coach shot-selection influence should gate the coach contribution to the
  same attempt-selection path.

Keep the attempt types and accounting unchanged. Add focused tests for shot
profile, field-goal efficiency, and coach-profile differences.

#### 4d. Double-team pressure

Add a deterministic, bounded double-team decision in the possession path for
primary creators. When active, the existing turnover and shot-selection paths
should reflect the extra pressure, using existing turnover, opportunity,
assist, and shot fields rather than inventing a double-team stat.

The minimum acceptance behavior is that a high double-team rate changes
creator-level turnover or shot-share output in the matched star fixture while
all team/player totals still reconcile.

#### 4e. Home-court descriptor contract

If the sweep confirms that environment.homeCourtAdvantage changes pace but not
efficiency, add a small bounded home-team efficiency contribution to the
existing make-quality path. Test the home-minus-away effect with otherwise
matched teams and ensure the away team does not receive the same bonus.

If the desired home-court contract cannot be expressed without broad scoring
recalibration, leave the engine unchanged, classify the control as a contract
gap, and document a follow-up instead of adding an arbitrary multiplier.

#### 4f. Switching

Do not add a placeholder multiplier solely to make defense.switching
sensitive. First determine whether the current engine has enough matchup or
defender-assignment state to express switching meaningfully.

If a small, inspectable matchup adjustment can be added without a possession
or event-schema rewrite, implement it and test it with a deliberately
mismatched fixture. Otherwise classify switching as conditional/unknown and
create a separate follow-up plan for defender assignments. The slider remains
visible and editable in either case.

#### 4g. Conditional controls

Do not change already-wired controls solely because their default fixture is
neutral or disabled:

- coach pace influence needs non-neutral coach pace values;
- maximum games out needs enabled injuries and an injury event;
- talent separation needs asymmetric player ability;
- rotation adherence needs non-default manual target minutes.

Only change their formulas if the appropriate scenario still fails to produce
the declared signal.

### Step 5: Add focused behavioral tests

Files:

- packages/sim-v2/tests/gameSimulation.test.ts
- packages/calibration/tests/sensitivity.test.ts
- packages/league-schema/tests/leagueSchema.test.ts

Simulation tests must cover:

- exact same-seed determinism after adding modifiers;
- unchanged team/player reconciliation and legal minutes;
- adherence moving minutes toward manual targets;
- high discipline changing the intended shot-quality signal;
- transition changing the named early-offense proxy without unbounded pace
  drift;
- high double-team pressure changing creator-level output;
- matched coach influence, shot-selection influence, and defensive influence;
- home-court direction if that fix is accepted;
- switching either having a tested matchup contract or being explicitly
  classified as deferred.

Calibration tests must cover:

- deterministic equality of two reports with the same seed and fixtures;
- every descriptor appearing exactly once;
- five-arm values and effective configs;
- paired counts and failure retention;
- exact no-op detection on a deliberately neutral/disabled scenario;
- conditional classification for neutral coaches and disabled injuries;
- directional classification on representative wired controls;
- stable sensitivity serialization.

Schema tests must cover:

- valid sensitivity reports;
- invalid setting paths and classifications;
- malformed metric bounds;
- inconsistent paired counts;
- effective-config validation.

### Step 6: Record the baseline and handoff

File:

- docs/v2/audits/foh-v2-slider-sensitivity-baseline.md (new)

Record:

- commit and date;
- sensitivity report version;
- scenario definitions;
- base seed and count per arm;
- effective baseline config;
- the complete 29-setting classification table;
- primary signal and expected direction for every setting;
- exact no-op and conditional findings;
- engine fixes applied in this plan;
- retained failed seeds and representative diagnostics;
- reproduction commands;
- a clear separation between current-engine evidence and future benchmark
  targets.

The document should make it possible to compare a later engine change against
the same arms without relying on memory or a single JSON run.

## Files expected to change

Production and shared contracts:

- packages/sim-v2/src/gameConfig.ts
- packages/sim-v2/src/index.ts
- packages/sim-v2/src/gameSimulation.ts
- apps/web-v2/src/routes/developer-labs.game-matchup.tsx, only for typed
  helper adoption; no UI redesign

Calibration and schema:

- packages/calibration/src/sensitivity.ts
- packages/calibration/src/index.ts
- packages/calibration/tests/sensitivity.test.ts
- packages/calibration/tests/fixtures.ts, if needed
- packages/league-schema/src/schema.ts
- packages/league-schema/src/index.ts
- packages/league-schema/tests/leagueSchema.test.ts

Simulation tests and documentation:

- packages/sim-v2/tests/gameSimulation.test.ts
- docs/v2/audits/foh-v2-slider-sensitivity-baseline.md

Do not modify V1 packages or the existing matchup batch report version unless
the implementation discovers a concrete consumer that requires it and the
scope is explicitly revisited.

## Verification plan

Run these commands serially from the repository root:

- npm test --workspace=@workspace/sim-v2
- npm run typecheck --workspace=@workspace/sim-v2
- npm test --workspace=@workspace/calibration
- npm run typecheck --workspace=@workspace/calibration
- npm test --workspace=@workspace/league-schema
- npm run typecheck --workspace=@workspace/league-schema
- npm test --workspace=web-v2
- npm run typecheck --workspace=web-v2
- npm run lint --workspace=web-v2
- node node_modules/prettier/bin/prettier.cjs --check packages/sim-v2/src/gameConfig.ts packages/sim-v2/src/gameSimulation.ts packages/sim-v2/src/index.ts packages/sim-v2/tests/gameSimulation.test.ts packages/calibration/src/sensitivity.ts packages/calibration/src/index.ts packages/calibration/tests/sensitivity.test.ts packages/league-schema/src/schema.ts packages/league-schema/src/index.ts packages/league-schema/tests/leagueSchema.test.ts apps/web-v2/src/routes/developer-labs.game-matchup.tsx
- git diff --check

Also verify manually that:

- every existing slider still renders with its original label and bounds;
- changing one slider marks the preset custom and leaves unrelated settings
  unchanged;
- a sensitivity report includes effective configs and paired seed counts;
- no sensitivity report contains raw random draws or private coefficients;
- the existing matchup-lab batch report still renders its current metric keys.

## Done criteria

- A version-1 sensitivity report deterministically classifies all 29 numeric
  descriptors.
- The report distinguishes wired, no-op, conditional, saturated, and unknown
  behavior with paired evidence and effective configs.
- High-confidence dead controls identified by the sweep no longer remain exact
  no-ops after the targeted fixes, or are explicitly deferred with a reason
  that requires a larger model.
- Coaching influence is no longer implemented as a common canceled weight.
- Rotation adherence has a measurable target-minute contract.
- User-facing slider paths, labels, bounds, preset behavior, and access remain
  intact.
- Existing matchup batch report consumers require no version bump.
- Determinism, reconciliation, minutes, availability, and existing report
  tests remain green.
- The checked-in sensitivity baseline documents all settings, fixtures, seeds,
  counts, classifications, and reproduction commands.
- No V1 files, raw coefficients, or broad benchmark-calibration changes are
  included.

## Stop conditions

Stop and report before widening the implementation if any of the following
occurs:

- The descriptor paths or report contracts differ materially from the
  planned-against commit.
- A required sensitivity signal cannot be derived from existing result fields
  without inventing a new gameplay stat.
- A setting's intended direction cannot be agreed from its current label and
  documentation; classify it unknown and preserve the current behavior.
- Switching requires a full defender-assignment model or an event-schema
  rewrite; defer it rather than adding a meaningless multiplier.
- Rotation adherence requires rewriting substitution events rather than
  adjusting the existing normalized target plan.
- A modifier causes accounting, minutes, availability, deterministic seed, or
  failure-retention regressions.
- A fix changes broad benchmark output outside the selected signal enough to
  become a general scoring calibration; split that work into the next plan.
- A change would remove a user slider, expose a raw coefficient, or make the
  lab config diverge from the eventual gameplay config.
- The same-seed paired comparison cannot be made reproducible after increasing
  the sample within the planned limit; retain the report as unknown and
  investigate randomness separately.

## Maintenance notes

- Any new numeric user setting must add a descriptor, typed path support,
  sensitivity expectation, matched-fixture decision, and focused test in the
  same change.
- Run the sensitivity baseline before and after any formula or rotation
  change. Explain classification changes in the audit document.
- Keep diagnostic thresholds and benchmark ranges in calibration code, not in
  GameSimulationConfig.
- Keep neutral fixtures for regression tests, but do not use them as the only
  evidence for coaching, talent-separation, home-court, injury, or rotation
  controls.
- Treat a conditional result as useful information, not a reason to inflate
  the formula until every slider moves every default metric.
- The next calibration plan should address global output distribution only
  after slider causality and user-config semantics are trustworthy.
