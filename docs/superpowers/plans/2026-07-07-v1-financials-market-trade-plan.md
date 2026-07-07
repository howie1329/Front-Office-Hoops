# v1 Financials, Market & Trade — Implementation Plan

**Status:** Approved for execution (user decisions 2026-07-07)  
**Date:** 2026-07-07  
**Base branch:** `master` @ SAVE_VERSION 11  
**Related specs:**
- [Contracts & Salary Cap v1](../specs/2026-07-02-contracts-salary-cap-design.md)
- [Team Strategy AI](../specs/2026-07-02-team-strategy-ai-design.md)

**Research brief:** Salary cap / contracts / player value / trade value comparison vs Basketball GM (2026-07-07 conversation).

---

## Summary

Ship a cohesive v1 economy loop before release:

1. **Finish the financial spec** — contract options, Room MLE, TPE, repeater tax, light dead cap, Bird rights reset on trade
2. **Unify the value/salary loop** — one canonical player worth model feeding contracts, trades, FA, and cap cuts
3. **Build a real market** — archetype-aware bidding with overall scaling, BBGM-inspired auction dynamics, player mood
4. **Harden trade AI** — users cannot fleece AI; prospect-derived picks; AI-initiated trades and offers to user
5. **Desktop-first trade UX** — value breakdowns, “what would it take?”, pending offer inbox

**Explicit non-goals for this plan:** two-apron hard caps, RFA/offer sheets, sign-and-trade, stretch provision (full CBA), mobile trade UX polish.

---

## User decisions (locked)

| Area | Decision |
|------|----------|
| Contract options | Implement (process in offseason) |
| Room MLE | Implement |
| TPE | Implement (create + consume in trades) |
| Repeater tax | Implement + show in UI |
| Dead cap on waive | Light dead money + UI |
| Bird rights on trade | Reset `seasonsWithTeam` to 0 (verify/enforce) |
| Market | Archetype market dynamics × overall scale; unified value model |
| Pick values | Tied to draft class strength / prospect quality |
| Trade AI | BBGM-like strictness (no fleece); superlinear star premium; auto-balancer |
| AI trade market | AI-initiated trades + offers to user team |
| Player mood | BBGM-like traits affecting negotiation |
| Strategy behavior | Selling dumps salary / hoards picks; contending overpays for win-now |
| Trade UX | Desktop-first improvements |
| Unspecified items | Default BBGM-like where not explicitly FOH-native |

---

## Current state (post–master pull)

### Already implemented
- Soft cap, Bird/Early Bird/Non-Bird, non-taxpayer & taxpayer MLE, minimum, rookie scale
- Tiered max/min salaries, 5%/8% raises, multi-year `yearlySalaries[]`
- Progressive luxury tax brackets; `consecutiveTaxSeasons` tracked (not applied to tax math)
- Team spending profiles (`taxTolerance`, `marketTier`) + `TeamMode` (selling/buying/contending)
- Trade engine: validation, 125% matching, evaluation, AI acceptance (`AI_ACCEPT_TOLERANCE = 4`)
- Archetype-aware player value (`packages/sim/src/playerValue/index.ts`)
- Draft class strength offsets (`generateDraftClass.ts`)
- Expanded 12-skill ratings, scouting fuzz, preseason camp, calendar (SAVE_VERSION 11)

### Gaps to close
| Feature | Status |
|---------|--------|
| Contract options | Stored on contracts; never processed |
| Room MLE | Constant computed; not in `canSignPlayer` |
| TPE | Stored on `TeamFinancials`; not created or consumed |
| Repeater tax | Counter only; no surcharge in `calculateLuxuryTax` |
| Dead cap | Waive = zero cap hit |
| Market auction | Formula-only (`estimateSalaryFromValue`) |
| Unified value | Split `calculatePlayerValue` vs `calculateContractValue` |
| Player mood | Not modeled |
| AI-initiated trades | Not implemented |
| Pick trade value | Heuristic chart, not prospect-derived |
| Trade fleece | `-4` tolerance too lenient |

---

## Architecture overview

