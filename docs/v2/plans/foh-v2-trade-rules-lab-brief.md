# Front Office Hoops V2 — Trade Rules Lab Brief

**Status:** Planned  
**Purpose:** Calibrate the smallest trustworthy trade model before promoting
trade execution into the authoritative league loop.

**Parent lab:** [Contract Market, Negotiation, and Free Agency](./foh-v2-contract-market-and-negotiation-plan.md)

## Objective

Create a deterministic Trade & Rules Lab that answers:

1. Is the proposed trade legal?
2. Is it financially workable for both teams?
3. Does each team receive enough basketball value and roster fit?
4. Can the result be explained clearly to the user?

The lab produces a validated scenario and report. It must not mutate or save a
real `LeagueDocument`.

## Smallest successful scenario

Start with a two-team trade involving rostered players and optional draft
assets:

```text
league fixture
  → select Team A and Team B
  → select players and optional picks
  → validate roster, contract, cap, and pick rules
  → calculate value and team fit for both teams
  → accept, reject, or flag for review
  → export the scenario and explanation
```

The first lab does not need multi-team trades, protected-pick chains, complex
CBA exceptions, or sophisticated AI negotiation.

## Required inputs

The fixture must include:

- Two legal teams and their rosters.
- Player contracts and current payroll.
- Salary-cap, tax-line, and hard-cap settings.
- Draft assets owned by each team.
- Current Universal Player Value for all involved players.
- Team needs, positions, roster limits, and basic team direction.
- A deterministic seed and stable scenario ID.

The lab should consume production/value outputs from the authoritative V2
modules. It must not recalculate player production or Universal Player Value.

## Required outputs

Each run should return:

- Proposed outgoing and incoming assets.
- Legal or illegal result.
- Rejection reasons with stable codes.
- Salary and cap impact for each team.
- Roster-size and positional impact.
- Player-value change for each team.
- Team-fit and need adjustments.
- Draft-pick ownership result.
- A suggested acceptance label such as `accept`, `decline`, or `review`.
- Human-readable explanation derived from structured factors.
- Full fixture/report JSON export.

## Rules to test

### Asset legality

- A player must belong to the sending team.
- A draft pick must be owned by the sending team.
- The same asset cannot appear twice.
- A player cannot be traded to the same team.
- Teams must remain within minimum and maximum roster limits.
- Unknown or retired players cannot be included.

### Contract and finance legality

- Contracts move with traded players.
- Salary matching follows the active simplified cap rules.
- Teams cannot violate the hard cap.
- Payroll and cap room reconcile before and after the proposal.
- Dead money is not created by a hypothetical trade.

### Basketball value and fit

- Use Universal Player Value as the base player signal.
- Add bounded team-fit and roster-need modifiers.
- Consider positional duplication and lineup coverage.
- Keep team-fit separate from raw player value.
- Produce an explanation for significant value differences.

## Calibration runs

The lab should support:

- A single interactive scenario for inspecting explanations.
- A seeded batch of ordinary player-for-player trades.
- Player-plus-pick packages.
- Cap-room, tax, and hard-cap edge cases.
- Roster minimum/maximum edge cases.
- Clearly unfair trades to test rejection behavior.
- Repeated runs with the same seed to verify determinism.

Batch reports should retain failed cases and outliers. The report should show
legality pass rate, acceptance/rejection rates, cap failures, roster failures,
average value change, and the most common explanation codes.

## Success criteria

The lab is successful when:

- The same fixture and seed produce the same result.
- Every illegal trade is rejected for a specific reason.
- Every legal trade produces a reconciled hypothetical result.
- Contracts, payroll, rosters, and picks remain internally consistent.
- Team-fit modifiers do not overwhelm the base player-value signal without an
  explicit configured reason.
- Reports are strict-schema validated and exportable.
- A developer can inspect why each team accepts, rejects, or flags a trade.
- The outputs are sufficient to design the authoritative `ExecuteTrade`
  command without inventing new trade rules in the league layer.

## Recommended implementation boundary

Add the lab as a Trade section within the existing Market & Rules surface and
keep the calculation authority in `packages/sim-v2`. Use typed fixtures and
reports validated by `packages/league-schema`; use a worker for batch runs.

Do not write hypothetical trade results into `LeagueDocument`. After the lab
passes its acceptance cases, promote the agreed rules into a separate
authoritative trade command that performs the real roster, contract, pick,
payroll, event, and persistence mutations.

## Handoff to authoritative trading

The next implementation plan after this lab should cover:

1. `ExecuteTrade` command and validation.
2. Trade proposal UI using the accepted lab explanations.
3. Player, contract, roster, and pick mutations.
4. Payroll and production team-split updates.
5. Transaction events and save/reload/export.
6. Trade-deadline permission gates.
7. Basic AI trade evaluation.
