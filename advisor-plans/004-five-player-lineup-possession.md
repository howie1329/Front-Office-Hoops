# Plan 004: Rebuild possession resolution around actual five-player lineups

> **Executor instructions**: This is item 4 in the recommended implementation
> sequence: “Rebuild possession resolution around actual five-player lineups.”
> Follow this plan after the semantic policy resolver in item 3 and the
> injury/reconciliation/fixture-validation baseline in item 2 are accepted.
> Keep the existing possession-based, no-play-by-play result contract.
>
> **Drift check (run first)**:
> `git diff --stat ddb57b6..HEAD -- packages/sim-v2/src/gameSimulation.ts packages/sim-v2/src/gamePolicy.ts packages/sim-v2/src/index.ts packages/sim-v2/tests/gameSimulation.test.ts packages/sim-v2/tests/gamePolicy.test.ts apps/web-v2/src/routes/developer-labs.game-matchup.tsx`
> If any in-scope file changed after this plan was written, compare the
> current-state excerpts below with the live code and stop on a material
> mismatch.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — this changes how player minutes, opportunities, and matchup context are generated
- **Depends on**: item 2 fixture/injury/reconciliation work and [Plan 003](003-semantic-policy-resolver.md)
- **Category**: bug
- **Planned at**: commit `ddb57b6`, 2026-07-31

## Why this matters

The current engine validates five starters and computes a normalized minute
target, but possession resolution selects creators, defenders, assist passers,
and rebounders from the entire active rotation. Player minutes are then assigned
after possessions in `finalizeMinutes`. That means a player can receive game
events without being on an actual five-player unit, and the final minutes do
not causally explain the opportunities that produced the box score.

This plan creates an internal lineup timeline and makes every possession use the
five players actually on the floor for each team. It keeps the existing public
rotation input, user-facing sliders, `GameResult` box-score shape, deterministic
seeds, and no-play-by-play storage. The next sequence item can then calibrate
offensive-rebound continuations and foul/assist rates against a real lineup
context instead of an all-rotation pool.

## Current state

- `packages/sim-v2/src/gameSimulation.ts:33–40` stores a `RotationPlan` with
  player IDs, active IDs, normalized target minutes, and listed starters, but no
  on-court lineup timeline.
- `packages/sim-v2/src/gameSimulation.ts:431–484` computes normalized target
  minutes from starters, depth, manual targets, availability, adherence, and
  starter workload. It does not use those minutes to choose a five-player
  unit during possessions.
- `packages/sim-v2/src/gameSimulation.ts:555–583` chooses offensive players
  from `plan.activePlayerIds`, which includes the whole active rotation.
- `packages/sim-v2/src/gameSimulation.ts:588–605` chooses players for a scope
  from the whole active rotation; this helper is used for defenders, assists,
  rebounds, and injuries.
- `packages/sim-v2/src/gameSimulation.ts:758–1042` resolves a possession, but
  it has no offense-lineup or defense-lineup argument. The defender, assist
  passer, and rebounder are therefore not restricted to five players on court.
- `packages/sim-v2/src/gameSimulation.ts:1174–1247` assigns final minutes from
  the target plan after the possession loop. It is not a ledger of the lineups
  that produced the possessions.
- `packages/sim-v2/src/gameSimulation.ts:1415–1467` initializes roles and
  rotation plans once; `:1470–1478` runs regulation and overtime without
  storing internal lineups in the state.
- `packages/domain-v2/src/types.ts:64–159` defines the existing rotation,
  availability, player box-score, and team box-score contracts. Do not add
  play-by-play or a permanent lineup field to these contracts for this plan.
- `docs/v2/plans/foh-v2-game-matchup-lab-implementation-plan.md:23–30` requires
  flexible role/opportunity assignment from lineup context, a possession model
  without play-by-play storage, and target minutes as goals affected by valid
  events.
- `packages/sim-v2/tests/gameSimulation.test.ts:143–181` covers seeded output
  and star opportunities; `:201–246` covers availability/minutes; `:452–519`
  covers player/team reconciliation and legal team minutes. These are the
  regression patterns to preserve.

## Commands you will need

