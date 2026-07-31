# Plan 003: Introduce a semantic game-policy resolver without changing the slider schema

> **Executor instructions**: This is item 3 in the recommended implementation
> sequence: “Introduce the semantic policy resolver while preserving the
> existing slider schema.” Follow the steps in order. The resolver is an
> internal translation layer; it must not expose raw coefficients or change
> the user-facing settings contract.
>
> **Drift check (run first)**:
> `git diff --stat ddb57b6..HEAD -- packages/sim-v2/src/gameConfig.ts packages/sim-v2/src/gameSimulation.ts packages/sim-v2/src/index.ts packages/sim-v2/tests/gameSimulation.test.ts packages/sim-v2/tests/gameConfig.test.ts apps/web-v2/src/routes/developer-labs.game-matchup.tsx`
> If any in-scope file changed after this plan was written, compare the
> current-state excerpts below with the live code. Stop on a material mismatch.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED — a translation error can change every game while appearing to preserve config values
- **Depends on**: the accepted characterization/injury/reconciliation baseline from items 1–2
- **Category**: tech-debt
- **Planned at**: commit `ddb57b6`, 2026-07-31

## Why this matters

The public game config is already semantic—pace, shot selection, help defense,
rotation adherence, and coaching influence—but the simulation currently reads
those values directly in many unrelated functions. That makes it difficult to
tell whether a slider means “more possessions,” “more rim attempts,” “more
pressure,” or merely a raw coefficient at one call site. It also makes later
lineup and possession work likely to duplicate or reinterpret slider semantics.

This plan creates one typed, deterministic resolver from the existing config and
coaching profiles to internal game policies. The first implementation must be
behavior-preserving: it reorganizes meaning and adds tests before any
calibration or formula changes. Users keep the same 29 controls, labels, bounds,
preset behavior, and JSON schema.

## Current state

- `packages/sim-v2/src/gameConfig.ts:71–344` defines the 29 numeric descriptors
  and the existing public `GameSimulationConfig` contract. The route and
  calibration harness already use typed numeric paths.
- `packages/sim-v2/src/gameConfig.ts:398–422` normalizes public config values
  and resolves the selected preset. It does not produce a domain-specific
  policy object.
- `packages/sim-v2/src/gameSimulation.ts:174–184` contains the only current
  effective coach-profile helper; other functions read raw config values
  directly.
- `packages/sim-v2/src/gameSimulation.ts:431–484` builds normalized target
  minutes; `:555–583` chooses an offensive player; `:607–666` chooses a shot;
  `:758–1042` resolves a possession; and `:1045–1105` creates periods. These
  functions each apply their own arithmetic to public settings.
- `packages/sim-v2/src/gameSimulation.ts:1415–1467` creates simulation state
  after config normalization, but the state contains no resolved semantic
  policy object.
- `packages/sim-v2/tests/gameSimulation.test.ts:136–181` and
  `:223–356` provide deterministic and directional behavior tests. The
  characterization test at `:358–450` protects the current seeded output.
- `apps/web-v2/src/routes/developer-labs.game-matchup.tsx:54–75` renders the
  same descriptor-driven paths and must not be redesigned or renamed.

The resolver must honor the V2 constraints: semantic bounded settings, neutral
values centered at 50, deterministic random scopes, private coefficients,
coaching that amplifies profiles without overpowering player talent, and no
dependency from `sim-v2` back to `calibration`.

## Commands you will need

| Purpose              | Command                                                               | Expected on success                                   |
| -------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Simulation tests     | `npm test --workspace=@workspace/sim-v2`                              | All tests pass, including unchanged characterization. |
| Simulation typecheck | `npm run typecheck --workspace=@workspace/sim-v2`                     | Exit 0.                                               |
| Calibration tests    | `npm test --workspace=@workspace/calibration`                         | All tests pass.                                       |
| Web typecheck        | `npm run typecheck --workspace=web-v2`                                | Exit 0.                                               |
| Web lint             | `npm run lint --workspace=web-v2`                                     | Exit 0.                                               |
| Slider evidence      | `npm run sensitivity-baseline --workspace=@workspace/calibration`     | Existing 29-setting report still completes.           |
| Formatting           | `node node_modules/prettier/bin/prettier.cjs --check <changed files>` | All files match Prettier.                             |
| Whitespace           | `git diff --check`                                                    | Exit 0 with no output.                                |

