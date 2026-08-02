# V2 Career Cohort Curves and Explorer — Implementation Plan

> Archived on August 1, 2026. Consolidated into [V2 Career Cohort Calibration](../plans/foh-v2-career-cohort-calibration-plan.md).

**Status:** Proposed  
**Date:** 2026-07-31  
**Roadmap position:** Phase 2 calibration  
**Extends:** [Career Cohort Harness Implementation Plan](./foh-v2-career-cohort-harness-implementation-plan.md)  
**Companion:** [Career Cohort Explorer UI Brief](../specs/foh-v2-career-cohort-explorer-ui-brief.md)

## Objective

Add persisted, deterministic development and decline curve traits to every
generated player; make the career engine use those traits without turning
potential into a guarantee; expose the development-focused controls needed by
the cohort lab and future universe creation settings; and provide a compact
player index so the lab can become a true cohort explorer.

This work remains calibration infrastructure. It must use the same player
generation and annual transition functions that the future League Loop will
call, but it must not promote unaccepted curve behavior into authoritative
gameplay.

## Current state and constraints

The current career engine has three age-derived phases: growth, plateau, and
decline. Growth uses a positive baseline, plateau uses zero mean plus noise,
and decline uses an age-increasing negative baseline. The implementation has
no explicit growth or decline curve tier. See
`packages/sim-v2/src/careerDevelopment.ts`.

`CareerDevelopmentProfile` currently contains `potential`, `rating`,
`volatility`, `peakAge`, and `declineStartAge`. Add the new traits to this
existing profile rather than introducing a second player-development object.
See `packages/domain-v2/src/types.ts`.

The central player generator is already used by the initial roster, free-agent
pool, and draft-class population paths. Generate the traits there so the
values are present on every player source. Do not add career-trait generation
only inside `packages/calibration`.

The existing web controls are comparison-oriented. They expose cohort presets,
seed, sample size, a 3/5/10-year horizon, minutes, and coaching. Starting age,
injury context, development context, curve traits, and base season are fixed
by presets. The high-volatility preset is also coupled to the injured context,
which prevents isolated calibration of volatility versus injury.

Preserve the following decisions from the existing career plan and product
documents:

- Potential is an absolute forecast signal, not a hard ceiling or guarantee.
- Physical attributes remain stable in this version.
- Archetype and physical profile do not determine peak or decline timing.
- Zero minutes still permit slower development.
- Minutes have bounded, diminishing influence.
- Production does not directly drive development.
- Coaching is a bounded development input.
- Injuries affect availability and future development, not direct permanent
  skill subtraction in this version.
- Beginning-of-season snapshots and current timeline semantics remain intact.
- The lab may expose hidden truth; gameplay must not expose hidden curve,
  peak-age, decline-age, or true-potential values.
- V1 surfaces remain out of scope.

## Decisions to implement

### Career curve terminology

Add two independent hidden traits:

```ts
type CareerGrowthCurve = "slow" | "standard" | "fast" | "elite"

type CareerDeclineCurve = "durable" | "standard" | "early" | "steep"
```

Use the following display labels in the developer lab:

| Internal value | Display label | Meaning |
| --- | --- | --- |
| `slow` | Slow developer | Lower expected growth rate; outcomes remain noisy. |
| `standard` | Standard developer | Default growth behavior. |
| `fast` | Fast developer | Higher expected growth rate; not a guarantee of a high peak. |
| `elite` | Elite developer | Highest expected growth rate; still subject to potential, variance, opportunity, and health. |
| `durable` | Durable decline | Lower decline severity after decline begins. |
| `standard` | Standard decline | Default decline behavior. |
| `early` | Early decline | Decline becomes meaningful sooner relative to the baseline. |
| `steep` | Steep decline | Stronger age-based decline after decline begins. |

The shared string `standard` is acceptable because the fields are distinct:
`growthCurve: "standard"` and `declineCurve: "standard"`.

### Trait persistence and change

Generate an initial curve tier deterministically and persist the current tier
on the player. Do not reroll the tier every season.

