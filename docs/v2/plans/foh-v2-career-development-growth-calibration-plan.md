# V2 Career Development Growth Calibration and Harness Settings — Implementation Plan

**Status:** Proposed  
**Date:** 2026-07-31  
**Roadmap position:** Phase 2 calibration  
**Extends:** [Career Cohort Curves and Explorer Plan](./foh-v2-career-cohort-curves-and-explorer-plan.md)  
**Companion:** [Career Cohort Explorer UI Brief](../specs/foh-v2-career-cohort-explorer-ui-brief.md)

## Objective

Recalibrate career development so young players show meaningful but uncertain
skill growth, create more separation between slow and elite developers, and
preserve potential as a forecast rather than a ceiling.

Expose the settings required to calibrate those behaviors in the Career Cohort
Harness. This is not only a UI pass: each control needs a typed engine input,
deterministic resolution, report persistence, schema coverage, and matched-run
tests before it is added to the page.

## Evidence motivating this work

The current 1,000-player, 20-year draft-class export used normal availability,
typical minutes, and standard development settings. It showed:

- Mean starting ability: approximately 47.
- Mean potential headroom: approximately 14.5 points.
- Mean growth to realized peak: approximately 4 points.
- Median growth to realized peak: approximately 3.8 points.
- Players gaining 5 or more points: approximately 27%.
- Players gaining 10 or more points: less than 1%.
- Mean potential forecast: 61.7.
- Mean realized peak: 51.1.
- Forecast-to-realized-peak correlation: 0.87.

The current tiers are directionally ordered but compressed:

| Growth curve | Mean growth to peak |
| --- | ---: |
| Slow | +2.7 |
| Standard | +3.6 |
| Fast | +4.6 |
| Elite | +5.7 |

This points to two separate calibration problems:

1. The general growth baseline is probably too low for the generated potential
   distribution.
2. The current curve multipliers do not create enough absolute separation,
   partly because annual deltas are small, phases are rounded, and the engine
   has no explicit breakout mechanism.

These are calibration signals, not final gameplay targets. Accepted ranges must
come from matched seeded runs rather than one export.

## Product and engine boundaries

Use three explicit layers:

    Career engine rules
      -> typed resolved settings
      -> developer harness controls and report metadata
      -> future universe-creation presets

- The career engine owns formulas, bounds, random scopes, events, and
  validation. It never reads UI state.
- The developer harness may expose hidden traits, exact curve multipliers,
  transition probabilities, growth variance, and matched counterfactuals.
  Every resolved value must be saved in the report.
- Universe creation and gameplay expose understandable development presets and
  curve distributions, not raw multipliers, random scopes, latent talent, or
  true potential.

Therefore the missing curve modifiers are not merely a UI-polish issue. The
engine/config contract and report seam must be implemented first; the UI pass
then exposes the already-typed controls.

Preserve these decisions:

- Potential remains a probabilistic forecast signal, not a hard cap.
- Physical attributes remain stable in this iteration.
- Production does not directly drive development.
- Minutes, coaching, availability, and injuries remain bounded modifiers.
- Zero minutes still permit slower training development.
- Plateau noise remains separate from growth and decline.
- Curve changes remain adjacent-tier, deterministic, and observable.
- Beginning-of-season timeline semantics do not change.
- V1 packages and surfaces remain untouched.

## Recommended calibration policy

Tune in this order:

1. Establish a healthier standard growth baseline.
2. Re-measure curve-tier spacing around standard.
3. Add bounded growth variance and rare breakout/stall outcomes.
4. Recalibrate potential forecasts against realized peaks.
5. Tune decline only after growth is accepted.

Do not solve the forecast gap by clamping players to potential. Do not solve
the lack of breakouts by making elite developers guaranteed stars.

## Workstream 1 — Typed career development settings

### Files in scope

- packages/domain-v2/src/career.ts
- packages/domain-v2/src/types.ts
- packages/league-schema/src/schema.ts
- packages/sim-v2/src/careerDevelopment.ts
- packages/calibration/src/career.ts
- packages/calibration/src/careerFixtures.ts

### Settings contract

Extend the typed career rules/resolved-settings boundary with these categories.

#### Growth baseline

- growthRateScale: bounded multiplier for the existing growth baseline.
- growthPotentialGapInfluence: bounded influence of potential headroom.
- growthOpportunityScale: optional bounded scale for minutes opportunity.

The first implementation should expose growthRateScale and keep the other two at
standard values unless matched calibration requires them.

#### Curve multipliers

Keep standard growth and decline anchored at 1.0, with independent values for:

- slow, standard, fast, and elite growth.
- durable, standard, early, and steep decline.

The existing values are the baseline comparison, not final balance:

    growth:  slow 0.70, standard 1.00, fast 1.30, elite 1.60
    decline: durable 0.70, standard 1.00, early 1.25, steep 1.60