## Scope

### In scope

- `packages/sim-v2/src/gamePolicy.ts` (new) or an equally small internal
  policy module.
- `packages/sim-v2/src/gameSimulation.ts` to resolve and consume the policy.
- `packages/sim-v2/src/gameConfig.ts` only for shared public types/helpers if
  required; do not change descriptor semantics.
- `packages/sim-v2/src/index.ts` only if a non-private policy type is needed by
  focused tests; prefer keeping formula/policy types private.
- `packages/sim-v2/tests/gameSimulation.test.ts` and a new focused policy test.
- `packages/sim-v2/tests/gameConfig.test.ts` only for public config preservation.

### Out of scope

- Any change to `packages/domain-v2` or the league-schema config shape.
- Any UI redesign, slider removal, renamed setting, range/step change, or raw
  coefficient exposure.
- Global output calibration, standard-preset retuning, new player traits,
  lineup reconstruction, offensive rebound continuations, or foul/assist
  recalibration. Those belong to later sequence items.
- Switching/defender-assignment modeling.
- V1 packages, production/value, season execution, market, or league lifecycle.

## Target policy boundary

Create one pure resolver with a shape similar to:

```ts
type ResolvedGamePolicy = {
  environment: {
    pace: number
    scoring: number
    variance: number
    talentSeparation: number
    homeCourt: number
  }
  offense: {
    shotProfile: { three: number; rim: number; midrange: number }
    discipline: number
    starUsage: number
    ballMovement: number
    isolation: number
    transition: number
    offensiveRebounding: number
  }
  defense: {
    pressure: number
    help: number
    turnoverPressure: number
    doubleTeam: number
    foulDiscipline: number
  }
  rotation: {
    adherence: number
    benchUsage: number
    starterWorkload: number
    fatigue: number
  }
  coaching: {
    offense: GameCoachingProfile
    defense: GameCoachingProfile
    paceInfluence: number
    shotSelectionInfluence: number
    defensiveInfluence: number
  }
  injuries: {
    frequency: GameInjuryFrequency
    maxGamesOut: number
    inGameEnabled: boolean
  }
}
```

The exact internal names may differ, but the boundary must satisfy these rules:

- It accepts the normalized `GameSimulationConfig` plus the relevant coaching
  profiles and returns a complete policy object with no missing slider path.
- It is pure and deterministic; it does not consume random state or mutate the
  fixture/config.
- Neutral 50 values produce neutral deltas. Each policy documents its neutral
  point and bounded output range.
- Public settings map to the policy once. Possession/rotation functions read
  the policy, not raw config arithmetic scattered across call sites.
- `defense.switching` remains represented as an explicit deferred/unused
  policy field or diagnostic; do not invent a multiplier merely to claim it is
  wired.

## Steps

### Step 0: Freeze behavior before extraction

Run the existing simulation characterization and slider sensitivity reports.
Capture the current seeded result fingerprint and the current classification
table. Search all `gameSimulation.ts` config reads and make a mapping table from
each public path to its target policy field and consuming function.

If a path has no legitimate policy meaning, record it as deferred rather than
silently mapping it to a neighboring setting.

**Verify**: current simulation tests pass, the sensitivity report completes,
and the mapping table covers all 29 descriptors exactly once.

### Step 1: Implement the pure resolver

Add the internal policy module. Use small helpers for centered values, bounded
interpolation, and normalized shot/rotation weights. Keep raw coefficients in
the module, not in `GameSimulationConfig` or the UI. Resolve the effective coach
profile there, including overall influence and the domain-specific pace,
shot-selection, and defensive influence gates already introduced by Plan 002.

Do not add new gameplay effects in this step. The resolver should translate
existing semantics into a named object; a reviewer must be able to compare each
old expression with its new policy field.

