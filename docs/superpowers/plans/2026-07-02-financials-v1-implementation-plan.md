# Financials v1 — Implementation Plan

**Status:** Ready to execute  
**Date:** 2026-07-02  
**Design spec:** [Contracts & Salary Cap v1](../specs/2026-07-02-contracts-salary-cap-design.md)  
**Save version:** 4 → 5

---

## Overview

Implement the full financials v1 loop:

1. Every player has a `Contract` with salary and remaining years
2. League cap grows annually; max/min salaries and exceptions derive from cap
3. Luxury tax assessed at end of regular season; cash/debt updated on `TeamFinancials`
4. Offseason contract expiration, cap year rollover, AI + user free agency
5. Rookie scale contracts on draft picks
6. UI: cap sheet, roster salaries, FA signing, team-pick cap preview
7. v4 → v5 save migration

**Out of scope:** trades/TPE enforcement, aprons, RFA, owner UI, narrative events.

---

## Architecture

```
packages/shared/
  contractTypes.ts      # Contract, SigningException, etc.
  financialTypes.ts     # LeagueFinancials, TeamFinancials, SeasonFinancials
  financialConstants.ts # Base cap ratios, revenue tables, tolerance floors

packages/sim/src/financials/
  index.ts
  capMath.ts            # Season financials, max/min salary, cap space
  luxuryTax.ts          # Incremental tax calculation
  birdRights.ts         # deriveBirdRights, re-sign ceilings
  payroll.ts            # teamPayroll, league-wide aggregates
  spendingProfiles.ts   # assignSpendingProfiles at league gen
  contracts/
    generateInitialContracts.ts
    processContracts.ts   # expiration, options, advance year
    createContract.ts     # factory + validation
    rookieScale.ts
  revenue.ts            # season revenue from market + wins
  assessSeasonFinances.ts # end-of-regular-season tax + cash
  freeAgency/
    canSignPlayer.ts
    signFreeAgent.ts
    processAiFreeAgency.ts
  aiCapBehavior.ts      # tax_averse dumps, austerity

Integration hooks:
  createLeague.ts           → init financials + contracts
  finalizeSeason path       → assessSeasonFinances (NEW: before playoffs OR at regular-season end)
  beginOffseason.ts         → processContracts (via useLeague wrapper)
  startNextSeason.ts        → rollFinancialYear + aiCapBehavior + floor validation
  makeDraftPick.ts          → attach rookie contract
  normalizeLeague.ts        → v4→v5 migration
```

**Key design choice — when to assess tax:**

Assess at transition **`regular` → `playoffs`** (when regular season completes), not after playoffs. Payroll for the tax year is the regular-season roster payroll at that moment. Playoff performance still affects revenue bonus at **season archive** time in `startNextSeason` / `assessSeasonFinances` part 2.

Split into two calls:
- `assessRegularSeasonTax(league, seasonState)` — tax on payroll, update cash/debt
- `applySeasonPerformanceRevenue(league, historyContext)` — win/playoff bonus at season end (optional v1 simplification: combine both at `beginOffseason` using final standings — **recommended for v1 simplicity**)

