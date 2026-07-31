# V2 Career Cohort Harness — Implementation Plan

**Status:** Proposed
**Date:** 2026-07-31
**Roadmap position:** Phase 2 calibration, followed by Slice 4 career transitions
**Depends on:** Player Generation, Game & Matchup, and Production & Value foundations

## Objective

Build one authoritative annual career-transition engine and a developer-facing
Career Cohort Harness that can test players from early career through growth,
plateau, decline, and retirement.

The same annual transition functions must eventually be used by the League Loop.
The web lab visualizes typed reports; it does not own development rules or
mutate authoritative league state.

## Locked model decisions

- Support individual player traces and large cohort runs.
- Support multiple starting ages, including approximately 19, 24, 29, and 34.
- Generate hidden `peakAge` and `declineStartAge` values for every player.
- Peak age marks the end of expected growth.
- Plateau length varies by player and permits small positive or negative movement.
- Potential is an absolute forecast, such as 90 potential, not a hard ceiling.
- Potential changes probabilities and expected ranges but does not guarantee an outcome.
- Keep all eight player skills independently mutable:
  - shooting;
  - finishing;
  - passing;
  - handling;
  - rebounding;
  - defense;
  - basketball IQ;
  - stamina.
- Keep physical attributes stable in the first version.
- Players develop slowly even with zero minutes.
- Minutes provide a bounded, diminishing opportunity modifier.
- Production is an output and context record, not a direct development input.
- Head-coach development emphasis is a small global modifier.
- Injuries affect current-season availability and development only.
- Injury effects do not permanently alter skills in the first version.
- Retirement occurs after the playoffs and before staff and transaction phases.
- Development occurs during preseason after offseason construction.
- Retirement is final.
- Peak and decline ages remain hidden during gameplay but are visible in the developer lab.
- The first target is NBA-like career distributions.

## Repository alignment

The existing player generator already creates an absolute potential value from
current ability/talent plus generated headroom. Preserve that player-level
meaning while keeping headroom as an internal generation diagnostic.

The player development profile currently contains potential, development
rating, and volatility but no career timing fields. Add peak and decline timing
to that profile or to an explicit nested career profile with a versioned
contract.

The current game coaching profile contains pace, offensive style, defensive
pressure, shot selection, and rotation depth. Career development emphasis must
remain a separate staff/career input rather than being conflated with game
tactics.

V1 surfaces remain out of scope. Do not modify `apps/web`, `packages/sim`, or
other V1 domain contracts.

## Phase 1 — Domain contracts

Create `packages/domain-v2/src/career.ts` with focused types for:

```ts
type CareerDevelopmentProfile = {
  potential: number
  rating: number
  volatility: number
  peakAge: number
  declineStartAge: number
}

type CareerAnnualContext = {
  season: number
  minutes: number
  gamesPlayed: number
  gamesScheduled: number
  injuryDevelopmentPenalty: number
  coachingDevelopmentEmphasis: number
}

type CareerTransitionResult = {
  player: PlayerEntity
  phase: "growth" | "plateau" | "decline"
  skillDeltas: Record<PlayerSkillKey, number>
  events: CareerDevelopmentEvent[]
  availability: CareerAvailabilitySummary
}

type RetirementEvaluation = {
  eligible: boolean
  retired: boolean
  probability: number
  factors: RetirementFactor[]
}
```

Add cohort contracts for starting age, sample size, run length, minutes
context, coaching context, injury context, development context, individual
timelines, cohort summaries, failed seeds, and benchmark results.

Add a retired player status for eventual league integration. Keep report
contracts separate from `LeagueDocument` contracts.

## Phase 2 — Player generation updates

Update `packages/sim-v2/src/playerGeneration.ts` and the player-generation
configuration to draw deterministic career timing values.

For every generated player:

- draw `peakAge`;
- draw `declineStartAge`;
- enforce `declineStartAge > peakAge`;
- keep timing mostly independent of archetype and physical profile;
- allow only a mild relationship to development rating/volatility;
- include timing in developer diagnostics;
- keep physical attributes unchanged throughout the first career run.

Update generation fixtures, population fixtures, and tests so every generated
player has valid career timing.

The current value model should calculate potential headroom as:

```text
potentialForecast - currentAbility
```

It should not treat the absolute potential forecast as pure headroom.

## Phase 3 — Annual career-transition engine

Create:

- `packages/sim-v2/src/careerDevelopment.ts`;
- `packages/sim-v2/src/careerRetirement.ts`.

Implement two separate pure functions:

```ts
advancePlayerCareerYear(input): CareerTransitionResult
evaluatePlayerRetirement(input): RetirementEvaluation
```

Keep retirement separate because it occurs after the playoffs, while
development occurs during preseason.

### Annual development sequence

For each player:

1. Determine the phase from age, peak age, and decline age.
2. Calculate baseline training development.
3. Apply a small minutes/opportunity modifier.
4. Apply head-coach development emphasis.
5. Use potential as a probability-shaping forecast.
6. Apply player volatility.
7. Apply the current-season injury development penalty.
8. Apply skill-specific deltas.
9. Allow small random movement during plateau years.
10. Clamp skills to valid bounds.
11. Increment age.
12. Re-derive role and archetype from updated skills.
13. Emit structured development events and diagnostics.

Use deterministic random scopes such as:

```text
career → player → season → skill
career → player → season → plateau-noise
career → player → season → retirement
```

This keeps runs reproducible and prevents unrelated changes from rerolling
other players.

### Skill behavior

Keep the eight skills independent. Use generic skill-specific response curves,
but do not use archetype or physical profile to determine peak or decline
timing.

