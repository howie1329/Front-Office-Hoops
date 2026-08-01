# FOH V2 Career Development Settings Pipeline Plan

> Archived on August 1, 2026. Consolidated into [V2 Career Cohort Calibration](../plans/foh-v2-career-cohort-calibration-plan.md).

**Status:** Planned  
**Date:** 2026-07-31  
**Roadmap position:** Phase 2 calibration and developer-lab infrastructure  
**Related documents:**

- `../plans/foh-v2-career-cohort-calibration-plan.md`
- `./foh-v2-career-development-growth-calibration-plan.md`
- `../specs/foh-v2-career-cohort-explorer-ui-brief.md`
- `../specs/foh-v2-data-and-export-design.md`
- `../specs/foh-v2-simulation-architecture.md`

## 1. Purpose

Build a complete, typed settings pipeline for career development experiments. The pipeline must let the cohort harness configure the development and decline rules being tested, pass one resolved configuration through the worker and simulation engine, and preserve that exact configuration in the report and JSON export.

This is more than adding UI controls. A setting is complete only when it has:

1. a typed contract;
2. validation and defaults;
3. an explicit path into the simulation engine;
4. deterministic behavior under a seed;
5. report and export persistence; and
6. a visible explanation of what changed in the run.

The harness remains a calibration and exploration tool. Its output is not a third authoritative gameplay model.

## 2. Current state and gap

The current implementation has a partial foundation:

- the career engine supports growth and decline curve tiers;
- curve multipliers and transition chances exist as low-level rules;
- the calibration layer can carry career rules internally;
- the worker can run cohort simulations; and
- reports already have a resolved-settings seam.

The pipeline is not complete:

- cohort run options still default to standard curve rules internally;
- the harness does not expose numeric curve modifiers or most development controls;
- there is no first-class baseline growth-rate scale;
- there are no controlled breakout or stall settings;
- timing and transition behavior are not represented as a complete user-facing settings object; and
- exports do not yet guarantee that every career-development input is captured.

The implementation should close these gaps without duplicating career logic in the worker or React route.

## 3. Design boundary

Use four layers with one direction of data flow:

```text
Harness controls
    -> CareerSettings input
    -> validate and resolve defaults
    -> CareerResolvedSettings
    -> worker execution
    -> pure career engine
    -> CareerCohortReport
    -> UI display and JSON export
```

### 3.1 Engine rules

The engine owns formulas and simulation behavior:

- potential-gap response;
- age, peak, plateau, and decline timing;
- development curve multipliers;
- minutes, opportunity, coaching, and availability effects;
- controlled randomness and event rolls;
- skill bounds, rounding, and clamping;
- decline transitions; and
- retirement evaluation when that phase is implemented.

The engine must not import UI types, read browser state, or silently read global settings.

### 3.2 Resolved settings

The resolver converts partial harness input into a complete immutable configuration. It applies documented defaults, validates bounds, normalizes values, assigns a settings version, and produces the object passed to the worker and engine.

The resolved object is the reproducibility boundary. Every report must include it or a lossless serialized equivalent.

### 3.3 Worker execution

The worker is an execution boundary, not a second rules layer. It should:

- receive the resolved settings and run metadata;
- create deterministic random streams from the seed;
- run the requested cohort or individual trace;
- emit progress and cancellation state;
- return a typed report; and
- never apply hidden defaults that are absent from the resolved settings.

### 3.4 Report and export

The report packages the simulation output and the configuration used to produce it. It should support both the cohort explorer and downstream analysis without requiring the UI to reconstruct settings from controls.

## 4. Typed settings contract

Add a versioned career-development settings contract in the domain or calibration boundary, using the repository's existing schema conventions.

### 4.1 Run metadata

The contract should include:

- `settingsVersion`;
- `seed`;
- `baseSeason`;
- `sampleSize`;
- `startAge` or starting-age distribution;
- `horizonYears`;
- run mode: cohort, individual, matched comparison, or calibration matrix; and
- a stable run identifier when needed for exports.