**v1 recommendation:** Run full financial assessment once in **`beginOffseason`** using final regular-season payroll snapshot stored at phase transition, OR recompute from contracts at offseason start (simpler — no snapshot needed if contracts didn't change during playoffs). Playoffs don't change rosters today, so **`beginOffseason` is the single assessment point** for tax + revenue in v1.

---

## Phase 1 — Shared types & constants

**Goal:** Type foundation + SAVE_VERSION bump. No behavior yet.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 1.1 | Add `contractTypes.ts` with `Contract`, `ContractOption`, `SigningException`, `ContractStatus`, `ContractType` | `packages/shared/src/contractTypes.ts` |
| 1.2 | Add `financialTypes.ts` with `MarketTier`, `TaxTolerance`, `TeamSpendingProfile`, `SeasonFinancials`, `LeagueFinancials`, `TeamFinancials`, `TradeException`, `SpendingProfileEvent`, `FreeAgentOffer` | `packages/shared/src/financialTypes.ts` |
| 1.3 | Add `financialConstants.ts`: `BASE_SALARY_CAP = 141`, ratio constants, min salary tiers (2024-25 anchors), `CAP_GROWTH_MIN/MAX`, market revenue bases, tolerance cash floors | `packages/shared/src/financialConstants.ts` |
| 1.4 | Extend `Player` with `activeContractId`, `seasonsWithTeam`, `yearsOfService` (default-friendly for tests) | `packages/shared/src/playerTypes.ts` |
| 1.5 | Extend `LeagueRecord` with `contracts`, `leagueFinancials`, `teamFinancials`, `spendingProfileEvents`; bump `SAVE_VERSION` to `5` | `packages/shared/src/leagueTypes.ts` |
| 1.6 | Re-export new modules | `packages/shared/src/index.ts`, `packages/shared/src/types.ts` |
| 1.7 | Update `docs/data-model.md` with financial entities (brief) | `docs/data-model.md` |

### Verification

```bash
cd packages/shared && npm run build   # or root turbo build
```

All existing tests still compile (Player shape change requires updating test fixtures — do in Phase 1.7 follow-up across sim tests).

---

## Phase 2 — Cap math (pure functions + tests)

**Goal:** All financial calculations with no league integration.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 2.1 | `calculateSeasonFinancials(baseCap, growthRate, season)` → `SeasonFinancials` | `financials/capMath.ts` |
| 2.2 | `buildLeagueFinancials(baseCap, growthRate, maxSeason)` → `LeagueFinancials` with precomputed `bySeason` | `financials/capMath.ts` |
| 2.3 | `calculateMaxSalary(cap, yearsOfService, priorSalary?)` — tier + 105% rule | `financials/capMath.ts` |
| 2.4 | `calculateMinSalary(seasonFinancials, yearsOfService)` | `financials/capMath.ts` |
| 2.5 | `buildRookieScale(seasonFinancials)` — 30 slots, pick 1 highest | `financials/capMath.ts` |
| 2.6 | `calculateLuxuryTax(payroll, taxLine, bracketSize)` — incremental tiers | `financials/luxuryTax.ts` |
| 2.7 | `deriveBirdRights(seasonsWithTeam)` → `'none' \| 'non_bird' \| 'early_bird' \| 'bird'` | `financials/birdRights.ts` |
| 2.8 | `calculateBirdSignCeiling(...)` — per exception type | `financials/birdRights.ts` |
| 2.9 | `getTeamPayroll(teamId, contracts)` | `financials/payroll.ts` |
| 2.10 | `getCapSpace(payroll, salaryCap)` | `financials/payroll.ts` |
| 2.11 | Unit tests for all above | `packages/sim/tests/financials/capMath.test.ts`, `luxuryTax.test.ts`, `birdRights.test.ts` |

### Verification

```bash
cd packages/sim && npx vitest run tests/financials/
```

---

## Phase 3 — Contracts lifecycle

**Goal:** Generate, store, expire, and advance contracts.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 3.1 | `createContractId()` helper | `financials/contracts/createContract.ts` |
| 3.2 | `buildSalaryCurve(baseSalary, years, raisePct)` — yearly array | `financials/contracts/createContract.ts` |
| 3.3 | `generateInitialContract(player, teamId, season, seasonFinancials, rng)` — OVR-based salary, 1–4 years | `financials/contracts/generateInitialContracts.ts` |
| 3.4 | `generateInitialContractsForLeague(teams, seasonFinancials, rng)` → `Contract[]` + player field updates | `financials/contracts/generateInitialContracts.ts` |
| 3.5 | `getActiveContract(contractId, contracts)` / `getPlayerContract(player, contracts)` helpers | `financials/contracts/createContract.ts` |
| 3.6 | `processContractOptions(contract, decision)` — exercise or decline team/player option | `financials/contracts/processContracts.ts` |
| 3.7 | `processContractExpiration(league)` — expire, move to FA pool, clear `activeContractId`, bump `yearsOfService` on retainers | `financials/contracts/processContracts.ts` |
| 3.8 | `advanceContractYear(contracts)` — drop `[0]` from `yearlySalaries` at cap year roll (or mark expired if empty) | `financials/contracts/processContracts.ts` |
| 3.9 | `createRookieScaleContract(player, pickNumber, teamId, season, seasonFinancials)` | `financials/contracts/rookieScale.ts` |
| 3.10 | Tests: initial generation determinism, expiration, option exercise | `packages/sim/tests/financials/contracts.test.ts` |

### Verification

```bash
npx vitest run tests/financials/contracts.test.ts
```

---

## Phase 4 — Team finances & spending profiles

**Goal:** League/team financial state, tax payment, revenue, profiles.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 4.1 | `assignSpendingProfiles(teams, rng)` → `TeamFinancials[]` — market tier + tax tolerance distribution | `financials/spendingProfiles.ts` |
| 4.2 | `initializeTeamFinancials(teams, rng)` — profiles + starting `cashReserves` (e.g. $20M) | `financials/spendingProfiles.ts` |
| 4.3 | `initializeLeagueFinancials(rng)` — base cap + growth rate seeded | `financials/spendingProfiles.ts` |
| 4.4 | `calculateSeasonRevenue(teamFinancials, wins, playoffRound?)` — market base + bonus | `financials/revenue.ts` |
| 4.5 | `assessTeamSeasonFinance(team, contracts, seasonFinancials, wins)` — payroll, tax, net cash, debt | `financials/assessSeasonFinances.ts` |
| 4.6 | `assessLeagueSeasonFinances(league, seasonState)` — all teams, update `consecutiveTaxSeasons` | `financials/assessSeasonFinances.ts` |
| 4.7 | `rollFinancialYear(league, newSeason)` — compute new `SeasonFinancials`, reset MLE, expire TPEs | `financials/assessSeasonFinances.ts` |
| 4.8 | `applyMinimumSalaryFloorPenalty(team, payroll, minimumTeamSalary)` — deduct shortfall from cash | `financials/assessSeasonFinances.ts` |
| 4.9 | Tests: tax assessment updates cash/debt, consecutive tax seasons, floor penalty | `packages/sim/tests/financials/teamFinances.test.ts` |

### Verification

```bash
npx vitest run tests/financials/teamFinances.test.ts
```

---

## Phase 5 — League integration (sim hooks)

**Goal:** Wire financials into existing lifecycle functions.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 5.1 | **`createLeague`**: call `initializeLeagueFinancials`, `initializeTeamFinancials`, `generateInitialContractsForLeague`; attach to returned `LeagueRecord` | `createLeague.ts` |
| 5.2 | **`beginOffseason`**: accept optional `LeagueRecord` context OR split into `beginOffseasonWithFinancials(league, rng)` that returns updated league + state. **Preferred:** new function `processOffseasonFinancials(league, rng)` called from `useLeague` after `beginOffseason`: (a) assess season finances, (b) process contract expiration, (c) AI option decisions | `beginOffseason.ts`, `financials/processOffseasonFinancials.ts` |
| 5.3 | **`startNextSeason`**: extend input to accept full `LeagueRecord`; call `rollFinancialYear`, `advanceContractYear`, `applyAiCapBehavior`, floor validation; return updated financial fields | `startNextSeason.ts` |
| 5.4 | **`makeDraftPick`**: accept contracts array; on pick, create rookie scale contract | `draft/makeDraftPick.ts` |
| 5.5 | Export all financial modules | `packages/sim/src/index.ts` |
| 5.6 | Update existing sim tests that call `createLeague` to tolerate new `LeagueRecord` fields | `packages/sim/tests/*.test.ts` |
| 5.7 | Integration test: full season cycle updates cash after offseason | `packages/sim/tests/financials/integration.test.ts` |

### API shape change note

`startNextSeason` and `beginOffseason` currently only touch `SeasonState`. Financial data lives on `LeagueRecord`. **Extend `useLeague` as the orchestrator** — it already holds the full record:

```ts
// useLeague.ts pattern
const nextState = beginOffseason(seasonState, rng)
const updatedLeague = processOffseasonFinancials({ ...league, seasonState: nextState }, rng)
setLeague(updatedLeague)
```

Keep pure functions in `packages/sim`; web layer composes them.

### Verification

```bash
cd packages/sim && npx vitest run
```

---

## Phase 6 — Free agency

**Goal:** Sign FAs with cap exception validation; AI fills rosters.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 6.1 | `FreeAgentOffer` type: `{ years, firstYearSalary, signingException? }` | already in `financialTypes.ts` |
| 6.2 | `canSignPlayer(league, teamId, playerId, offer)` — validates cap room, Bird, MLE, max/min, roster size | `financials/freeAgency/canSignPlayer.ts` |
| 6.3 | `signFreeAgent(league, teamId, playerId, offer)` — create contract, move player, update MLE used | `financials/freeAgency/signFreeAgent.ts` |
| 6.4 | `processAiFreeAgency(league, rng)` — AI re-signs own FAs first, then external FAs | `financials/freeAgency/processAiFreeAgency.ts` |
| 6.5 | `processAiOptionDecisions(league, rng)` — team options on overpaid vets (tax_averse declines) | `financials/aiCapBehavior.ts` |
| 6.6 | `applyAiCapBehavior(league, rng)` — release players to get under tax if tax_averse | `financials/aiCapBehavior.ts` |
| 6.7 | Wire AI FA into `processOffseasonFinancials` after contract expiration | `financials/processOffseasonFinancials.ts` |
| 6.8 | Tests: cap room sign, MLE sign, Bird re-sign, max salary rejection | `packages/sim/tests/financials/freeAgency.test.ts` |

### Verification

```bash
npx vitest run tests/financials/freeAgency.test.ts
```

---

## Phase 7 — Save migration (v4 → v5)

**Goal:** Existing saves backfill financial data without breaking.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 7.1 | Add version branching in `normalizeLeagueRecord` | `normalizeLeague.ts` |
| 7.2 | `migrateV4ToV5(record, rng?)` — use deterministic seed from `record.seasonState.baseSeed` | `financials/migrateV4ToV5.ts` |
| 7.3 | Migration reuses `generateInitialContractsForLeague`, `initializeLeagueFinancials`, `initializeTeamFinancials` | same |
| 7.4 | Default missing player fields: `activeContractId: null` → filled by migration | `normalizeLeague.ts` |
| 7.5 | Test: minimal v4 fixture normalizes to v5 with contracts for all players | `packages/sim/tests/migrateV4ToV5.test.ts` |

### Verification

```bash
npx vitest run tests/migrateV4ToV5.test.ts
```

---

## Phase 8 — UI

**Goal:** Surface financial data to the player.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 8.1 | **`formatMoney(millions)`** helper — display `$12.4M` | `apps/web/src/components/league/lib/moneyFormat.ts` |
| 8.2 | **`useTeamFinancials(teamId)`** — derive payroll, cap space, tax from league record + contracts | `apps/web/src/hooks/useTeamFinancials.ts` |
| 8.3 | **`CapSheetCard`** — payroll, cap, cap space, tax line, projected tax, cash, debt, tolerance label, market tier | `apps/web/src/components/league/CapSheetCard.tsx` |
| 8.4 | Extend **`RosterCard`** — columns: Salary, Yrs left, option badge; lookup contract via `activeContractId` | `RosterCard.tsx` |
| 8.5 | **`team.tsx`** — add `CapSheetCard` above roster | `apps/web/src/routes/league/team.tsx` |
| 8.6 | **`pick-team.tsx`** — show market tier + payroll vs tax line summary per team (not tolerance label) | `pick-team.tsx` |
| 8.7 | **`FreeAgencyPanel`** — list `freeAgentPool`, offer form (years + salary), cap impact preview, sign button | `apps/web/src/components/league/FreeAgencyPanel.tsx` |
| 8.8 | Add route or offseason section: **`/league/free-agency`** or panel on team page when `phase === 'offseason'` | route + `LeagueNav.tsx` |
| 8.9 | **`useLeague` actions**: `signFreeAgent`, wire `processOffseasonFinancials` into `beginOffseasonAction`, pass financial fields through `startNextSeason` | `useLeague.ts` |
| 8.10 | **`LeagueContext`** — expose `isOverTax`, `capSpace`, `cashReserves` for user team | `LeagueContext.tsx` |
| 8.11 | Tax/cash **warnings** on sign (not hard blocks) | `FreeAgencyPanel.tsx` |

### Verification

Manual: create league → pick team → see cap sheet + salaries → simulate season → begin offseason → see tax impact on cash → sign FA → draft → next season.

---

## Phase 9 — Docs & roadmap

| # | Task | File(s) |
|---|------|---------|
| 9.1 | Mark financials implemented in roadmap | `docs/roadmap.md` |
| 9.2 | Update data model doc with full financial section | `docs/data-model.md` |
| 9.3 | Mark design spec status **Implemented** when done | design spec |

---

## Execution order & dependencies

```
Phase 1 (types)
    ↓
Phase 2 (cap math) ─────────────────────────┐
    ↓                                       │
Phase 3 (contracts) ←───────────────────────┘
    ↓
Phase 4 (team finances)
    ↓
Phase 5 (league integration) ←── requires 3 + 4
    ↓
Phase 6 (free agency) ←── requires 5
    ↓
Phase 7 (migration) ←── can start after Phase 3, finish after Phase 5
    ↓
Phase 8 (UI) ←── can start CapSheet after Phase 4; FA UI after Phase 6
    ↓
Phase 9 (docs)
```

**Suggested PR strategy:**

| PR | Phases | Shippable milestone |
|----|--------|---------------------|
| PR 1 | 1–4 | Types + pure financial logic, all unit tests green |
| PR 2 | 5–7 | Wired sim + migration, existing flows still work |
| PR 3 | 6 + 8 | Free agency + UI |

Or single PR if preferred for atomic release.

---

## Test fixture updates

Adding required fields to `Player` breaks compile across tests. After Phase 1, run:

```bash
rg "players:" packages/sim/tests -l
```

Add defaults to test player factories:

```ts
activeContractId: null,
seasonsWithTeam: 0,
yearsOfService: 0,
```

Prefer a shared **`makeTestPlayer(overrides)`** helper in `packages/sim/tests/helpers.ts` to avoid repetition.

---

## Definition of done

- [ ] `SAVE_VERSION = 5`; v4 saves migrate cleanly
- [ ] New leagues spawn with contracts, team financials, spending profiles
- [ ] Roster shows salary and years remaining
- [ ] Cap sheet shows payroll, cap space, tax line, cash, debt, tolerance
- [ ] Offseason: contracts expire → FAs enter pool → AI signs → user can sign
- [ ] Draft picks receive rookie scale contracts
- [ ] Luxury tax deducted from cash at offseason; debt accumulates if cash insufficient
- [ ] AI tax_averse teams dump salary to get under tax line
- [ ] Team pick shows market + cap outlook
- [ ] All sim unit tests pass; no regressions in draft/playoffs/season tests
- [ ] Roadmap updated

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `LeagueRecord` vs `SeasonState` split complicates hooks | Keep orchestration in `useLeague`; pure functions take explicit args |
| Player shape change breaks many tests | Shared test helper; fix compile in Phase 1 before moving on |
| Double-counting tax/revenue | Single assessment in `processOffseasonFinancials` for v1 |
| FA + draft + roster limit conflicts | Run FA before draft; validate roster at `startNextSeason` (existing) |
| Mini-league (6 teams) financial balance | Use same cap constants; revenue scales down proportionally |

---

## Estimated task count

~55 discrete tasks across 9 phases. Phases 1–4 are sim-only (~25 tasks). Phase 8 UI is ~11 tasks.

---

## Next action

Start **Phase 1, Task 1.1** — create `contractTypes.ts` and `financialTypes.ts`, bump `SAVE_VERSION`.
