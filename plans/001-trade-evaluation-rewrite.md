# Plan 001: Replace trade evaluation with projected player, contract, and team utility layers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9cca4ca..HEAD -- packages/sim/src/playerValue packages/sim/src/trades.ts packages/sim/src/teamStrength.ts packages/sim/src/selectRotation.ts packages/sim/tests packages/shared/src`
> If any in-scope file changed since this plan was written, compare the Current state excerpts with the live code. If their responsibilities or public shapes materially changed, STOP and report.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — this changes core AI behavior and financial incentives in persisted leagues.
- **Depends on**: none
- **Category**: direction / correctness
- **Planned at**: commit `9cca4ca`, 2026-07-10

## Why this matters

The current evaluator can accept a trade where an AI team sends a younger, higher-OVR player for an older, lower-OVR player with a only slightly smaller salary. This happens because player worth, contract surplus, team strategy, and roster fit are compressed into one scalar without evaluating the post-trade roster. The target architecture separates (1) basketball value independent of contract, (2) full-contract value, and (3) team-specific trade utility, so the AI can reject an obvious downgrade while still allowing genuine salary dumps and contender moves.

The product is a serious, analytical front-office simulator: trade decisions must be explainable and credible. Preserve legal transaction behavior; replace the valuation and AI-acceptance layer behind it.

## Current state

### Existing player worth and contract asset logic

`packages/sim/src/playerValue/index.ts` currently contains all player and contract value logic. Its key behavior is:

```ts
// index.ts:44-66, 142-156
const upside = Math.max(0, player.ratings.potential - player.ratings.overall)
// Upside is zero after age 27.

if (player.age <= 29) return 0
if (player.ratings.overall >= 78) {
  return Math.max(0, player.age - 32) * 0.8
}
return Math.max(0, player.age - 29) * 1.5

const total = talent + upside + archetype + scarcity - risk + marketPremium * 3
```

An elite 31-year-old receives no age penalty. `calculateContractValue` is an alias for player worth, despite its name. The current contract asset evaluator only reads `yearlySalaries[0]` and `yearlySalaries.length`:

```ts
// index.ts:245-275
const actualSalary = contract?.yearlySalaries[0] ?? expectedSalary
const yearsRemaining = contract ? getYearsRemaining(contract) : 0
const salaryDelta = expectedSalary - actualSalary
const surplusValue = salaryDelta * Math.sqrt(Math.max(1, yearsRemaining))
return { total: playerValue + surplusValue - riskPenalty, ... }
```

### Existing trade evaluator

`packages/sim/src/trades.ts` validates legality, then values every asset against each team's current roster. It has separate strategy adjustments for expiring and expensive contracts, which duplicates contract concerns:

```ts
// trades.ts:359-367, 397-405
case "selling":
  return upside * 0.45 +
    (player.age <= 24 ? 5 : 0) +
    (isExpiring ? 5 : 0) -
    (player.age >= 31 ? 6 : 0) -
    (longExpensiveDeal ? 8 : 0)

value = getContractAssetValueBreakdown(...).total +
  strategyPlayerAdjustment(mode, player, contract) +
  rosterFitValue(team, player, mode)
```

`rosterFitValue` counts positions/archetypes on the existing roster rather than constructing the roster after the proposed transaction. `wouldAiAcceptTrade` accepts when `netValue` clears a mode-specific threshold; selling teams currently allow a negative result.

### Existing reusable building blocks

- `packages/sim/src/selectRotation.ts` produces automatic rotation minutes from an active roster. Use it to evaluate the actual post-trade rotation.
- `packages/sim/src/teamStrength.ts` has deterministic, minute-weighted offense and defense factor helpers. Reuse or extend these helpers; do not use random game simulation in a trade evaluation.
- `packages/sim/src/playerValue/archetypeMarket.ts` provides league-wide archetype supply and a market premium. Retain it only as a small, explicitly labeled market component.
- `packages/sim/src/draft/pickValues.ts` already values picks by draft class / standings. Continue using it as the pick-asset input.
- `packages/sim/src/financials/teamStrategy.ts` defines `selling`, `buying`, and `contending`. Per the approved strategy design, mode means franchise direction; tax tolerance means willingness to spend. Do not collapse those meanings.