### 4.2 Population and player generation

Expose the inputs that define who is being tested:

- population context;
- starting-age distribution or fixed age;
- starting ability distribution;
- potential distribution or potential headroom;
- development-curve distribution or forced tier;
- decline-curve distribution or forced tier;
- peak-age distribution;
- decline-age distribution; and
- whether the run uses generated players or a fixed fixture/cohort.

Hidden player attributes remain hidden in gameplay, but the lab may expose them in its diagnostic output.

### 4.3 Growth baseline

Add a clearly named baseline scale, for example `growthRateScale`, with a documented neutral value of `1.0`.

The baseline must preserve the existing influences rather than replacing them:

- potential gap;
- age and phase;
- minutes and opportunity;
- coaching/development input;
- availability and injuries when enabled; and
- skill-specific response.

The scale changes the magnitude of eligible development after those factors are evaluated. It must not guarantee that a player reaches potential.

### 4.4 Development curve tiers

Expose separate multipliers for:

- slow developer;
- standard developer;
- fast developer; and
- elite developer.

The values must be editable for lab experiments, bounded, and included in the report. The default ordering must be explicit: `elite > fast > standard > slow`.

### 4.5 Growth variance and events

Add controlled settings for:

- ordinary growth noise scale;
- development stall chance;
- stall magnitude or duration, if supported;
- development surge/breakout chance;
- surge magnitude cap; and
- event frequency or phase eligibility.

These events should use dedicated deterministic random scopes. They should be recorded as structured events and bounded so one roll cannot create an implausible career. Production must not directly trigger development in this first version.

### 4.6 Phase transitions and timing

Expose or select presets for:

- peak-age generation;
- plateau duration;
- decline onset;
- growth-to-plateau transition chance;
- plateau-to-decline transition chance;
- decline severity progression; and
- whether transitions are age-based, probability-based, or both.

The initial implementation should prefer named timing presets over exposing every raw distribution parameter. Raw distributions can remain developer-only until the model is stable.

### 4.7 Development context

Expose the factors the lab is explicitly testing:

- minutes/opportunity profile;
- coaching-development profile;
- availability/injury profile;
- team context, if supported by the harness; and
- fixed or randomized context assignment.

Keep physical profiles stable in this calibration pass unless a later plan explicitly changes that decision.

### 4.8 Comparison controls

Matched-run controls should include:

- same seed;
- same generated players;
- same starting ratings;
- same context assignments;
- one changed setting at a time;
- baseline-versus-variant labels; and
- paired player identifiers.

This is required to distinguish a settings effect from a different random cohort.

## 5. Validation and resolution

Create one resolver used by the harness, worker entry point, and tests.

The resolver must:

- apply defaults for omitted fields;
- reject non-finite numbers;
- enforce safe minimums and maximums;
- preserve tier ordering unless an explicit diagnostic mode allows violations;
- normalize distributions to valid probabilities;
- reject incompatible combinations;
- assign `settingsVersion`;
- produce stable serialized output; and
- return actionable validation errors for the UI.

Do not allow the worker or engine to independently repair invalid settings. That creates unreproducible behavior.

The engine may still defensively clamp values at its final mathematical boundaries, but those clamps should be observable in diagnostics and should not replace resolver validation.

## 6. Engine integration

Refactor the career run entry points so the public run options accept the resolved settings or a clearly typed settings input that is resolved before simulation.

Required changes:

1. Remove hardcoded standard rules from cohort and individual run paths.
2. Pass the resolved growth and decline rules into every annual trace.
3. Apply `growthRateScale` at one documented point in the growth calculation.
4. Keep potential as a probabilistic forecast signal, not a hard ceiling or guarantee.
5. Keep development active at reduced intensity outside game minutes when the model says training still occurs.
6. Keep peak age as the end of normal growth and decline age as the beginning of decline.
7. Preserve deterministic random streams and separate random scopes for growth noise, transitions, surges, stalls, injuries, and retirement.
8. Emit structured annual event information when a non-routine development event occurs.