The harness must sweep these independently while universe creation uses named
presets.

#### Growth outcome variance

Add a bounded developer-facing variance configuration:

- growthNoiseScale: scale for small annual growth noise.
- growthStallChance: rare chance of an underwhelming growth year.
- growthBreakoutChance: rare chance of a development-surge year.
- growthBreakoutMagnitude: bounded surge magnitude preset.

Both event probabilities may start at zero while the baseline and tiers are
calibrated. When enabled, events must be deterministic, independent of skill
loop order, and structured in the report.

Do not make these events direct production rewards. Potential, development
rating, curve tier, opportunity, coaching, and health may affect probability or
magnitude, but production must not trigger the event.

#### Transition and timing rules

Keep growth and decline transition probabilities explicit. A transition and a
breakout/stall event are separate concepts.

Expose named presets for peak-age and decline-onset distributions. Keep exact
ages visible only in the developer lab; do not add raw distribution parameters
to normal universe creation in this pass.

### Resolution requirements

1. Define one CareerDevelopmentSettings or equivalent resolved object at the
   domain/calibration boundary.
2. Resolve named presets and explicit harness overrides before the worker starts.
3. Validate bounds and incompatible combinations before running a cohort.
4. Pass the resolved object into the pure annual transition function.
5. Record the resolved object, settings version, selected presets, and seed in
   every cohort and individual report.
6. Allow matched comparisons to override exactly one variable while preserving
   generated player profiles, context, and all other rules.

## Workstream 2 — Raise the standard growth baseline

Apply growthRateScale to the existing growth mean only. Preserve the
potential-gap modifier, minutes opportunity and diminishing returns, coaching,
injury, skill response, bounds, rounding, plateau, and decline behavior.

The first sweep varies only growthRateScale under matched players and fixed
context.

Test the standard scale across:

- healthy, normal, and injured availability;
- zero, low, typical, and high minutes;
- weak, standard, and strong coaching;
- starting ages 19, 21, and 24;
- standard, high-potential, and low-potential profiles.

Record annual deltas, growth to peak, p10/median/p90 growth, potential-gap
closure, breakout/bust rates, peak age, and final ability at 5, 10, 20, and 30
years.

Use 6–8 mean points of growth to peak for a standard young cohort as a
provisional hypothesis, not an accepted gameplay target. The desired result is
more development, not universal development.

## Workstream 3 — Increase curve-tier separation

After the baseline is calibrated, run matched forced-curve cohorts with the same
starting players, healthy availability, typical minutes, standard coaching, and
transition probabilities set to zero.

Required ordering:

    expected growth: elite > fast > standard > slow
    expected decline severity: steep > early > standard > durable

The existing multipliers may produce larger absolute gaps after the baseline is
raised. If the tiers remain compressed, expand the distance around standard
rather than moving every tier upward. A candidate experiment arm is:

    growth: slow 0.60, standard 1.00, fast 1.40, elite 1.80

This is an experiment arm, not a final setting.

Accept using distributions, not one player: mean/median growth, p10/p90,
potential-gap closure, peak ages, bust/breakout rates, and the share gaining
5, 10, and 15 points. Elite developers must still fail and slow developers
must sometimes overperform.

## Workstream 4 — Add controlled growth variance and breakouts

The current engine mostly produces small annual deltas. Add a bounded event path
after phase/context calculation and before final skill deltas are applied.

Candidate events:

- development-surge: rare positive multi-skill growth.
- development-stall: rare negative or near-zero growth.

Both events must:

- apply only during growth in the first version;
- use a dedicated deterministic random scope;
- be independent of skill-loop order;
- be bounded by the rules object;
- preserve skill clamps and non-binding potential;
- include season, phase, player, magnitude, and reason metadata.

Start with low probabilities and calibrate event frequency separately from
magnitude. Do not make a surge a permanent curve-tier change.

Compare static curves with events disabled and enabled, then cross those arms
with volatility, potential headroom, and opportunity. Success means a wider but
plausible distribution, not simply a higher average.

## Workstream 5 — Recalibrate potential against realized peaks

Once baseline, tier spacing, and variance are stable, revisit potential.

Potential remains a forecast signal. The goal is not exact equality; it is to
avoid a persistent aggregate forecast bias of approximately ten points.

Evaluate two levers separately:

1. Development attainment: whether players with headroom can grow enough.
2. Forecast generation: whether the player source assigns too much headroom.

Prefer fixing attainment first. Only revise potential distributions after
matched growth runs show the engine can reach plausible outcomes and the
forecast remains systematically optimistic.

Track correlation, mean/median and p10/p50/p90 forecast error, the share within
1/3/5/10 points, the share exceeding forecast, and bust/breakout rates by tier.

## Workstream 6 — Expose the right harness settings

### Expose in the developer harness now

These directly affect development and belong in an advanced Career Rules group:

