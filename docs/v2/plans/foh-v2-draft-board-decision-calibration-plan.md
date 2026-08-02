# Front Office Hoops v2 — Draft Board Decision Calibration Plan

**Status:** Implemented initial calibration slice; acceptance pending  
**Written against:** `10abaff`  
**Date:** August 1, 2026  
**Depends on:** [Draft & Decision Lab implementation plan](./foh-v2-draft-decision-lab-implementation-plan.md)  
**Primary surfaces:** `packages/domain-v2`, `packages/sim-v2`, `packages/calibration`, `packages/league-schema`, `apps/web-v2`

## Objective

Replace the current draft-board score with a stable, explainable, NBA-like
decision model:

1. Long-term expected player value is the dominant signal.
2. Current ability/floor and development upside change with team timeline.
3. Functional fit and roster need matter, but cannot override a major talent
   gap.
4. The public mock is a small information signal, not the team’s decision
   model.
5. Randomness creates disagreement only among genuinely close prospects.

The result should produce realistic disagreement between teams without making
AI picks feel arbitrary.

## Findings driving the change

The current implementation in
`packages/sim-v2/src/draftSimulation.ts` has three problems:

- `createDeterministicRandom(...).normal(0, boundedVariance)` is unbounded even
  though the setting is named `boundedVariance`.
- The current Team 02 export had a `+5.34` variance adjustment on its top
  prospect. Removing variance would have put another prospect first, so the
  random term directly flipped a meaningful evaluation gap.
- Need is scored as `need * needWeight / 100`, so a priority of 75 contributes
  only `0.09` points with the current `0.12` weight. It is effectively not a
  meaningful board input.

The export also exposed two adjacent correctness issues that should be fixed
with the board revision:

- Scouting ranges can exceed valid rating bounds, such as potential `90–102`.
- Public mock projected ranges are derived from player signal rather than
  draft position; the public rank-one prospect can receive a projected range
  of `29–48`.

## Product model

NBA teams do not use one universal rule. The model should represent a common
pattern:

- top-tier prospects are primarily evaluated on expected star value;
- current ability and role translation matter more for contenders and later
  picks;
- rebuilding teams accept more developmental risk;
- positional need is usually functional fit rather than a literal position
  quota;
- need is most influential when the leading prospects are close.

The model must not claim to reproduce a real front office. It should provide
credible team-timeline behavior and clear explanations.

## Proposed board model contract

### Replace raw score fields with explicit components

Extend `DraftDecisionConfig` with a versioned board model. Prefer a nested
contract so draft-run settings remain separate from scouting settings:

```ts
type DraftBoardModelConfig = {
  version: 2
  modeWeights: Record<DraftTeamMode, {
    floor: number
    expectedUpside: number
  }>
  maxNeedAdjustment: number
  maxPublicMockAdjustment: number
  maxRiskPenalty: number
  tieThreshold: number
  tieBreakMaxAdjustment: number
  tieBreakEnabled: boolean
}
```

The two mode weights must sum to one. The standard starting values are:

| Team mode | Floor | Expected upside |
|---|---:|---:|
| `rebuilding` | 0.35 | 0.65 |
| `balanced` | 0.50 | 0.50 |
| `contender` | 0.65 | 0.35 |

Starting adjustment ceilings:

- need/functional fit: `0–8` points;
- public mock: `0–3` points;
- risk: `0–5` points;
- tie-break adjustment: at most `±0.5` points;
- tie threshold: `1.0` point.

These are calibration starting points, not permanent gameplay constants.

### Calculate expected upside, not raw ceiling

For each prospect:

```text
upsideGap = max(0, estimatedPotential - estimatedCurrentAbility)
expectedUpside = currentAbility + potentialConfidence * upsideGap
```

If potential is unknown, `potentialConfidence` is zero and the model should
not pretend the ceiling is known. The report may still preserve the unknown
state for the user.

The base talent score is:

```text
talentScore =
  floorWeight * estimatedCurrentAbility +
  expectedUpsideWeight * expectedUpside
```

This lets a rebuilding team prefer a high-upside player while preventing a
low-confidence ceiling from completely replacing the player’s known floor.

### Add bounded fit and risk adjustments