The engine should produce the same result whether invoked from the harness worker or a direct calibration test with the same resolved settings and seed.

## 7. Calibration sequence

Calibration must happen before promoting settings into gameplay or presenting them as recommended universe defaults.

### Step 1: baseline growth

Run a matrix across representative starting ability, potential headroom, age, minutes, coaching, and availability contexts. Measure:

- growth to peak;
- growth per eligible season;
- age at peak;
- share reaching within one point of forecast potential;
- share exceeding forecast potential; and
- share that stalls early.

Use the standard tier as the baseline. The provisional target is a visibly meaningful career arc, approximately six to eight ability points of mean growth to peak for a typical healthy player, subject to calibration evidence rather than being a permanent hardcoded target.

### Step 2: tier separation

Use matched players and identical contexts. First test curve multipliers with variance and transitions disabled. Then re-enable ordinary variance.

The required ordering is:

```text
elite > fast > standard > slow growth
steep > early > standard > durable decline severity
```

Record the mean, median, spread, and overlap of each tier. The objective is meaningful separation without deterministic tier outcomes.

### Step 3: controlled variance

Add ordinary noise, stalls, and surges one at a time. Verify that:

- the tier ordering remains visible in aggregate;
- rare events create a tail without dominating the cohort;
- events are reproducible under the same seed;
- events are present in traces and reports; and
- event rates do not depend on production directly.

### Step 4: potential calibration

Evaluate forecast potential separately from realized attainment. Track:

- forecast error by development tier;
- realized peak minus starting ability;
- realized peak minus forecast potential;
- over- and under-attainment rates;
- the effect of starting age and opportunity; and
- calibration by population context.

Do not tune the growth baseline and potential forecast simultaneously without labeling the experiment; otherwise the source of improvement will be unclear.

## 8. Worker and message contract

Update the worker request and response types so the request contains:

- resolved settings;
- run identity;
- seed and horizon;
- requested view mode; and
- cancellation/progress metadata where applicable.

The worker response should contain:

- report version;
- resolved settings snapshot;
- cohort summary;
- player-level traces or a stable reference to them;
- event records;
- diagnostics and warnings; and
- error state when validation or execution fails.

The worker must not return only a summary that forces the UI to infer the underlying settings or player timelines.

## 9. Report and JSON export contract

Extend the career cohort report with a versioned settings section containing at minimum:

- settings version;
- all resolved growth and decline multipliers;
- baseline growth scale;
- variance, stall, and surge controls;
- transition and timing preset identifiers;
- population and context settings;
- seed, sample size, starting age, base season, and horizon; and
- any warnings or validation adjustments.

Player traces should retain:

- player identifier;
- season and age;
- phase;
- ability and potential values;
- curve traits;
- development delta;
- availability/context values; and
- structured events.

Exports must round-trip through schema validation. A future report reader should be able to identify exactly which rules produced the result without relying on the current UI defaults.

## 10. Harness UI exposure

The harness should expose controls in groups rather than as an unstructured list.

### Recommended user-facing groups

- **Run:** seed, sample size, horizon, base season, mode.
- **Population:** context, starting age, generated/fixed cohort, curve distribution or forced tier.
- **Growth:** baseline scale, tier multipliers, potential-gap influence, opportunity/minutes profile, coaching profile.
- **Variance:** ordinary noise, stall rate, surge rate, event caps.
- **Decline:** decline tier multipliers, decline timing preset, severity progression.
- **Comparison:** baseline/variant, same-cohort matching, one-variable diff.

Each control needs a short explanation, allowed range, neutral/default value, reset action, and indication of whether it changes player generation, development, decline, or only analysis.

The UI should send settings through the resolver and display the resolved values returned in the report. It should not contain formulas or silently alter values before submission.