```
packages/shared/
  contractTypes.ts       + deadCapCharge, option metadata
  financialTypes.ts      + DeadCapCharge, PlayerMood, PendingTradeOffer
  financialConstants.ts  + repeater thresholds, dead cap ratios, trade AI constants
  tradeTypes.ts          + TradeOffer, TradeOfferStatus

packages/sim/src/
  playerValue/
    index.ts               → unified worth API (refactor)
    performanceDrift.ts    → optional season stat adjustment
    leagueNormalization.ts → z-score helpers (BBGM-like stability)
    archetypeMarket.ts     → scarcity × overall market multiplier

  financials/
    capMath.ts             + repeater surcharge
    deadCap.ts             + waive stretch logic
    tradeExceptions.ts     + create/consume TPE
    contracts/
      processContracts.ts  + processContractOptions
    market/
      normalizeDemands.ts  + auction rounds (BBGM-inspired)
      playerMood.ts        + mood traits + modifiers
      bidScoring.ts        → value² × archetypeMarket × mood

  trades/
    index.ts               (move from trades.ts)
    evaluateTrade.ts       + superlinear bundling, pick values from draft class
    validateTrade.ts       + TPE absorption, moratorium
    makeItWork.ts          + auto-balancer
    aiTradeMarket.ts       + daily AI proposals + user inbox
    pickValues.ts          + prospect-derived pick chart

  draft/
    pickValues.ts          + export pick value from draft class

Integration:
  simulateRegularDay.ts    → run AI trade market tick
  financials/index.ts    → options before expiration in offseason
  apps/web/                → cap sheet, dead cap, repeater, trade UX
```

---

## Phase 0 — Foundations & save migration

**Goal:** Types and constants for all new mechanics; bump SAVE_VERSION → 12.

### Tasks

| # | Task | Location |
|---|------|----------|
| 0.1 | Add `DeadCapCharge { id, playerId, amount, seasonsRemaining, origin }` | `financialTypes.ts` |
| 0.2 | Add `deadCapCharges: DeadCapCharge[]` to `TeamFinancials` | `financialTypes.ts` |
| 0.3 | Add `PlayerMood { money, winning, loyalty, fame }` (0–100) to `Player` | `playerTypes.ts` |
| 0.4 | Add `PendingTradeOffer { id, fromTeamId, toTeamId, proposal, expiresDay, status }` | `tradeTypes.ts` |
| 0.5 | Add `pendingTradeOffers: PendingTradeOffer[]` to `LeagueRecord` | `leagueTypes.ts` |
| 0.6 | Constants: `REPEATER_TAX_SEASONS = 3`, `REPEATER_SURCHARGE = 1.0`, `DEAD_CAP_STRETCH_YEARS = 2`, `TRADE_MORATORIUM_GAMES = 14`, `TRADE_VALUE_EXPONENT = 7`, `AI_ACCEPT_MIN_NET = 0`, `AI_ACCEPT_CLOSE = -2` | `financialConstants.ts` |
| 0.7 | `normalizeLeagueRecord` v11→v12: empty dead cap, default mood, empty pending offers | `normalizeLeague.ts` |
| 0.8 | Seed mood at player generation + FA generation (deterministic from id) | `generatePlayerProfile.ts`, `generateFreeAgents.ts` |

### Tests
- Migration test: v11 save → v12 with defaults
- Mood seeded in `[40, 80]` range, deterministic

---

## Phase 1 — Finish financial spec

**Goal:** All spec’d cap mechanics work in sim + visible on cap sheet.

### 1.1 Contract options

**Behavior:**
- Run `processContractOptions(league, rng)` in offseason **before** `expireOneYearContracts`
- For each active contract with `options` on index 0 (current year is option year):
  - **Team option:** AI exercises if `calculateRosterKeepValue >= salary × threshold`; declines otherwise
  - **Player option:** AI declines if surplus negative; exercises if contending team and player ≥ win-now threshold
  - User team: auto-exercise team options on obvious keeps; surface player-option decisions in UI (v1: AI decides with log entry; user override in Phase 5)
- On decline: contract ends → FA pool (same as expire)
- On exercise: drop option from array, keep salary

| # | Task | Location |
|---|------|----------|
| 1.1.1 | `processContractOptions` | `financials/contracts/processContracts.ts` |
| 1.1.2 | Wire into `processOffseasonFinancials` / offseason command flow | `financials/index.ts` |
| 1.1.3 | Option indicator on roster (already partial) — verify accuracy | `RosterCard.tsx` |

### 1.2 Room MLE

**Behavior (per design spec):**
- Eligible if `wasUnderCapThisYear === true` at signing time
- Mutually exclusive with using full non-taxpayer MLE in same cap year (if `mleUsed > 0` from full MLE, Room unavailable)
- Amount: `seasonFinancials.mleRoom`; max years: 3
- Cannot use if team is over cap without Room exception remaining