| Purpose              | Command                                                               | Expected on success                           |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Simulation tests     | `npm test --workspace=@workspace/sim-v2`                              | All tests pass, including lineup tests.       |
| Simulation typecheck | `npm run typecheck --workspace=@workspace/sim-v2`                     | Exit 0.                                       |
| Calibration tests    | `npm test --workspace=@workspace/calibration`                         | All tests pass.                               |
| Web tests            | `npm test --workspace=web-v2`                                         | All tests pass.                               |
| Web typecheck        | `npm run typecheck --workspace=web-v2`                                | Exit 0.                                       |
| Web lint             | `npm run lint --workspace=web-v2`                                     | Exit 0.                                       |
| Slider sensitivity   | `npm run sensitivity-baseline --workspace=@workspace/calibration`     | All 29 settings still produce a valid report. |
| Formatting           | `node node_modules/prettier/bin/prettier.cjs --check <changed files>` | All files match Prettier.                     |
| Whitespace           | `git diff --check`                                                    | Exit 0 with no output.                        |

## Scope

### In scope

- `packages/sim-v2/src/lineup.ts` (new internal lineup planning/lookup module)
  or an equally small module under `sim-v2`.
- `packages/sim-v2/src/gameSimulation.ts` — state, possession inputs,
  lineup-restricted choices, actual-minute ledger, injury replacement, and
  overtime integration.
- `packages/sim-v2/src/gamePolicy.ts` and `src/index.ts` only as needed to
  consume Plan 003’s resolved policies; do not duplicate policy translation.
- `packages/sim-v2/tests/gameSimulation.test.ts` and a focused
  `packages/sim-v2/tests/lineup.test.ts`.
- Existing matchup-lab route only if a type-only change is required; no UI
  redesign or new lineup editor is part of this plan.

### Out of scope

- Any change to the public `GameMatchupFixture`, `GameResult`, player box-score,
  or team box-score schema unless a concrete consumer requires a minimal
  contract change and the scope is explicitly revisited.
- Play-by-play storage, possession-history UI, or a live game-watch screen.
- New offensive-rebound continuation rules, foul-rate calibration, assist-rate
  calibration, or global scoring calibration; those are item 5/7 work.
- New player traits, physical-effect model, coaching profile generation, or
  defender-assignment/switching model.
- Removing or changing rotation sliders, target-minute inputs, availability
  restrictions, or user access to the existing controls.
- V1 packages, season production/value, market, AI, or league lifecycle.

## Design contract

### Internal lineup timeline

Add an internal, non-serialized representation such as:

```ts
type LineupSegment = {
  startMinute: number
  endMinute: number
  playerIds: [string, string, string, string, string]
}

type LineupPlan = {
  segments: LineupSegment[]
  plannedMinutes: Record<string, number>
  actualMinutes: Record<string, number>
}
```

The exact type can differ, but the invariants are mandatory:

- every segment has exactly five distinct, available-at-selection players;
- regulation segments cover 48 team minutes; overtime adds the configured
  segment minutes;
- the timeline is deterministic for the fixture seed/config and does not
  consume the possession random stream while being built;
- manual targets, starter workload, bench usage, rotation adherence, depth
  order, minutes restrictions, and availability influence the plan through the
  resolved policy;
- listed `starter` on a player box score continues to mean “named starter in
  the fixture,” not “played every segment as a starter.”

Use minute buckets or deterministic possession-to-clock mapping rather than
storing every possession. A one-minute or similarly bounded internal segment
grid is acceptable if it preserves exact team-minute totals and keeps the
worker/batch runtime within the existing budget.

### Possession context

Change the internal possession signature to receive the current offense and
defense lineups plus the segment/clock context. Every player choice must be
restricted to the relevant five:

- creator/shooter: offense lineup only;
- defender: defense lineup only;
- assist passer: offense lineup only and never the shooter;
- offensive rebounder: offense lineup only;
- defensive rebounder: defense lineup only;
- in-game injury candidate: current on-court lineup or an explicitly documented
  active-player rule, but not an unrelated inactive player.

The initial implementation may preserve existing per-player skill formulas. It
must first make lineup membership causal. A small bounded lineup-context summary
(spacing, creation depth, defensive strength, rebounding strength) may be added
only after membership and accounting tests pass; it must consume Plan 003’s
policy and remain private to the engine.

### Minutes as a source of truth