The engine should support rare, deterministic one-tier transitions so the
traits can change without becoming arbitrary annual noise:

- A growth-curve transition may occur during the growth or plateau phases.
- A decline-curve transition may occur during plateau or decline, with the
  chance increasing after `declineStartAge`.
- A transition moves at most one adjacent tier unless a future product
  decision explicitly allows a larger jump.
- The transition is scoped to
  `career → player → season → trajectory-change`.
- Every transition emits a structured event containing the dimension, old
  tier, new tier, season, and reason category.

The first calibration pass may set transition probabilities to zero while
the static tier multipliers are calibrated. The data model must still support
the transition event and preserve the current value on each snapshot.

### Curve behavior

The curve tier modifies the expected phase rate; it does not replace the
phase model.

- Growth rate = current growth baseline × growth-curve multiplier × existing
  opportunity, coaching, injury, and potential-gap modifiers.
- Plateau remains near-zero mean and continues to allow small positive or
  negative movement.
- Decline rate = age-based decline severity × decline-curve multiplier ×
  existing bounded context modifiers.
- Decline severity increases as age moves farther beyond
  `declineStartAge`.
- Potential remains a probability and expected-range signal. A fast or elite
  developer can still fall short of potential.
- Growth and decline traits are independent. A fast developer can have a
  steep decline, and a slow developer can be durable.

Use provisional multipliers only as a calibration starting point, not as
accepted gameplay balance:

```text
growth:  slow 0.70, standard 1.00, fast 1.30, elite 1.60
decline: durable 0.70, standard 1.00, early 1.25, steep 1.60
```

Keep these values in typed curve rules/configuration rather than scattering
numeric literals through the transition function. The calibration suite must
be able to sweep them without changing the player contract.

## Workstream 1 — Domain contracts, generation, and persistence

### Files in scope

- `packages/domain-v2/src/types.ts`
- `packages/domain-v2/src/career.ts`
- `packages/domain-v2/src/playerGeneration.ts`
- `packages/domain-v2/src/index.ts`
- `packages/sim-v2/src/playerGeneration.ts`
- `packages/sim-v2/src/playerPopulation.ts`
- `packages/sim-v2/src/playerUniverse.ts`
- `packages/league-schema/src/schema.ts`
- `packages/league-schema/src/index.ts`
- Related domain, simulation, and schema tests

### Implementation steps

1. Add `CareerGrowthCurve` and `CareerDeclineCurve` types in the domain
   career module and export them from `packages/domain-v2/src/index.ts`.
2. Add `growthCurve` and `declineCurve` to `CareerDevelopmentProfile`.
3. Add typed generation weights to the player-generation configuration. The
   standard roster, free-agent, and draft-class presets must each resolve a
   complete valid distribution. Keep the initial distributions independently
   configurable so draft classes can later be more development-forward
   without changing existing players.
4. Add deterministic categorical draws using a dedicated random scope under
   the existing development generation scope. Do not reuse talent, skill, or
   trait random draws.
5. Include the generated curves in player-generation diagnostics and any
   population fixture output used by calibration.
6. Add strict schema validation for both fields and for curve-weight config.
   Invalid weights, unknown curve values, and missing required traits must
   fail clearly.
7. Bump the relevant versioned contract only if the repository's existing
   schema policy requires it. Add a pure migration or explicit fixture update
   rather than silently defaulting a missing saved value.
8. Confirm that initial-roster, initial-free-agent, and draft-class generation
   all produce valid curve traits and preserve deterministic replay.

### Workstream 1 acceptance criteria

- Every generated `PlayerEntity` has valid growth and decline curves.
- The same seed produces the same curves across repeated runs.
- Different generation sources can use different configured distributions.
- Physical attributes and existing development fields are unchanged in
  meaning.
- Domain and league-schema round trips preserve both curve fields.
- No V1 package or surface changes.

## Workstream 2 — Annual curve application and trajectory-change events

### Files in scope