### Existing tests and commands

- Use `packages/sim/tests/playerValue.test.ts` as the unit-test pattern for player/contract value.
- Use `packages/sim/tests/trades.test.ts` as the integration-test pattern for trade validation and AI acceptance.
- Run `npm run typecheck` from the repo root.
- Run `npm run test --workspace=@workspace/sim` for the relevant test suite. It currently passes. Do not use the root `npm run test` as a done gate: `@workspace/db` has a known stale schedule-count assertion unrelated to this plan.

## Target architecture and terminology

Create three explicit layers. Do not reintroduce a catch-all `valuePlayerForTeam` with hidden contract and strategy weights.

```ts
// Intrinsic basketball asset, independent of the current contract or destination team.
type ProjectedPlayerValueBreakdown = {
  currentContribution: number
  futureContribution: number
  developmentOrDecline: number
  durabilityRisk: number
  archetypeMarket: number
  projectedSeasons: Array<{ seasonOffset: number; projectedOverall: number; value: number }>
  total: number
}

// Full financial value of the current contract for one specific team.
type ContractValueBreakdown = {
  annual: Array<{ seasonOffset: number; salary: number; expectedContribution: number; discountedNet: number }>
  optionValue: number
  taxImpact: number
  total: number
}

// Difference between a team before and after a particular trade.
type TeamTradeUtilityBreakdown = {
  incomingAssetValue: number
  outgoingAssetValue: number
  rotationDelta: number
  rosterBalanceDelta: number
  strategyDelta: number
  dominancePenalty: number
  total: number
  reasons: string[]
}
```

Numeric scale requirement: choose and document one scale where player, contract, pick, and team-utility values are comparable. Keep a 5–7 OVR / five-to-six-year age advantage materially larger than a $3–4M one-year salary difference. Use named constants with comments describing the intended basketball meaning, not unexplained magic multipliers.

## Scope

**In scope**:

- `packages/sim/src/playerValue/index.ts` — replace legacy scalar exports with compatibility wrappers only where needed.
- `packages/sim/src/playerValue/projectedValue.ts` — create projected basketball value.
- `packages/sim/src/playerValue/contractValue.ts` — create full-contract value.
- `packages/sim/src/tradeEvaluation.ts` or `packages/sim/src/trades/evaluation.ts` — create team-specific utility and dominance rules. Prefer `trades/evaluation.ts` if splitting `trades.ts`; keep a small `trades.ts` re-export facade until callers are migrated.
- `packages/sim/src/trades.ts` — route `evaluateTrade` and `wouldAiAcceptTrade` through the new evaluator without changing legality/execution behavior.
- `packages/sim/src/teamStrength.ts` and/or a new pure deterministic roster-evaluation helper — only as needed for post-trade rotation value.
- `packages/sim/src/index.ts` — export public types/functions needed by the web trade route.
- `packages/sim/tests/playerValue.test.ts`, `packages/sim/tests/trades.test.ts`, and new focused test files.
- `apps/web/src/routes/league/trades.tsx` — only to consume the new structured AI decision reason if the return type changes. Do not redesign the page in this plan.

**Out of scope**:

- Trade legality: salary matching, TPE behavior, roster-size rules, trade dates, ownership transfer, trade execution, and moratoriums.
- Draft-pick valuation redesign.
- AI-to-AI trades, counteroffers, and a new trade-search algorithm.
- Player mood, trade requests, owner-event effects, or narrative output.
- Altering game simulation, player development, persistence schema, or existing user-created league data.
- The known DB schedule test failure.

## Git workflow

- Create a branch with the repo convention: `codex/trade-evaluation-rewrite`.
- Make one commit per phase or tightly coupled logical unit. Recent repository history uses imperative messages such as `Implement v1 financials, market dynamics, and trade system`.
- Do not push, open a PR, or modify files outside Scope unless the operator explicitly requests it.

## Steps