### Developer-only controls

Keep these out of the normal harness surface initially:

- raw random scopes;
- low-level skill-response coefficients;
- every individual age-distribution parameter;
- internal potential-generation formula terms;
- exact intermediate roll outcomes;
- retirement hazard internals; and
- experimental engine toggles without a stable schema contract.

These can be added to a diagnostics mode later if calibration requires them.

### Future universe-creation presets

Do not expose raw laboratory coefficients directly as gameplay universe settings. Once calibration is complete, define named presets such as:

- conservative development;
- accelerated development;
- high-variance development;
- durable aging;
- early aging; and
- custom universe development.

Gameplay should consume validated presets or a separate universe configuration contract. This prevents a temporary calibration knob from becoming an accidental authoritative gameplay rule.

## 11. Testing strategy

Add focused tests at each boundary.

### Contract and resolver tests

- defaults are stable;
- invalid values produce actionable errors;
- probabilities and multipliers are bounded;
- tier ordering is preserved;
- settings version is included; and
- serialization is deterministic.

### Engine tests

- custom settings affect results;
- standard settings preserve the current baseline behavior;
- growth scale changes eligible development without bypassing bounds;
- curve tiers separate under matched inputs;
- transitions are deterministic;
- stalls and surges are bounded and reproducible; and
- potential remains a forecast signal rather than a guarantee.

### Worker tests

- the worker passes resolved settings unchanged;
- two identical requests produce identical reports;
- a one-setting change appears in report metadata;
- cancellation does not return a misleading completed report; and
- validation errors occur before expensive simulation work.

### Report and export tests

- every resolved setting is serialized;
- reports round-trip through the schema;
- player traces and event records are retained;
- matched-run metadata identifies the baseline and variant; and
- older report versions have an explicit migration or rejection path.

### UI tests

- controls initialize from defaults;
- invalid values are visibly reported;
- reset restores the resolved default;
- run requests include the expected settings;
- report settings are displayed after completion;
- exports contain the same settings shown in the UI; and
- keyboard and loading/error states remain usable.

## 12. Implementation order

1. Define the versioned domain/calibration settings types and report schema.
2. Implement the resolver, defaults, bounds, and validation errors.
3. Update direct calibration entry points to accept resolved settings instead of hardcoded standard rules.
4. Add the baseline growth-rate scale and run the baseline calibration matrix.
5. Wire configurable growth and decline tier multipliers and calibrate separation.
6. Add controlled variance, stall, and surge events with deterministic random scopes.
7. Add timing and transition presets, keeping raw distributions developer-only.
8. Update worker request/response contracts and preserve the resolved snapshot.
9. Update report generation and JSON round-trip validation.
10. Expose the stable settings groups in the cohort explorer UI.
11. Add matched-run controls and settings-diff diagnostics.
12. Run the full focused test suite, typechecks, build, and `git diff --check`.
13. Review the resulting distributions before creating gameplay/universe presets.

## 13. Non-goals for this pass

- changing production to directly drive development;
- making the harness a third authoritative gameplay model;
- changing physical profiles;
- adding injury-driven development effects before the core pipeline is calibrated;
- exposing every raw engine coefficient to ordinary users;
- replacing deterministic seeded runs with opaque randomness; or
- committing calibrated values to gameplay before distributional review.

## 14. Definition of done

The settings pipeline is complete when:

- one typed, versioned settings object flows from the harness to the engine;
- the worker performs no independent career-rule resolution;
- all exposed development and decline controls are validated and deterministic;
- custom settings change simulation results in direct and worker runs;
- every report and JSON export captures the exact resolved settings;
- matched runs can isolate the effect of one setting;
- the UI can inspect, reset, run, compare, and export settings;
- tests cover contracts, engine behavior, worker forwarding, reports, and UI behavior; and
- calibrated settings are explicitly separated from future authoritative gameplay presets.