- `packages/sim-v2/src/careerDevelopment.ts`
- `packages/sim-v2/src/index.ts`
- `packages/domain-v2/src/career.ts`
- `packages/league-schema/src/schema.ts`
- `packages/calibration/src/career.ts`
- `packages/calibration/src/careerFixtures.ts`
- `packages/sim-v2/tests/careerDevelopment.test.ts`
- `packages/calibration/tests/career.test.ts`
- Related schema tests

### Implementation steps

1. Define a typed career curve-rules object containing growth multipliers,
   decline multipliers, and transition settings. Provide a standard rules
   object and pass it into the pure transition function or its annual
   context; do not read UI state from the engine.
2. Apply the growth multiplier only when the player is in `growth`. Preserve
   the current potential-gap modifier, opportunity modifier, coaching
   modifier, injury modifier, skill response, clamping, and scoped randomness.
3. Apply the decline multiplier to the existing age-based negative mean. Keep
   the age-past-decline term so decline becomes harsher with age.
4. Keep plateau noise behavior separate from growth and decline multipliers.
   A plateau trait must not silently become a second growth phase.
5. Add deterministic trajectory-change evaluation using an adjacent-tier rule.
   The evaluation must be independent of skill-loop order and have its own
   random scope.
6. Add a `trajectory-change` event shape. It must identify whether growth or
   decline changed, the previous tier, the new tier, the season, and the
   bounded reason category. Keep event IDs deterministic.
7. Ensure the player state used for the next snapshot contains the new current
   tier and that retirement stops all future transitions and development.
8. Extend season-level diagnostics so a selected season exposes the active
   curves and the applied multiplier. The diagnostics should show the inputs
   and output delta without exposing raw internal random values.
9. Keep timeline semantics unchanged: the snapshot is the entering-season
   state, and a transition event belongs to the season result that produced
   it.

### Calibration matrix

Before accepting multipliers, run matched seeded cohorts for:

- Each growth tier with identical starting players and healthy/typical
  context.
- Each decline tier with identical older players and healthy/typical context.
- Each growth tier crossed with low, typical, and high minutes.
- Each growth tier crossed with weak, standard, and strong coaching.
- Each decline tier crossed with healthy and injured context.
- Static traits versus transition probabilities set to zero.
- Transition-enabled runs with event counts and adjacent-tier assertions.

Do not accept values based only on one individual trace. Record average,
median, p10, p90, peak age, realized peak, bust/breakout rates, and decline
distribution.

### Workstream 2 acceptance criteria

- Static curve tiers produce ordered directional outcomes under matched seeds:
  elite ≥ fast ≥ standard ≥ slow for expected growth, and durable ≤ standard
  ≤ early ≤ steep for decline severity.
- Potential remains non-deterministic and does not cap the final skill.
- Plateau noise remains present and centered near zero.
- Curve transitions are deterministic, bounded, observable, and persisted.
- No development occurs after retirement.
- Existing deterministic, physical-stability, skill-bound, timeline, and
  retirement tests remain green.

## Workstream 3 — Development-focused harness and universe settings

The harness should test development and decline mechanics, not hide important
variables inside named cohort presets. The lab and future universe-creation
settings should share a typed resolution layer, while retaining separate
permission boundaries:

- **Lab controls** may force a curve tier, reveal hidden truth, retain full
  timelines, and run counterfactual matched scenarios.
- **Universe-creation controls** should select bounded, understandable
  development profiles or curve distributions. They should not expose raw
  multipliers, random scopes, latent talent, or true potential.

### Files in scope

- `packages/domain-v2/src/career.ts`
- `packages/domain-v2/src/types.ts`
- `packages/league-schema/src/schema.ts`
- `packages/calibration/src/careerFixtures.ts`
- `packages/calibration/src/career.ts`
- `apps/web-v2/src/lib/developmentCohortLab.ts`
- `apps/web-v2/src/routes/developer-labs.development-cohorts.tsx`
- `apps/web-v2/src/lib/developmentCohortLab.test.ts`
- Future league-creation settings adapters only if the existing contract is
  ready; do not modify V1 settings

### Required controls for the cohort explorer

#### Run identity

- Deterministic seed
- Base season
- Sample size
- Horizon: 1, 5, 10, 20, and 30 years
- Run mode: one cohort, individual trace, or matched comparison