Replace post-hoc target-only minute assignment with the actual lineup-minute
ledger. Build the planned timeline before possessions, update it when an
in-game injury removes a player, and derive each player’s final minutes from
the lineups actually used. Preserve exact team minutes and restrictions. If a
player leaves during a segment, use one deterministic boundary rule—end of the
current possession or the next clock bucket—and test that rule; do not mix
multiple approximations.

The result still need not expose lineup segments. Unit-test the pure lineup
planner directly and test game-level consequences through opportunities,
minutes, availability, and reconciliation.

## Steps

### Step 0: Freeze the current contract and prove the defect

Run the current characterization, reconciliation, and sensitivity tests. Add a
focused failing test or diagnostic fixture that demonstrates the current
problem: a bench player outside the five intended on-court players can receive
an opportunity/assist/rebound because selection uses `activePlayerIds`, while
final minutes are assigned later.

Use a fixture with five high-skill starters and three materially different bench
players so an all-rotation selection is observable. Do not assert an arbitrary
new score; assert membership/causality and existing accounting facts.

**Verify**: the baseline tests pass, and the new characterization demonstrates
the pre-change all-rotation behavior without changing production code outside
the planned scope.

### Step 1: Build and test the pure lineup planner

Implement `buildLineupPlan`/`lineupForClock` in the new internal module. Start
with regulation only, then add overtime. Use the normalized rotation plan from
the existing engine or move that normalization into the module without changing
its public behavior.

The planner should:

1. start with the declared five starters when all are available;
2. fill each subsequent segment from eligible depth-order players;
3. choose substitutions using remaining target minutes, starter/bench policy,
   adherence, and coach rotation depth;
4. ensure exactly five players per segment and no duplicates;
5. honor minutes-limited availability and never schedule an unavailable player;
6. produce an exact minute ledger that sums to 240 regulation team minutes.

Use deterministic tie-breaking from stable player/depth order, not the game
random source. Export the planner only if tests need a typed public function;
prefer an internal module.

**Verify**: `npm test --workspace=@workspace/sim-v2` passes with unit tests for
five-player segments, exact minute totals, target/adherence direction,
starter/bench changes, unavailable players, restrictions, and deterministic
repeated plans.

### Step 2: Thread lineup context through possession resolution

Add the current lineup to simulation state or resolve it from the timeline at
the beginning of each possession. Update `simulatePossession` and the choice
helpers so they never select from the whole active rotation when a lineup is
available.

Keep existing event branches and random scopes stable where possible. If a new
lineup lookup needs a random decision, use a named fork that includes team,
period, possession, and lineup purpose; do not consume random values while
building the deterministic timeline.

Update assist/rebound/defender selection first. Then update creator selection
and any coach/role calculations to use the five-player context. Preserve the
existing `GameResult` fields and player/team reconciliation.

**Verify**: a crafted fixture proves that only current-lineup players can
receive opportunities, assists, rebounds, steals, blocks, or fouls from a
possession; all existing game tests and reconciliation checks pass.

### Step 3: Replace post-hoc minutes with actual lineup minutes

Remove the target-only source of truth in `finalizeMinutes`. Record actual
lineup minutes as segments are used, or derive them once from the final
lineup/injury timeline using the single boundary rule from the design contract.

When an in-game injury occurs:

- mark the player unavailable as today’s engine already does;
- remove them from future lineups;
- promote the next eligible player deterministically;
- transfer only future minutes/opportunities;
- preserve the injury event’s `gamesRemaining` and reconciliation.

Do not allow a player to keep receiving possession stats after being removed.
Do not let the replacement mechanism exceed minutes restrictions or create a
six-player lineup.

**Verify**: standard, minutes-limited, overtime, and injury-enabled fixtures
reconcile; player-minute sums equal `period minutes × 5`; unavailable players
have zero post-injury stats/minutes; valid results remain completed.

### Step 4: Add minimal lineup effects only after membership is correct

Compare current lineup quality with the all-rotation behavior. If the engine
needs lineup context to make the rebuild meaningful, add small bounded summaries
from the five players only:

- spacing/shot-quality support from lineup shooting;
- creation support from passing/handling;
- defensive pressure/contest support from lineup defense/IQ;
- rebounding support from lineup rebounding/strength.

Use these summaries in existing shot-quality, assist, turnover, contest, and
rebound paths. Do not recalibrate global output or invent a new user slider.
Document which effect is intentionally deferred to item 5 or item 8.