### Step 1: Establish characterization scenarios before changing behavior

Create `packages/sim/tests/tradeEvaluation.test.ts`. Build deterministic fixtures with `createLeague` / existing player test helpers, then explicitly set ages, ratings, potential, archetypes, contracts, contract lengths, team strategy, and team payroll where relevant.

Add these named cases:

1. **Regression case**: an AI team must reject sending an 87 OVR, age-25/26 player for an 81 OVR, age-31 player of the same position/archetype when the incoming salary is only $3–4M lower. Test both an expiring old contract and a multi-year old contract. This must be a rejecting case for all modes unless a meaningful pick is added.
2. **Real salary dump**: a selling team may accept an older, inferior player only when it also receives enough pick value or exits a genuinely harmful multi-year contract.
3. **Contender upgrade**: a contender may trade a younger lower-OVR prospect plus modest future value for a clearly superior current player if post-trade rotation value increases.
4. **No bundle exploit**: several low-value players cannot equal a star just because their scalar totals add up.
5. **Same-position replacement**: a replacement at the same position/archetype is judged against the outgoing player, not just against the team’s pre-trade positional count.

The first test should initially fail after it asserts desired behavior. Do not weaken it to match current behavior.

**Verify**: `npm run test --workspace=@workspace/sim -- tradeEvaluation.test.ts` → the new regression assertion fails for the old evaluator, proving the test distinguishes old from desired behavior.

### Step 2: Build projected player value, independent of contract and destination

Create `packages/sim/src/playerValue/projectedValue.ts` with pure functions and types. It must not accept a `Contract`, `TeamWithRoster`, or `TeamMode`.

Implement a three-season forecast:

- Season 0 uses current overall plus bounded `performanceDrift`.
- Seasons 1 and 2 use age relative to `peakAge`, potential headroom, `developmentMomentum`, and `injuryHistory` to project bounded growth or decline. Reuse existing player-development assumptions/constants where they are already explicit; do not invent a second random development engine.
- Apply an age curve from the player’s early 20s through decline. A high-OVR player must begin losing future value before age 32; the curve can respect a star’s slower decline but cannot be flat through age 31.
- Discount future seasons with named discount constants.
- Add a modest archetype/market term using the existing archetype-market module. It must not overwhelm a material OVR/age gap.
- Add injury/durability risk from the player’s existing injury history and current injury status. Do not make random injury rolls in the evaluator.

Expose `getProjectedPlayerValueBreakdown(player, { league? })` and `getProjectedPlayerValue(player, context?)`. Replace the existing `getPlayerWorth` implementation with a compatibility wrapper around this new function only after callers are migrated. Keep fair salary based on intrinsic projected player value, not the current contract.

Add focused unit tests proving:

- 87 OVR age 25 with comparable skills/potential is worth more than 81 OVR age 31.
- At equal OVR, a 25-year-old is worth more than a 31-year-old; the gap grows when the older player is on the downside of `peakAge`.
- A 31-year-old elite player remains valuable but not age-neutral.
- Potential, current performance drift, archetype scarcity, and injury history have bounded, directional effects.
- No forecast returns ratings outside the shared rating bounds.

**Verify**: `npm run test --workspace=@workspace/sim -- playerValue.test.ts tradeEvaluation.test.ts` → all new player-value tests pass; the Step 1 regression may still fail until Steps 3–4.

### Step 3: Replace first-year surplus with full-contract value

Create `packages/sim/src/playerValue/contractValue.ts`. Its input must include the player, contract, season financials, receiving team finance, and intrinsic projected-player-value breakdown. Its output is a financial asset value; it must not add roster fit or team strategy bonuses.

For each remaining contract year:

- Read the actual salary from `contract.yearlySalaries[seasonOffset]`.
- Read the corresponding projected player contribution from Step 2.
- Convert expected contribution into a fair annual salary using the canonical salary mapper and the season’s cap context. If the current code does not retain financials for every contract year, calculate missing future season financials from base cap/growth using the existing cap helper rather than assuming today’s cap forever.
- Calculate discounted net contribution minus salary.
- Apply tax impact once, using the receiving team’s payroll and tax tolerance.
- Add an explicit, bounded option value for team/player options if the option falls within the remaining term. If option semantics cannot be evaluated from the persisted contract data, set option value to zero and document the limitation rather than guessing.