- growth-rate scale;
- per-tier growth multipliers;
- per-tier decline multipliers;
- growth noise scale;
- breakout and stall presets;
- growth and decline transition probabilities;
- peak-age and decline-onset presets;
- potential/development profile;
- starting age and population source;
- minutes, coaching, and injury context;
- seed, base season, sample size, horizon, and run mode.

Provide a standard-rules reset and a matched-run action that freezes every
setting except the selected variable.

### Expose to future universe creation as bounded presets

Use named presets or distributions for:

- stable versus volatile development;
- conservative versus aggressive growth environment;
- durable versus early-decline population;
- standard, development-forward, or veteran-heavy composition;
- low, normal, or high injury environment.

Do not expose exact per-tier multipliers, random scopes, event magnitudes, latent
talent, or true potential in normal gameplay.

### Keep developer-only

- exact random scopes;
- raw skill-response coefficients;
- internal potential-gap formula terms;
- exact retirement hazard weights;
- hidden peak and decline ages outside the lab;
- intermediate probability calculations and random rolls.

These may appear in debug reports but should not become ordinary universe
settings until the model is accepted.

## Workstream 7 — Report, export, and UI changes

Extend the resolved-settings report object with settings version, growth
baseline scale, curve multipliers, variance/event settings, transition settings,
timing preset IDs, population/development context, seed, and horizon.

Add surge/stall events to the career event schema. Keep report versioning
explicit and strict schema validation enabled.

Only after the engine/settings seam exists, add grouped harness controls:

1. Run identity.
2. Cohort definition.
3. Development environment.
4. Career curve rules.
5. Variance and transition rules.
6. Diagnostics and export.

Show resolved values in the run header and export metadata. The UI must only
resolve controls and display report data; it must not calculate career formulas
or own rule defaults.

## Testing and verification

Add or extend focused tests in:

- packages/domain-v2/tests/career.test.ts
- packages/domain-v2/tests/playerGeneration.test.ts
- packages/sim-v2/tests/careerDevelopment.test.ts
- packages/sim-v2/tests/playerGeneration.test.ts
- packages/calibration/tests/career.test.ts
- packages/league-schema/tests/careerSchema.test.ts
- apps/web-v2/src/lib/developmentCohortLab.test.ts

Required tests:

- Identical seeds and settings reproduce identical reports.
- Changing only baseline scale changes growth, not physical profiles or identity.
- Changing only curve multipliers preserves inputs and changes outcomes correctly.
- Curve tiers remain ordered under matched seeds.
- Breakout/stall events are deterministic, bounded, and loop-order independent.
- Potential remains non-binding and can be exceeded.
- Plateau noise remains centered near zero.
- Decline severity worsens with age past decline onset.
- No development occurs after retirement.
- Settings survive report serialization and schema round-trip.
- Harness validation rejects invalid ranges and incompatible runs.
- Matched resolution changes exactly one selected variable.

Verification gates:

    npm run typecheck --workspace @workspace/domain-v2
    npm run typecheck --workspace @workspace/sim-v2
    npm run typecheck --workspace @workspace/calibration
    npm run typecheck --workspace @workspace/league-schema
    npm run typecheck --workspace web-v2

    npm run test --workspace @workspace/domain-v2
    npm run test --workspace @workspace/sim-v2
    npm run test --workspace @workspace/calibration
    npm run test --workspace @workspace/league-schema
    npm run test --workspace web-v2

    npm run build --workspace web-v2
    git diff --check

## Implementation order

1. Add typed resolved settings and schema/version support.
2. Add growth baseline scale and matched calibration runner.
3. Recalibrate and widen curve multipliers.
4. Add controlled variance and breakout/stall events.
5. Recalibrate potential against realized peaks.
6. Add advanced harness controls and matched-run UI behavior.
7. Update exports, diagnostics, tests, and calibration reports.
8. Do not promote values into authoritative gameplay until distributional
   acceptance criteria pass.

## Explicit non-goals

- No V1 changes.
- No direct production-to-development multiplier.
- No hard potential cap.
- No archetype or physical-profile coupling.
- No player-facing raw curve coefficients.
- No direct access to random scopes in normal settings.
- No second career engine in React.
- No League Loop promotion before matched cohorts and lifecycle invariants pass.

## Definition of done

This plan is complete when:

- Standard young players show materially more development without making
  potential deterministic.
- Slow through elite developers produce clearly separated but overlapping
  outcome distributions.
- A small, observable share of players can experience meaningful growth surges
  or stalls.
- Potential remains a useful ranking/forecast signal and can still be exceeded.
- Curve modifiers and other development-affecting settings are exposed in the
  developer harness, resolved through typed engine settings, and preserved in
  JSON reports.
- Future universe creation can use bounded presets without raw lab coefficients.
- All focused tests, typechecks, build, schema checks, and diff checks pass.