**Verify**: matched lineup tests show a stronger lineup changes the intended
component direction, while 20–50 seeded games retain deterministic output,
legal minutes, and exact reconciliation.

### Step 5: Preserve the user-facing rotation contract

Run the matchup-lab route with the existing starter, depth, target-minute,
availability, and slider controls. Confirm the same fixture JSON remains valid
and no UI redesign is needed. If the internal lineup planner needs a new
diagnostic, keep it developer-only and do not expose play-by-play.

**Verify**: web tests, typecheck, and lint pass; the route still renders the
existing controls and changing a rotation input changes the effective fixture
without changing unrelated settings.

### Step 6: Re-run causality and record the handoff

Run Plan 003’s policy tests and the full Plan 002 slider sensitivity report.
Compare rotation adherence, bench usage, starter workload, fatigue, star usage,
ball movement, double-team, and defensive signals before/after. A lineup
rebuild may legitimately change effect sizes, but it must explain the change;
do not silently update baselines.

Record the new lineup invariants, seeded fixture, runtime, retained failures,
and any changed characterization values in a focused audit or the next game
calibration report.

**Verify**: all 29 slider paths still produce a valid report; no existing wired
control becomes an exact no-op; `git diff --check` is clean.

## Test plan

Add `packages/sim-v2/tests/lineup.test.ts` for the pure planner:

- exactly five unique players per segment;
- deterministic same-input output;
- exact regulation/overtime minute totals;
- starter/depth/target/adherence direction;
- unavailable starter rejection and available replacement;
- minutes restrictions and no over-limit allocation;
- injury replacement at the declared boundary.

Update `packages/sim-v2/tests/gameSimulation.test.ts` for integration:

- all possession participants belong to the active five-player unit;
- a bench player cannot receive stats while absent from every lineup segment;
- changing the lineup changes opportunity/defensive/rebound context without
  breaking reconciliation;
- in-game injury removes future participation;
- overtime uses five-player units and exact additional team minutes;
- same seed returns a deep-equal result.

If direct lineup membership cannot be observed from the public result without
adding a new result field, test the pure planner and use player opportunity,
minutes, and event invariants at the integration layer. Do not add a permanent
play-by-play field just to make a unit assertion easy.

## Done criteria

- [ ] An internal deterministic lineup timeline contains exactly five players
      for every regulation and overtime segment.
- [ ] Creator, defender, assist passer, rebounder, and injury selection are
      restricted to the relevant current five-player lineup.
- [ ] Player minutes come from actual lineup usage, not a disconnected
      post-hoc target allocation.
- [ ] Manual targets, adherence, starter workload, bench usage, availability,
      restrictions, injuries, and overtime remain honored.
- [ ] Player/team stats, minutes, availability, deterministic seeds, and
      reconciliation remain valid.
- [ ] Public fixture/result/schema/UI contracts and existing slider access are
      unchanged.
- [ ] No play-by-play storage, new slider, global stat calibration, or item-5
      foul/assist/ORB tuning is included.
- [ ] All V2 simulation/calibration/web tests, typechecks, lint, formatting,
      sensitivity baseline, and `git diff --check` pass.

## STOP conditions

Stop and report if:

- Plan 003’s resolver or item-2 validation contract is not present or does not
  match the current code.
- Exact five-player lineups require changing the public fixture/result schema
  or storing play-by-play.
- A valid available rotation cannot produce five players for a segment without
  inventing a player or violating a restriction.
- In-game injury handling requires a new multi-game lifecycle contract rather
  than the existing availability/event fields.
- Replacing post-hoc minutes causes unreconciled stats, nondeterminism, or a
  material global scoring change that belongs to the calibration plan.
- The implementation needs switching/mismatch logic, new traits, or a new UI
  surface to make progress.

## Maintenance notes

- Later offensive-rebound continuation work must use the current five-player
  lineup for rebounder selection and replacement possessions.
- Foul and assist calibration should be measured after this plan; otherwise
  all-rotation selection will contaminate those distributions.
- Any new player-on-court diagnostic should remain internal or explicitly
  versioned; do not casually expand `GameResult` into play-by-play.
- Season production should consume the resulting reconciled box scores, never
  recreate lineup or possession logic in the season runner.