| # | Task | Location |
|---|------|----------|
| 1.2.1 | Add `roomMleRemaining` or derive from `wasUnderCapThisYear && mleUsed === 0` | `TeamFinancials` |
| 1.2.2 | Extend `canSignPlayer` with `mle_room` path | `freeAgency.ts` |
| 1.2.3 | Track Room MLE usage in `mleUsed` with signing exception tag | `signFreeAgent` |

### 1.3 Trade exceptions (TPE)

**Behavior:**
- **Create:** When team trades away player(s) and `outgoingSalary > incomingSalary + allowedMatching`, create TPE for difference (expires end of next season)
- **Consume:** In `validateSalaryMatching`, incoming salary can be absorbed by TPE without 125% matching (TPE reduced by amount used; partial use allowed)
- **Expire:** Already filtered in `rollFinancialYear` (fix bug: currently compares `expiresSeason > consecutiveTaxSeasons` — should be `>= newSeason`)

| # | Task | Location |
|---|------|----------|
| 1.3.1 | `createTradeException(teamId, amount, season, description)` | `financials/tradeExceptions.ts` |
| 1.3.2 | `applyTpeToTrade(teamFinance, incomingSalary)` in validation | `trades/validateTrade.ts` |
| 1.3.3 | Create TPE on `executeTrade` when salary not fully matched | `trades/executeTrade.ts` |
| 1.3.4 | Fix TPE expiry filter in `rollFinancialYear` | `assessSeasonFinances.ts` |

### 1.4 Repeater tax

**Behavior (per design spec):**
- If `consecutiveTaxSeasons >= 3` before current assessment, add **+$1.00 per dollar** in each tax bracket (on top of existing rates)
- Display `Repeater` badge + projected surcharge on cap sheet

| # | Task | Location |
|---|------|----------|
| 1.4.1 | `calculateLuxuryTax(payroll, taxLine, bracketSize, isRepeater)` | `capMath.ts` |
| 1.4.2 | Pass repeater flag from `consecutiveTaxSeasons >= 3` in assessment | `assessSeasonFinances.ts` |
| 1.4.3 | UI: repeater status + incremental cost | `CapSheetCard.tsx`, `useTeamFinancials.ts` |

### 1.5 Light dead cap

**Behavior:**
- On waive/release: remaining guaranteed salary (`sum(yearlySalaries)`) stretched over **2 seasons** as dead cap hits
- Dead cap counts toward payroll and tax
- Camp non-guaranteed contracts: no dead cap (already waived pre-season with zero hit)

| # | Task | Location |
|---|------|----------|
| 1.5.1 | `createDeadCapFromWaive(contract)` → 2 equal charges | `financials/deadCap.ts` |
| 1.5.2 | `getTeamDeadCapPayroll(teamFinance)` included in `getTeamPayroll` | `payroll.ts` |
| 1.5.3 | Advance dead cap charges in `rollFinancialYear` | `deadCap.ts` |
| 1.5.4 | Wire into `releasePlayer` / `waivePlayerContract` | `roster/ledger.ts`, `capCuts.ts` |
| 1.5.5 | UI: dead cap line on cap sheet + per-player on roster | `CapSheetCard.tsx`, `RosterCard.tsx` |

### 1.6 Bird rights on trade

**Behavior:** Already resets in `tradePlayer()` — add test + verify `executeTrade` path; ensure Bird derivation uses post-trade `seasonsWithTeam: 0`.

| # | Task | Location |
|---|------|----------|
| 1.6.1 | Regression test: trade resets Bird rights | `trades.test.ts` |
| 1.6.2 | Log entry note on trade history | `trades/executeTrade.ts` |

### Phase 1 tests
- Options: exercise/decline paths, FA on decline
- Room MLE: eligible vs ineligible teams
- TPE: create on salary dump, consume in follow-up trade, expire
- Repeater: 3rd consecutive tax season increases bill
- Dead cap: waive 3yr/$30M → $15M × 2 seasons on payroll
- Bird: traded player has `seasonsWithTeam === 0`

---

## Phase 2 — Unified value model

**Goal:** Single source of truth for player worth across all AI systems.

### Design