Remove the existing square-root years multiplier and `riskPenalty` formula. Do not retain the expiring/long-expensive logic as a second adjustment in `trades.ts`; the full contract calculation replaces it.

Keep `getContractAssetValueBreakdown` as a temporary adapter only if the web app still imports it. Its values must come from the new contract evaluator and it must be marked for removal after UI migration.

Add tests covering:

- Same player: a three-year overpay is worse than a one-year overpay.
- Same player: a bargain multi-year contract is worth more than the same salary as a one-year contract, but not enough to outweigh a major age/OVR downgrade on its own.
- A $3–4M one-year saving does not exceed the intrinsic projected-value gap between the regression players.
- Tax-averse and all-in teams see different financial impact, while intrinsic player value remains identical.

**Verify**: `npm run test --workspace=@workspace/sim -- playerValue.test.ts tradeEvaluation.test.ts` → all player and contract assertions pass.

### Step 4: Evaluate the team before and after the proposed trade

Create a deterministic roster evaluator in `packages/sim/src/trades/evaluation.ts` or `packages/sim/src/tradeEvaluation.ts`.

For each team in a proposal:

1. Construct its post-trade roster by removing outgoing players and adding incoming players. Do not mutate the source league.
2. Use `selectRotation` to derive the same automatic rotation shape used by the game engine.
3. Use deterministic, minute-weighted team-strength helpers to calculate current and post-trade rotation strength. Do not run `simulateGame` or consume RNG.
4. Calculate roster-balance delta from position coverage, archetype redundancy, and top-rotation depth on the post-trade roster.
5. Compute incoming and outgoing asset values from Step 2 + Step 3; picks continue to use `getPickValueFromCache`.
6. Apply a small, explicit strategy term only for franchise objectives that are not already captured by contract or rotation value. Examples: sellers value near-term first-round picks more; contenders value current rotation strength more. Never add a second generic age, expiring-contract, or expensive-contract bonus here.
7. Return a structured `TeamTradeUtilityBreakdown` with named components and human-readable reason codes.

Add a dominance rule before threshold comparison. Reject an incoming package as a dominated replacement when all are true:

- It replaces an outgoing core-rotation player with a player at the same position/archetype;
- Incoming player has materially lower projected player value;
- Incoming player is older or has equal/worse future projection;
- The package does not contain enough pick/contract relief to cover the documented dominance threshold.

The threshold must be expressed in the common value scale and covered by tests. It must reject the reported 87/25 for 81/31, ~$3–4M difference scenario.

**Verify**: `npm run test --workspace=@workspace/sim -- tradeEvaluation.test.ts` → all five characterization scenarios pass, including the regression case for every mode.

### Step 5: Route `evaluateTrade` and AI acceptance through utility breakdowns

Update `packages/sim/src/trades.ts` so:

- `evaluateTrade` calls the new evaluator once for each team and maps its total into the existing `TradeEvaluation` compatibility shape.
- Add a new public detailed evaluator, for example `evaluateTradeUtility`, returning both teams’ `TeamTradeUtilityBreakdown` objects.
- `wouldAiAcceptTrade` first runs trade legality exactly as it does today, then rejects dominated replacements, then evaluates detailed utility.
- Set acceptance rules by mode with named constants and no blanket negative-value allowance. A seller may accept a current-rotation loss only when the detailed result contains sufficient future pick value or contract relief. A contender may accept a small long-term loss only when rotation value rises. A buyer requires non-negative total utility.
- Return a specific reason from the detailed evaluator rather than the generic current messages when possible. Preserve the existing `TradeValidationResult` public shape unless the UI migration in Step 6 is completed together.

Keep `executeTrade`, salary matching, trade exception handling, contract movement, pick movement, history, and moratorium behavior unchanged.