- Growth phase: positive expected movement.
- Plateau: near-zero expected movement with positive and negative noise.
- Decline phase: negative expected movement.
- Potential: affects probability and expected range, not a hard cap.
- Zero minutes: slower development, not zero development.
- High minutes: additional development with diminishing returns.

## Phase 4 — Retirement engine

Implement an age-based retirement hazard.

Retirement probability should increase with age and be modified by:

- health and injury history;
- current ability;
- role;
- available opportunity;
- contract or roster opportunity where available.

Do not add morale, personal-life simulation, or post-retirement returns in the
first version.

The lifecycle order becomes:

```text
playoffs end
  → retirement evaluation
  → staff phase
  → contracts and re-signing
  → draft
  → free agency
  → roster completion
  → preseason development
  → next regular season
```

Retirement results should include developer-only factor explanations.

## Phase 5 — Calibration harness

Create:

- `packages/calibration/src/career.ts`;
- `packages/calibration/src/careerFixtures.ts`;
- `packages/calibration/src/careerBenchmarks.ts`.

Support two modes.

### Individual trace

Follow one deterministic player through:

- yearly skills;
- phase changes;
- potential forecast;
- minutes;
- coaching context;
- injury penalty;
- availability;
- retirement evaluation;
- final retirement.

### Cohort batch

Support:

- 3-year iteration runs;
- 5-year development runs;
- 10-year standard calibration runs;
- 15–30-year career and retirement runs;
- at least 500 players for directional work;
- at least 1,000 players for release-gate distributions.

Use matched scenarios to isolate one variable at a time:

- same player, zero versus high minutes;
- same player, weak versus strong coaching;
- same player, healthy versus injured;
- same cohort, low versus high potential;
- different starting ages;
- high-potential success versus high-potential failure.

Production remains an output/context record. It should not be passed as a
direct skill-development multiplier.

## Phase 6 — Metrics and benchmarks

Reports should include:

- average and percentile skill trajectories;
- current ability trajectory;
- peak age;
- decline age;
- plateau length;
- growth to peak;
- decline rate;
- breakout rate;
- bust rate;
- late-bloomer rate;
- availability rate;
- injury-affected seasons;
- retirement rate;
- retirement-age distribution;
- potential forecast versus realized peak;
- failed seeds and outlier timelines.

Separate hard invariants from calibration targets.

Hard invariants include:

- deterministic replay;
- valid skill bounds;
- unchanged physical attributes;
- age advancing exactly one year;
- no development after retirement;
- final retirement;
- contiguous career timelines;
- no duplicate player/year records;
- valid event references.

Calibration targets include:

- realistic peak ages;
- realistic career lengths;
- plausible retirement ages;
- nonzero but controlled breakout and bust rates;
- potential predicting outcomes without guaranteeing them;
- stable league talent distributions;
- no universal synchronized peak age.

Do not set exact NBA-like thresholds until initial batch reports establish a
baseline.

## Phase 7 — Schema and serialization

Extend `packages/league-schema` with strict schemas for:

- career timing fields;
- annual career context;
- transition results;
- retirement evaluations;
- individual timelines;
- cohort reports;
- benchmark results;
- failed career fixtures.

Add versioned serialization and import validation. If the player profile
contract changes incompatibly, add a migration rather than silently inferring
missing career timing.

Lab reports remain separate from `LeagueDocument`.

## Phase 8 — Worker and web lab

Create:

- `apps/web-v2/src/workers/career-cohort.worker.ts`;
- `apps/web-v2/src/lib/careerCohortWorker.ts`.

Support individual runs, cohort batches, progress, cancellation, completed
reports, and structured failures.

Replace fixture calculations in
`apps/web-v2/src/lib/developmentCohortLab.ts` with calls to the typed
calibration runner.

Keep the existing route:

`apps/web-v2/src/routes/developer-labs.development-cohorts.tsx`

Add individual-career and cohort-comparison modes with controls for:

- starting age;
- run length;
- sample size;
- minutes context;
- coaching context;
- injury context;
- development/potential preset;
- deterministic seed.

The lab may show hidden peak age, decline age, potential forecast, random
scopes, and retirement factors. Gameplay UI must not expose those hidden
values.

Preserve the existing UI constraints: no chart dependency, dense comparison
tables, semantic status colors, keyboard access, focus states, responsive
behavior, and reduced-motion safety.

## Phase 9 — Testing

Add focused tests in:

- `packages/domain-v2/tests/career.test.ts`;
- `packages/sim-v2/tests/careerDevelopment.test.ts`;
- `packages/sim-v2/tests/careerRetirement.test.ts`;
- `packages/calibration/tests/career.test.ts`;
- `packages/league-schema/tests/careerSchema.test.ts`;
- `apps/web-v2/src/lib/developmentCohortLab.test.ts`.

Test deterministic individual and cohort replay, growth/plateau/decline,
potential-as-forecast behavior, zero-minute development, diminishing minutes
effects, bounded coaching effects, current-season injury penalties, physical
stability, retirement hazards, report consistency, failed-seed retention,
schema round trips, and worker cancellation.

## Implementation order

1. Add career timing and report contracts.
2. Update player generation and fixtures.
3. Implement annual development transition.
4. Implement retirement evaluation.
5. Add calibration runner and metrics.
6. Add strict schemas and report serialization.
7. Add worker execution.
8. Replace the fixture-backed UI.
9. Run calibration batches and establish accepted ranges.
10. Integrate the same transition functions into the future League Loop.

## Completion gate

The harness is ready for calibration acceptance when it can run this sequence
without manual repair:

```text
season N ends
  → players evaluate retirement
  → offseason completes
  → preseason development runs
  → season N+1 begins
```

Only after that path and the cohort distributions are accepted should career
transitions become authoritative gameplay behavior. Until then, the harness is
calibration infrastructure and its reports are evidence rather than saved
league state.