```ts
type PlayerWorthBreakdown = {
  talent: number           // overall (+ optional performance drift)
  upside: number
  archetype: number
  scarcity: number
  ageRisk: number
  marketPremium: number    // archetype × overall scarcity (Phase 3)
  total: number
}

function getPlayerWorth(player, context?: WorthContext): PlayerWorthBreakdown
function getFairSalary(player, seasonFinancials): number  // maps worth → dollars
```

**Rules:**
- Deprecate separate `calculateContractValue`; all callers use `getPlayerWorth` + `worthToSalary`
- `worthToSalary` keeps current curve shape (`estimateSalaryFromValue`) but input is unified `total`
- Optional **performance drift** (BBGM-like): after 500+ minutes, blend ±3 points based on season stats vs rating expectation (lightweight PER proxy from box scores)
- Optional **league z-score**: normalize worth for trade AI stability in outlier leagues

| # | Task | Location |
|---|------|----------|
| 2.1 | Refactor `playerValue/index.ts` → `getPlayerWorth`, `worthToSalary` | `playerValue/` |
| 2.2 | `performanceDrift.ts` — update worth at season end | new |
| 2.3 | Replace all `calculatePlayerValue` / `calculateContractValue` / `buildFairSalary` callers | sim package |
| 2.4 | Update tests: `playerValue.test.ts`, `aiValueModel.test.ts` | tests |

### Acceptance
- Correlation between worth and fair salary ≥ 0.95 for random roster sample
- Young high-potential players priced above same-OVR veterans (existing test passes)

---

## Phase 3 — Archetype market dynamics

**Goal:** FA/re-sign market feels alive; salaries respond to role scarcity and talent.

### Archetype market multiplier

```ts
marketPremium = archetypeScarcity(archetype, league) × overallTier(overall)
```

- `archetypeScarcity`: league-wide count of archetype / quality threshold (e.g. 3&D wings with 3PT+DEF ≥ 64)
- `overallTier`: smooth scale — elite (≥78) ×1.15, starter (≥68) ×1.05, bench ×1.0
- Applied to bid weight in auction and ask price in negotiation

### Market auction (BBGM-inspired)

Replace pure formula offers with **iterative bidding** for external FA:

1. Gather all unsigned FA + teams with cap/exception room
2. ~40–60 rounds: each team bids on top targets (softmax on `bidScore²`)
3. `bidScore = getPlayerWorth × marketPremium × moodFit × teamNeed`
4. Zero bids → lower ask; 2+ bids → raise ask
5. Converge to signed contracts

Re-signings keep Bird ceilings but use auction for ask vs team willingness (mood + loyalty).

| # | Task | Location |
|---|------|----------|
| 3.1 | `archetypeMarket.ts` — league scarcity index | `playerValue/` |
| 3.2 | `normalizeDemands.ts` — auction loop | `financials/market/` |
| 3.3 | `bidScoring.ts` — team need × worth × premium | `financials/market/` |
| 3.4 | Replace `processAiFreeAgency` offer loop with auction | `freeAgency.ts` |
| 3.5 | User offers still validated via `canSignPlayer`; AI responds using mood | `freeAgency.ts` |

### Phase 3 tests
- Weak draft class → lower FA prices; strong class → higher
- Scarce archetype (few 3&D wings) commands premium over generic wings
- Contending team overbids win-now FA vs selling team

---

## Phase 4 — Player mood (BBGM-like)

**Goal:** Negotiation variance and story; same player asks different prices from different teams.

### Traits (0–100, seeded)
- **Money** — higher → prefers bigger offers
- **Winning** — higher → discounts salary for top-4 teams
- **Loyalty** — higher → discounts for re-sign, penalizes leaving
- **Fame** — higher → prefers large markets (`marketTier === 'large'`)

### Effects
- `acceptProbability(offer, team, mood, worth)`
- `askMultiplier(mood, isReSign, marketTier)`
- Trade willingness: low loyalty → more likely to accept trade from selling team

| # | Task | Location |
|---|------|----------|
| 4.1 | `playerMood.ts` | `financials/market/` |
| 4.2 | Integrate into auction + re-sign + trade AI acceptance | market, trades |
| 4.3 | UI: mood hints on player page (scouting-gated — show after N games or high scouting level) | `players/$playerId.tsx` |

---

## Phase 5 — Trade system hardening

**Goal:** Fair, BBGM-like trade AI; prospect picks; no fleece.

### 5.1 Stricter acceptance

| AI net value | Result |
|--------------|--------|
| `> 0` | Accept |
| `> -2` | “Close, but not quite” (reject) |
| `> -5` | Reject |
| `≤ -5` | Strong reject |