#### Player cohort definition

- Starting age, with either a fixed age or a named age cohort
- Population source: young/draft, roster, free agent, or veteran fixture
- Potential/development profile: standard, high potential, low potential,
  and high volatility
- Growth curve: generated distribution or forced slow/standard/fast/elite
- Decline curve: generated distribution or forced durable/standard/early/steep

#### Development environment

- Minutes opportunity: zero, low, typical, high
- Injury/availability: healthy, normal, injured
- Coaching development support: weak, standard, strong
- Optional future staff-development profile, once staff inputs are available

#### Analysis and export

- Show hidden truth in the developer lab
- Include trajectory-change events
- Retain outliers
- Export summary, selected-player, or full-debug data
- Select a benchmark profile when one is available

### Future universe-creation controls

The gameplay-facing universe creator should expose higher-level concepts:

- Development environment preset: stable, standard, accelerated, or volatile
- Development variance
- Growth-curve distribution
- Decline durability distribution
- Peak-age distribution
- Decline-onset distribution
- Injury frequency/severity/recovery profile
- Staff/coaching development effect scale

Each setting needs a default, bounded range or enumerated preset, description,
resolved value in the saved league settings, and a version. The universe
creator should not expose exact individual curve assignments or hidden player
truth.

### Settings resolution rules

1. Define one typed resolved career-settings object in the domain/calibration
   boundary.
2. Make the harness UI resolve its controls into that object.
3. Make named lab presets populate the same object rather than embedding
   special cases in the route.
4. Keep matched comparisons able to override exactly one variable while
   holding the player seed and all other settings constant.
5. Record the resolved settings in every report and export.
6. Validate incompatible combinations before starting workers.

### Workstream 3 acceptance criteria

- Starting age, injury, development context, and curve traits can be changed
  independently.
- High volatility no longer silently implies injured context.
- The lab can force each curve tier for matched calibration runs.
- A universe-creation preset can resolve to deterministic curve distributions.
- Every setting affecting development is visible in the run metadata and JSON.
- Raw coefficients and random scopes remain developer-only.
- Existing standard defaults remain reproducible.

## Workstream 4 — Cohort player index and report projection

The current report retains full timelines, but the UI only receives a trace
for player 1 and compares cohort aggregates. Add a compact index so the UI can
search, sort, filter, and select a player without repeatedly walking or
rendering every full timeline.

### Files in scope

- `packages/domain-v2/src/career.ts`
- `packages/domain-v2/src/index.ts`
- `packages/league-schema/src/schema.ts`
- `packages/league-schema/src/index.ts`
- `packages/calibration/src/career.ts`
- `packages/calibration/src/careerBenchmarks.ts` if benchmark summaries need
  the index
- `apps/web-v2/src/lib/careerCohortWorker.ts`
- `apps/web-v2/src/routes/developer-labs.development-cohorts.tsx`
- Related report and UI tests

### Proposed player index contract

Add a `CareerPlayerSummary` projection containing only selection and ranking
facts:

```ts
type CareerPlayerSummary = {
  playerId: string
  seed: string
  startingAge: number
  startingAbility: number
  potentialForecast: number
  growthCurve: CareerGrowthCurve
  declineCurve: CareerDeclineCurve
  peakAge: number
  declineStartAge: number
  peakAbility: number
  realizedPeakAge: number
  finalAbility: number
  seasonsSimulated: number
  retired: boolean
  retirementAge: number | null
  retirementSeason: number | null
  terminationReason: "retired" | "horizon-complete"
  outlier: boolean
}
```

Add `playerIndex: CareerPlayerSummary[]` to the cohort report. Keep full
`timelines` available for debug/full exports and selected-player inspection.
The index must be derivable from a timeline so it cannot become a second
simulation truth.

If memory pressure becomes material for large cohorts, support a report mode
that returns the index plus selected timelines rather than deleting the
projection or reimplementing the simulation in the UI.

### UI data-flow requirements

- Build the index in calibration or the worker boundary, not inside repeated
  React renders.