**Verify**: `npm run test --workspace=@workspace/sim -- trades.test.ts tradeEvaluation.test.ts` → all existing trade tests and every new scenario pass.

### Step 6: Surface explainable results without changing the trade-builder layout

Update `apps/web/src/routes/league/trades.tsx` only if needed to display a compact detailed reason from `wouldAiAcceptTrade` / `evaluateTradeUtility` in the existing status panel.

Display one decision-oriented sentence, for example: “Rejected: this lowers their projected rotation and the $3.8M relief does not offset the age/value loss.” Do not expose raw private constants or create a new scoring dashboard in this step.

Continue showing salary and package value, but source the package value from the new detailed evaluator so UI and AI agree.

**Verify**: `npm run typecheck` → exit 0 with no TypeScript errors.

### Step 7: Finish with a deterministic regression and simulation smoke test

Add an integration test that creates the same seeded league twice, evaluates the same proposed trade, and asserts identical detailed utility, decision, and reason codes. The evaluator must be deterministic and must not consume RNG.

Run a small multi-season simulation test or the existing league invariant suite to ensure all transaction and offseason consumers still execute with the compatibility exports.

**Verify**:

- `npm run test --workspace=@workspace/sim` → all sim tests pass.
- `npm run typecheck` → exit 0 with no errors.

## Test plan

Add tests in `packages/sim/tests/tradeEvaluation.test.ts` and extend `packages/sim/tests/playerValue.test.ts`.

- Regression: 87 OVR age 25/26 same-role player cannot be exchanged for 81 OVR age 31 plus only $3–4M relief.
- Same OVR, different age/peak/potential; young player wins expected multi-year contribution.
- Elite 31-year-old has value but a nonzero decline-risk cost.
- Expiring, bargain, long overpay, and option-bearing contracts use full salary schedules.
- Tax tolerance affects only the contract/utility layer, not intrinsic player value.
- Post-trade rotation and roster-balance delta responds to the actual outgoing/incoming swap.
- Selling, buying, and contending decisions differ only in documented ways.
- Deterministic repeat evaluation produces identical outputs.
- Existing trade legality, draft pick movement, TPE behavior, and execute-trade tests continue to pass.

## Done criteria

- [ ] The three public concepts exist as separate types/functions: projected player value, full-contract value, and team trade utility.
- [ ] Intrinsic player value has no contract, team, or strategy input.
- [ ] Contract value considers every remaining salary year and does not rely on the old square-root years multiplier.
- [ ] Team utility uses a constructed post-trade roster and deterministic rotation evaluation.
- [ ] The reported 87/25/26 for 81/31 + $3–4M scenario is rejected for every team mode without additional meaningful compensation.
- [ ] No generic expiring/long-expensive adjustment remains in the trade evaluator outside the contract layer.
- [ ] `npm run test --workspace=@workspace/sim` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] No files outside Scope are modified, except `plans/README.md` status update.

## STOP conditions

Stop and report instead of improvising if:

- Existing contract salary arrays do not represent the remaining seasons in order. The full-contract evaluation depends on that assumption.
- The project cannot derive future season financials from existing cap data without changing persisted schema.
- `selectRotation` cannot safely evaluate a temporary roster with the proposed incoming players.
- The new common value scale makes draft-pick values incomparable by more than an order of magnitude; resolve scale design before integrating picks.
- Passing existing trade tests would require weakening the new regression/dominance cases.
- The change requires altering salary-match legality, TPE mechanics, save schema, or game simulation.

## Maintenance notes

- Treat projected player value as the canonical basketball asset valuation for future draft, free-agency, and cap-cut work. Do not add a second age/overall formula in those systems.
- Keep contract value financial-only and team utility trade-only. This boundary is the main protection against double-counting salary, age, and strategy.
- Future work should add genuine counteroffer search, AI-to-AI trade market behavior, player trade preferences, owner-goal constraints, and a richer explanatory UI only after this evaluator is tuned with simulation data.
- In code review, scrutinize the units and ranges of every component. A contract-relief term must not silently dominate a material multi-year basketball-value gap.