```text
fitAdjustment = maxNeedAdjustment * need01 * roleFit01
publicAdjustment = maxPublicMockAdjustment * publicSignal01
riskPenalty = maxRiskPenalty * risk01
baseScore = talentScore + fitAdjustment + publicAdjustment - riskPenalty
```

`need01` should be based on functional roster need, not only primary position.
`roleFit01` should recognize primary and secondary positions and future lineup
compatibility. The score must report the actual point contribution so the lab
can demonstrate that need matters without overpowering talent.

Risk should combine only visible/team-report inputs in normal AI mode:

- volatility estimate;
- unknown development fields;
- injury-resistance estimate;
- role uncertainty;
- age/timeline mismatch when the lab exposes it.

Hidden truth may be used only in developer diagnostics and outcome evaluation.

### Restrict randomness to tie-breaking

Do not add Gaussian noise to every prospect’s score.

1. Compute and sort by `baseScore`.
2. Group adjacent prospects whose scores differ by no more than
   `tieThreshold`.
3. Apply deterministic seeded noise only within each tie group.
4. Clamp that noise to `±tieBreakMaxAdjustment`.
5. Never allow tie-break noise to move a prospect across a non-tied score
   boundary.

When `tieBreakEnabled` is false, the board must be completely deterministic
from reports, team profile, public mock, and config.

The board score should distinguish:

```ts
type DraftBoardScore = {
  base: number
  final: number
  floor: number
  expectedUpside: number
  fit: number
  publicMock: number
  risk: number
  tieBreak: number
  tieGroup: string | null
}
```

## Implementation phases

### Phase 0 — Freeze the current behavior as a regression fixture

1. Add a fixed `draft-lab-001` fixture with the current report set, Team 02
   profile, board, picks, and JSON export.
2. Record the current top-five board, selected picks, and score components as a
   pre-change diagnostic only; do not preserve the current noisy rankings as a
   target.
3. Add a focused test proving the existing run is reproducible before the
   model version changes.

**Exit criteria:** the model revision can be compared against the exact same
class, reports, team profile, and draft order.

### Phase 1 — Correct report and public-mock ranges

Files:

- `packages/sim-v2/src/draftSimulation.ts`
- `packages/domain-v2/src/draft.ts`
- `packages/league-schema/src/draft.ts`

Work:

1. Clamp numeric scouting ranges to each field’s valid domain.
2. Add explicit field-domain helpers rather than a global `0–100` clamp for
   measurements such as height, weight, and wingspan.
3. Redefine public mock `projectedRange` as a draft-slot range centered on the
   public rank, with wider ranges for weaker public confidence.
4. Keep public mock rank and projected pick range separate from the player’s
   talent signal.
5. Add schema/tests proving no safe or developer report contains invalid
   ranges.

**Exit criteria:** rank-one public prospects receive plausible early-pick
ranges, and no rating range exceeds `0–100`.

### Phase 2 — Implement the versioned board model

Files:

- `packages/domain-v2/src/draft.ts`
- `packages/sim-v2/src/draftSimulation.ts`
- `packages/sim-v2/src/index.ts`
- `packages/league-schema/src/draft.ts`

Work:

1. Add `DraftBoardModelConfig` and standard mode presets.
2. Bump the draft decision model version without changing the general league
   schema version.
3. Replace the existing raw score formula with expected upside, fit, public,
   and risk components.
4. Remove Gaussian score noise from normal ranking.
5. Implement tie-group-only deterministic variance.
6. Keep rookie contract cost out of ranking.
7. Preserve score explanations and strongest alternatives.
8. Add `baseRank`, `finalRank`, and tie-group metadata if needed for debugging.

**Exit criteria:** changing only the seed cannot move a clearly separated
prospect over another; changing team mode can change close decisions in the
expected direction; all score components sum to the final score.

### Phase 3 — Add matched decision experiments

Files:

- `packages/calibration/src/draft.ts`
- new `packages/calibration/src/draftBenchmarks.ts`
- `packages/calibration/src/index.ts`

Add paired runs using the same generated class, reports, teams, and draft order:

1. **Variance on/off:** measure how often picks change and whether changes are
   confined to tie groups.
2. **Mode comparison:** run the same team as rebuilding, balanced, and
   contender.
3. **Need comparison:** compare neutral needs to a strong functional need.
4. **Public signal comparison:** remove or increase the public mock signal.
5. **Scout comparison:** weak, average, and strong private reports.
6. **Current/upside sweep:** vary floor/upside weights while holding the class
   constant.