Remove `AI_ACCEPT_TOLERANCE = 4`. Optional difficulty hook later.

### 5.2 Superlinear bundling (BBGM exponent 7)

After summing asset values per side, apply:
```
teamValue = sign(sum) × |sum|^TRADE_VALUE_EXPONENT / scaleFactor
```
Prevents packing role players to match a star.

### 5.3 Prospect-derived pick values

```ts
function getPickValue(pick, league): number {
  const draftClass = league.seasonState.draftState?.prospects // or stored draft class cache
  // Rank prospects by getPlayerWorth; pick N ≈ Nth prospect value
  // Adjust for years away, original team quality, strategy mode
}
```

Store `draftClassStrength` on league at draft prep for future picks.

| # | Task | Location |
|---|------|----------|
| 5.3.1 | `pickValues.ts` from draft class | `draft/pickValues.ts`, `trades/pickValues.ts` |
| 5.3.2 | Replace heuristic in `valuePickForTeam` | `trades/evaluateTrade.ts` |

### 5.4 Trade validation additions
- **Moratorium:** `gamesUntilTradable` after sign/trade (~14 games, scale with season length)
- **TPE absorption** (Phase 1)
- **Injury discount:** incoming injured players ×0.85 for AI

### 5.5 `makeItWork` auto-balancer

Greedy search: add pick/player from either side to move AI net value toward `> 0` while staying legal. Desktop trade UI button: **“Suggest balance”**.

| # | Task | Location |
|---|------|----------|
| 5.5.1 | `makeItWork.ts` | `trades/makeItWork.ts` |
| 5.5.2 | Expose via sim export + trade route | `trades/index.ts`, web |

### Phase 5 tests
- User cannot trade $5M scrub for $30M star (rejected)
- Star-for-star requires approximate value parity
- Pick value shifts with draft class strength
- makeItWork finds legal counter in known scenarios

---

## Phase 6 — AI trade market

**Goal:** League trades without user action; user receives offers.

### Daily tick (during trade window)

On `simulateRegularDay` (and offseason days):

1. For each AI team (excluding user on some days): roll `aiTradeChance` based on mode
   - Selling: high chance to shop vets ≥30 yo or expensive contracts
   - Contending: seek win-now ≥76 OVR, expiring stars
2. Pick initiator asset (player or pick)
3. Find partner team with complementary mode
4. Run `makeItWork` to balance
5. If both sides `netValue > 0` and `|netValue| < 15`: execute OR queue offer

### User offers

If partner is `userTeamId`:
- Create `PendingTradeOffer` (expires in 3 days)
- Show in dashboard + trade inbox
- User accept/reject/counter via trade UI

| # | Task | Location |
|---|------|----------|
| 6.1 | `aiTradeMarket.ts` — proposal generation | `trades/aiTradeMarket.ts` |
| 6.2 | Hook into `simulateRegularDay` | `simulateRegularDay.ts` |
| 6.3 | League commands: `acceptTradeOffer`, `rejectTradeOffer` | `applyLeagueCommand.ts` |
| 6.4 | Log + league log entries for AI trades | `leagueLog.ts` |

### Phase 6 tests
- Selling team initiates salary dump trade in sim season
- User receives pending offer, accept executes
- No trades outside window

---

## Phase 7 — Strategy behavior tuning

**Goal:** Modes produce visible, correct behavior in multi-season sims.

### Selling
- FA: prioritize picks in trades; accept negative salary swaps if picks included
- Cap cuts: prefer highest `$ / rosterKeepValue` among vets
- Re-sign: only ≤24 on team-friendly deals
- Trade AI: +35% pick value multiplier (existing, verify)

### Contending
- FA auction: +15% bid cap for ≥72 OVR
- Re-sign: keep core ≥ `RE_SIGN_OVR_CONTENDING` even into tax
- Trade AI: discount picks 20–35%; boost win-now players
- Accept slight negative value (-1 max) for perfect fit at position need ≥8

### Buying (middle)
- Balanced; current behavior baseline

| # | Task | Location |
|---|------|----------|
| 7.1 | Audit + tune constants in `trades/evaluateTrade.ts`, `offers.ts`, `freeAgentScoring.ts` | sim |
| 7.2 | Season sim integration test: selling team ends with more picks + lower payroll | new test |

---