- Use stable player IDs and seeds for selection.
- Use virtualized or paginated rows for large cohorts.
- Selecting a row must reveal the corresponding full timeline and preserve
  the active cohort settings.
- Sorting/filtering must operate on the index fields only.
- The selected player may be overlaid on cohort mean and percentile
  trajectories.
- Exporting a selected player must include its index record and full timeline.

### Workstream 4 acceptance criteria

- A cohort of at least 10,000 players can produce an index without rendering
  10,000 full timelines.
- Every index row maps to exactly one timeline/player ID.
- Sorting and filtering do not mutate report data or simulation state.
- Selected-player traces are deterministic and match the corresponding
  timeline in the report.
- Index, selected timeline, full report, and JSON export preserve schema
  validation.
- Outlier references do not require duplicating full timelines in compact
  exports.

## Testing and verification

Add or extend focused tests in:

- `packages/domain-v2/tests/career.test.ts`
- `packages/domain-v2/tests/playerGeneration.test.ts`
- `packages/sim-v2/tests/playerGeneration.test.ts`
- `packages/sim-v2/tests/playerUniverse.test.ts`
- `packages/sim-v2/tests/careerDevelopment.test.ts`
- `packages/calibration/tests/career.test.ts`
- `packages/league-schema/tests/careerSchema.test.ts`
- `apps/web-v2/src/lib/developmentCohortLab.test.ts`
- A route/report projection test covering player-index selection

Required test cases:

- Deterministic curve generation for identical seeds.
- Valid curve distributions for roster, free-agent, and draft sources.
- Schema round-trip preservation of curve traits and settings.
- Ordered growth and decline behavior under matched seeds.
- Potential forecast remains non-binding.
- Adjacent-only deterministic trajectory changes.
- Curve transition events appear on the correct season result.
- Physical attributes remain stable.
- No development after retirement.
- Independent setting changes alter only their intended context.
- Cohort index rows match timeline facts.
- Selected player equals the corresponding full timeline.
- Large-cohort indexing does not require rendering every timeline.
- Export modes preserve settings, seed, report version, and selected data.

Run these verification gates from the repository root:

```bash
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
```

## Implementation order

1. Add curve types, generation distributions, player persistence, and strict
   schemas.
2. Add annual curve multipliers, decline severity, and trajectory-change
   events.
3. Add resolved development-focused harness settings and remove preset
   confounding.
4. Add the cohort player-index projection and worker/report boundary.
5. Implement the companion Cohort Explorer UI from the UI brief.
6. Run matched calibration matrices and establish accepted ranges before
   League Loop integration.

## Explicit non-goals

- No V1 changes.
- No direct production-to-development multiplier.
- No archetype or physical-profile curve coupling in this pass.
- No gameplay exposure of true potential, hidden curve traits, or exact peak
  and decline ages.
- No raw coefficient controls in the normal universe-creation flow.
- No second career simulation engine in React.
- No full league-loop promotion until distributional benchmarks and lifecycle
  invariants pass.

## Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| Curve multipliers make potential too deterministic | Keep potential probabilistic, retain volatility, and compare forecast-to-realized distributions. |
| Fast/elite tiers erase meaningful player misses | Calibrate p10/median/p90 and bust rates, not only averages. |
| Decline traits duplicate decline-start age | Keep onset age and decline severity as separate fields. |
| Trait changes become unexplained noise | Limit transitions to adjacent tiers, deterministic scopes, and structured events. |
| Lab comparisons remain confounded | Allow age, injury, development context, and curve tiers to vary independently. |
| Full reports become too large for the browser | Add a compact player index and selectable export profiles. |
| UI becomes a second simulation boundary | Resolve settings into typed inputs and keep all rules in domain/sim/calibration packages. |

## Definition of done

This plan is complete when every player source receives persisted growth and
decline traits, the annual engine uses them with deterministic and observable
behavior, the cohort explorer can configure development variables without
hidden preset coupling, and a user can select any indexed player and inspect
the matching full career timeline. The resulting reports must remain evidence
for calibration, not authoritative gameplay state, until accepted by the V2
promotion rules.