Every report should retain:

- seed and model version;
- effective config;
- base and final ranks;
- changed picks between paired arms;
- tie-group membership;
- score-component deltas;
- true developer-only outcome metrics when full runs are retained.

### Phase 4 — Establish calibration gates

Initial directional gates:

- repeated identical seeds produce identical boards and picks;
- tie-break off produces identical picks across repeated runs;
- no tie-break change crosses a base-score gap greater than the configured
  threshold;
- disabling variance changes only a small minority of picks, concentrated in
  close score bands;
- rebuilding teams select higher expected-upside players than contenders in
  matched scenarios;
- contenders select higher current-floor players than rebuilding teams in
  matched scenarios;
- need changes picks mainly when talent scores are close;
- public mock changes picks less often than private scouting changes picks;
- strong-scout arms outperform weak-scout arms on hidden developer outcomes;
- no pick is illegal, duplicated, or left unfilled.

The exact percentages should be set after running at least 100 deterministic
classes. Do not promote thresholds from a single 75-player class.

### Phase 5 — Update exports and diagnostics

Files:

- `packages/domain-v2/src/draft.ts`
- `packages/league-schema/src/draft.ts`
- `apps/web-v2/src/routes/developer-labs.draft-decision.tsx`

Full developer export should include:

- board model version and effective config;
- base/final score components;
- tie groups and tie-break values;
- pre-draft and final ranks;
- paired-arm diagnostics;
- hidden truth and realized outcomes.

Selected-team-safe export should include:

- the selected team’s effective board model settings;
- visible score components and rationale;
- public mock and selected-team report;
- no hidden truth, other-team private reports, or internal random seeds beyond
  the run seed.

Add safe-export leakage tests for new hidden fields.

### Phase 6 — Improve the lab UI

Files:

- `apps/web-v2/src/routes/developer-labs.draft-decision.tsx`
- `apps/web-v2/src/lib/draftDecisionWorker.ts`
- `apps/web-v2/src/workers/draft-decision.worker.ts`

Add:

1. A board-model summary showing floor, expected upside, fit, public, risk, and
   tie-break contributions.
2. A “why this pick” panel that clearly distinguishes talent, development
   confidence, fit, and tie-breaking.
3. A base-rank versus final-rank indicator.
4. A matched-scenario comparison for variance on/off and team modes.
5. A calibration warning when a run uses developer-only truth.
6. A visible indication when the user has manually overridden mode, needs, or
   board order.

Do not make the UI own scoring logic. It should render typed worker results.

### Phase 7 — Acceptance and documentation

1. Run 100-class and 500-class batches with the standard model.
2. Review distributions for all three team modes and scout tiers.
3. Inspect failed seeds and retain representative outliers.
4. Update the Draft & Decision implementation plan status and V2 current-state
   route inventory.
5. Add the calibration report to the V2 audits/evidence index.
6. Keep V1 untouched and verify the existing V2 package boundaries.

## Non-goals

- no pick trading, protections, or lottery redesign;
- no interviews, workouts, or changing reports during the draft;
- no contract-value input into the board;
- no generic AI lab;
- no authoritative LeagueDocument draft lifecycle;
- no attempt to reproduce a real NBA front office exactly;
- no large stochastic noise term used to manufacture team disagreement.

## Verification commands

Focused:

```bash
npm run test --workspace=@workspace/sim-v2
npm run test --workspace=@workspace/calibration
npm run test --workspace=@workspace/league-schema
npm run test --workspace=web-v2
npm run typecheck
npm run lint --workspace=web-v2
npm run build --workspace=web-v2
```

Calibration acceptance:

```bash
# Command/API to be added with the batch benchmark implementation.
# Run at least 100 standard classes and retain failed/outlier seeds.
```

## Completion criteria

This plan is complete when:

- the board model is versioned and reproducible;
- potential is confidence-adjusted expected upside rather than raw ceiling;
- current ability, team mode, fit, public signal, and risk each have visible
  bounded contributions;
- variance only affects close prospects and cannot override a clear gap;
- 100-class matched calibration confirms the intended mode/need/scout
  directionality;
- safe and full exports preserve the distinction between visible reports and
  hidden truth;
- the Draft Lab explains why a team selected a player in terms a user can
  understand.