## Phase 8 — Desktop trade & cap UI

**Goal:** Surface new mechanics; make trades usable on desktop.

### Cap sheet additions
- Repeater taxpayer status + surcharge estimate
- Dead cap total + expandable list
- Active TPE list (amount, expires)
- Room MLE eligibility indicator

### Trade page (desktop-first)
- Three-column layout: your assets | proposal | their assets
- Value breakdown per asset: talent / contract surplus / fit / pick
- Net value bar per team with accept threshold marker
- **Suggest balance** button (makeItWork)
- AI response message tier (close / bad / crazy)
- Pending offers inbox tab

| # | Task | Location |
|---|------|----------|
| 8.1 | Extend `CapSheetCard.tsx` | web |
| 8.2 | Extend `useTeamFinancials.ts` — dead cap, repeater, TPE | web |
| 8.3 | Upgrade `routes/league/trades.tsx` | web |
| 8.4 | Trade offers notification on dashboard | `league/index.tsx` |
| 8.5 | Option year indicator + dead cap on `RosterCard` | web |

---

## Phase 9 — Balance audit & release gate

**Goal:** Evidence before v1 tag.

| Audit | Pass criteria |
|-------|---------------|
| Salary distribution | Top 10 players consume 40–55% of cap (tunable) |
| Bad contracts | ≥10% of multi-year deals are trade-negative surplus |
| Trade fleece | 100 random lopsided proposals rejected by AI |
| Mode behavior | Selling team pick count ↑ over 2 offseasons; contending payroll ↑ |
| Market | Strong draft class raises pick/trade values measurably |
| Performance | Full season sim < 5s client-side (30 teams) |

| # | Task |
|---|------|
| 9.1 | `scripts/balance-audit.ts` or Season Lab presets |
| 9.2 | Document tuned constants in spec appendix |
| 9.3 | Update `docs/roadmap.md` statuses |

---

## Recommended execution order

```
Phase 0 (types/migration)
  → Phase 1 (finish spec) — unblocks accurate cap sheet
  → Phase 2 (unified value) — unblocks everything else
  → Phase 3 + 4 (market + mood) — parallel after Phase 2
  → Phase 5 (trade hardening) — depends on Phase 2 + pick values
  → Phase 6 (AI trade market) — depends on Phase 5
  → Phase 7 (strategy tuning) — after 3 + 5 + 6
  → Phase 8 (UI) — incremental alongside each phase
  → Phase 9 (audit)
```

**Suggested PR slicing:**
1. Phase 0 + 1 (financial spec complete)
2. Phase 2 + 3 + 4 (value + market)
3. Phase 5 + 6 (trade engine + AI market)
4. Phase 7 + 8 + 9 (tuning + UI + audit)

---

## Open questions for implementation (defaults assumed)

| Question | Default |
|----------|---------|
| User player-option decisions | AI auto in v1; manual override post-v1 |
| TPE creation on every salary mismatch | Yes, difference only |
| Dead cap stretch years | 2 (light) |
| Performance drift magnitude | ±3 worth points max |
| AI trade frequency | 1–2 proposals per week league-wide |
| User trade offer expiry | 3 sim days |

---

## Appendix: Key files to modify

| File | Phases |
|------|--------|
| `packages/sim/src/playerValue/index.ts` | 2, 3, 5 |
| `packages/sim/src/financials/capMath.ts` | 1.4 |
| `packages/sim/src/financials/freeAgency.ts` | 1.2, 3 |
| `packages/sim/src/financials/contracts/processContracts.ts` | 1.1 |
| `packages/sim/src/trades.ts` → `trades/*` | 1.3, 5, 6 |
| `packages/sim/src/simulateRegularDay.ts` | 6 |
| `apps/web/src/components/league/CapSheetCard.tsx` | 1, 8 |
| `apps/web/src/routes/league/trades.tsx` | 5, 8 |

---

## Success criteria (v1 release)

- [ ] All six spec gaps (options, Room MLE, TPE, repeater, dead cap, Bird reset) implemented with tests
- [ ] Unified `getPlayerWorth` drives salary, trade, FA, cap cuts
- [ ] Market auction produces realistic salary dispersion
- [ ] AI rejects exploitative trades; makeItWork finds fair counters
- [ ] AI teams trade with each other and offer trades to user
- [ ] Pick values reflect draft class quality
- [ ] Cap sheet and trade UI show new mechanics (desktop)
- [ ] Balance audit passes