**Verify**: add pure unit tests for neutral values, min/max bounds, coach
influence at 0/50/100, no mutation of config/profile inputs, and deterministic
repeated calls. `npm test --workspace=@workspace/sim-v2` passes.

### Step 2: Store and consume one resolved policy per simulation

Resolve the policy after `resolveGameSimulationConfig` in
`createSimulationState`. Replace direct reads in these functions with policy
reads, in order:

1. `buildRotationPlan`;
2. `chooseOffensivePlayer`;
3. `attemptType`;
4. `simulateFreeThrows` and `maybeCreateInjury`;
5. `simulatePossession`;
6. `createPeriods` and overtime.

Leave the public `GameSimulationConfig` on the fixture/result boundary. The
policy is internal and must not be serialized into `GameResult` unless an
existing diagnostic contract explicitly needs a safe semantic label.

**Verify**: the characterization fingerprint is unchanged, reconciliation and
minutes invariants remain green, and `rg` shows no unreviewed direct reads of
numeric gameplay settings outside the resolver/config-normalization boundary.

### Step 3: Add policy-level diagnostics without raw coefficients

Add only safe diagnostics that explain semantic behavior, such as effective
pace band, active rotation mode, or coach profile influence state. Do not expose
random draws or exact internal weights. If diagnostics are not needed by a
current consumer, keep them test-only rather than expanding the result schema.

**Verify**: serialized `GameResult` and matchup reports remain schema-valid;
no report contains raw policy coefficients or random scopes.

### Step 4: Prove public contract preservation

Exercise the same route/config helper path used by the user-facing sliders.
Verify each descriptor still has the original label, min, max, step, and path;
one update marks the config custom and leaves unrelated sections unchanged.
Run the full sensitivity baseline and compare classifications/deltas. A
behavior-preserving extraction must not cause a wired setting to become a
no-op or change the meaning of a conditional setting.

**Verify**: calibration and web tests/typecheck/lint pass; all 29 descriptors
appear exactly once in the sensitivity report.

## Test plan

Add a focused `packages/sim-v2/tests/gamePolicy.test.ts` if the resolver is a
new module. Cover:

- every public setting has one policy mapping;
- neutral values return neutral centered deltas;
- min/max values remain bounded;
- coach profiles are neutralized at overall influence 0 and preserve their
  signed direction at influence 100;
- resolver calls do not mutate config or coach objects;
- repeated calls return deep-equal policies.

Update `gameSimulation.test.ts` only where a current behavioral assertion needs
to prove the policy is consumed. Keep the existing exact characterization test
as the regression guard. Model test fixtures on the existing `createFixture`
and `runSeries` helpers.

## Done criteria

- [ ] One pure resolver maps all 29 public numeric settings and relevant coach
      fields to named internal semantic policies.
- [ ] Simulation state resolves the policy once and downstream functions do not
      reinterpret public settings independently.
- [ ] Existing seeded characterization, reconciliation, availability, minutes,
      and sensitivity results remain stable.
- [ ] Public schema, labels, bounds, steps, custom-preset behavior, and slider
      access are unchanged.
- [ ] Switching remains explicitly deferred rather than receiving a placeholder
      multiplier.
- [ ] Simulation tests, calibration tests, typechecks, web lint, formatting,
      and `git diff --check` pass.

## STOP conditions

Stop and report if:

- Extracting the resolver changes the current characterization before a later
  calibration plan intentionally changes it.
- A setting cannot be assigned a distinct semantic policy without inventing a
  new gameplay behavior; mark it deferred instead.
- The resolver requires importing `calibration` into `sim-v2` or exposing raw
  coefficients through domain/schema/UI types.
- A policy requires actual lineup state, offensive-rebound continuation, or a
  new event model; defer that work to Plan 004/005.

## Maintenance notes

- Every new visible game slider must add one resolver mapping, one neutral/bound
  test, and one sensitivity expectation.
- Later possession work should consume resolved policy values rather than public
  config fields directly.
- Keep semantic policy names stable even if internal coefficients change; the
  policy boundary is the review point for future calibration.
