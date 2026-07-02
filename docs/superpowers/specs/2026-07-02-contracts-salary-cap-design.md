# Contracts & Salary Cap — Design Spec (v1)

**Status:** Approved — see [Implementation Plan](../plans/2026-07-02-financials-v1-implementation-plan.md)  
**Date:** 2026-07-02  
**Scope:** Planning only. No implementation in this document.

---

## Summary

Add a simplified NBA-style financial layer to Front Office Hoops:

- **Separate `Contract` entity** (Option B) linked to players and teams
- **Soft salary cap** with core exceptions (Bird rights, MLE, minimum, rookie scale)
- **Annual cap growth** using a simplified formula
- **Full luxury tax** with incremental penalty tiers, deducted from team cash
- **Per-team spending profile** preset at league creation (tax tolerance, market tier)
- **AI cap behavior** driven by tolerance + cash/debt pressure
- **Future narrative hooks** for changing owner spending posture (not implemented in v1)

Explicitly **out of v1 scope:** two-apron hard caps, trades (TPE modeled but not enforced), RFA/offer sheets, repeater tax math, sign-and-trade, stretch provision, incentive bonuses, draft pick cap holds.

---

## Goals

1. Every player on a roster has a contract with salary and remaining years.
2. Teams operate under cap, floor, and tax constraints that affect signing decisions.
3. Luxury tax is a real cost — not just a UI label — via team cash/debt.
4. AI teams behave differently based on preset franchise spending profiles.
5. Data model supports future narrative events (owner sale, tax fatigue, championship spending) without a rewrite.

## Non-goals (v1)

- Full CBA fidelity (aprons, aggregation, sign-and-trade, etc.)
- Trade system implementation (design TPE storage only)
- User-adjustable tax tolerance mid-save
- Narrative/AI owner event system
- Repeater taxpayer penalty calculation

---

## Reference: NBA 2024–25 System Levels

Real CBA values used as ratio anchors (amounts in millions USD):

| Level | Amount | Ratio to cap |
|-------|--------|--------------|
| Salary cap | $140.588 | 1.000 |
| Minimum team salary | $126.529 | 0.900 |
| Luxury tax | $170.814 | 1.215 |
| Tax bracket size | $5.168 | 0.037 |
| Non-taxpayer MLE | $12.822 | 0.091 |
| Taxpayer MLE | $5.168 | 0.037 |
| Room MLE | $7.983 | 0.057 |
| Bi-annual | $4.668 | 0.033 |

All scale proportionally when the salary cap grows year-over-year.

---

## Cap Growth

### Real CBA (reference)

Cap = f(BRI) with YoY change clamped to **0% – 10%**. Minimum, tax, and exception amounts scale at the same rate as the cap.

### Game simplification (v1)

Store a base cap for season 1, then:

```
growthRate = seeded per league, range 0.03 – 0.08 (3% – 8%)
cap[n] = cap[n-1] × (1 + growthRate)
```

All derived levels multiply by the same cumulative growth factor:

```
multiplier[n] = cap[n] / cap[1]
luxuryTaxLine[n] = luxuryTaxLine[1] × multiplier[n]
minimumTeamSalary[n] = minimumTeamSalary[1] × multiplier[n]
mleNonTaxpayer[n] = mleNonTaxpayer[1] × multiplier[n]
// etc.
```

Cap settings live on `LeagueFinancials` keyed by season, computed at season rollover.

---

## Max & Min Salaries

### Maximum (by years of service)

Years of service = seasons player has been under contract in the league (including current).

| Years of service | Max (year 1 salary) |
|------------------|---------------------|
| 0–6 | 25% of salary cap |
| 7–9 | 30% of salary cap |
| 10+ | 35% of salary cap |

Also allow **105% of prior season salary** when that exceeds the tier max.

**Deferred:** Derrick Rose 30% tier, designated veteran/supermax extensions.

### Minimum (simplified 3-tier scale)

Scale amounts from NBA minimum salary table, grouped:

| Tier | Years of service |
|------|------------------|
| Tier 1 | 0–2 |
| Tier 2 | 3–9 |
| Tier 3 | 10+ |

All minimum amounts scale with cap growth.

### Contract structure

| Rule | Value |
|------|-------|
| Annual raise (outside FA / non-Bird) | 5% of year-1 salary |
| Annual raise (Bird re-sign) | 8% of year-1 salary |
| Max length — outside FA | 4 years |
| Max length — Bird re-sign | 5 years |
| Options (v1) | Team or player option on final year only |

---

## Exceptions (v1)

| Exception | Amount | Max years | Notes |
|-----------|--------|-----------|-------|
| Bird | Up to max salary | 5 | 3+ consecutive seasons with team |
| Early Bird | max(175% prior salary, 105% avg salary) | 2+ | 2 consecutive seasons with team |
| Non-Bird | 120% prior salary | 1+ | Everyone else returning |
| Non-taxpayer MLE | ~9.1% of cap | 4 | One pool per team per season |
| Taxpayer MLE | ~3.7% of cap | 2 | Smaller pool if over tax line |
| Room MLE | ~5.7% of cap | 3 | Only if team was under cap at any point in cap year |
| Minimum | Min salary scale | 1–2 | Fill roster slots |
| Rookie scale | Pick slot table | 2+2 options | 1st round picks only |

**Simplifications:**
- No bi-annual exception in v1 (can add later)
- No apron triggers when using MLE
- No proration by signing date (full season amounts)
- TPE stored on team but not usable until trades exist

### Bird rights tracking

On `Player`:

```ts
seasonsWithTeam: number  // consecutive seasons with current team; resets on FA sign elsewhere
```

Derived at offseason:

| seasonsWithTeam | Rights |
|-----------------|--------|
| 0 | None (incoming FA) |
| 1 | Non-Bird (if re-signing same team) |
| 2 | Early Bird |
| 3+ | Bird |

---

## Luxury Tax (full penalty)

### Calculation

At **end of regular season**, compute tax on team payroll:

```
overage = max(0, teamPayroll - luxuryTaxLine)
```

Apply incremental rates on each tax-bracket slice (bracket size scales with cap):

| Slice above tax line | Rate (v1) |
|----------------------|-----------|
| 1st bracket | $1.50 per $1 |
| 2nd bracket | $1.75 per $1 |
| 3rd bracket | $2.50 per $1 |
| 4th bracket | $3.25 per $1 |
| Each additional bracket | prior rate + $0.50 |

**Deferred:** Repeater taxpayer surcharge (+$1 per dollar per bracket). Field `consecutiveTaxSeasons` stored for future use.

### Payment

```
seasonRevenue = baseRevenue(marketTier) + performanceBonus(wins, playoffRound)
netCashFlow = seasonRevenue - teamPayroll - luxuryTaxBill
cashReserves += netCashFlow
if cashReserves < 0:
  debt += abs(cashReserves)
  cashReserves = 0
```

Tax is never optional — if payroll exceeds the tax line, the bill is owed.

---

## Team Spending Profile (Option C)

Each team gets a **preset spending profile at league creation**. The user inherits their chosen franchise's profile. Profiles are fixed for v1 but designed to change via future narrative events.

### Types

```ts
type MarketTier = 'large' | 'mid' | 'small'

type TaxTolerance =
  | 'tax_averse'      // aggressively avoids tax
  | 'prudent'         // tolerates brief tax, not sustained
  | 'competitive'     // pays tax for contention
  | 'all_in'          // tax is cost of winning

type TeamSpendingProfile = {
  marketTier: MarketTier
  taxTolerance: TaxTolerance
  baseTaxTolerance: TaxTolerance  // original preset; survives future event rollbacks
}
```

`baseTaxTolerance` is set once at league gen and never changes unless a narrative event explicitly resets ownership. `taxTolerance` is the **effective** value — equals `baseTaxTolerance` in v1, mutable in future via events.

### Assignment at league creation

Seeded distribution across 30 teams:

| taxTolerance | Target share | Typical market skew |
|--------------|--------------|---------------------|
| tax_averse | ~20% | small market |
| prudent | ~35% | small / mid |
| competitive | ~30% | mid / large |
| all_in | ~15% | large market |

Assignment algorithm:

1. Assign `marketTier` per team (deterministic from seed + team index)
2. Weighted random `taxTolerance` biased by market tier
3. Store on `TeamFinancials.spendingProfile`

User sees their team's profile on the cap sheet after picking a team (not before — discovering franchise identity is part of the game). See [Owner, Goals & Narrative Layer](./2026-07-02-owner-goals-narrative-design.md) for the phased UI plan (market/cap visible at pick; owner archetype revealed after selection; full difficulty badge when owner system ships).

### Future narrative events (not v1)

Architecture supports an event log that mutates `taxTolerance`:

```ts
type SpendingProfileEvent = {
  id: string
  teamId: string
  season: number
  type:
    | 'owner_sale'           // new owner shifts tolerance
    | 'tax_fatigue'          // N consecutive tax seasons → spend less
    | 'championship_bonus'   // title(s) → owner opens wallet
    | 'financial_distress'   // high debt → forced austerity
  previousTolerance: TaxTolerance
  newTolerance: TaxTolerance
  narrativeKey?: string       // hook for AI narrative layer
}
```

Examples (future):

- **Owner sale:** `competitive` → `tax_averse` or `all_in` depending on new owner archetype
- **3+ consecutive tax seasons:** step down one tolerance level (unless `all_in`)
- **Back-to-back titles:** step up one tolerance level (cap at `all_in`)

v1 stores `spendingProfileEvents: []` on league record (empty array).

---

## AI Cap Behavior

AI decisions run during offseason (and when filling roster):

### Inputs

- `taxTolerance` (effective)
- `cashReserves`, `debt`
- `projectedPayroll`, `projectedTaxBill` for next season
- `projectedCashAfterSeason = cashReserves + revenue - payroll - tax`

### Tolerance floors (minimum acceptable projected cash after season)

| taxTolerance | Floor ($M) |
|--------------|------------|
| tax_averse | +5 |
| prudent | 0 |
| competitive | -10 |
| all_in | -25 |

### Actions (priority order)

1. **If `tax_averse` and projected payroll > tax line:** release or decline options on highest-salary/lowest-value players until under tax line (use existing `releasePlayer` mechanic in v1)
2. **If projected cash < tolerance floor:** don't re-sign expensive FAs; prefer minimum contracts
3. **If debt > threshold (e.g. $30M):** forced austerity regardless of tolerance — step effective behavior down one level
4. **If contending (top 4 seed last season) and `competitive`/`all_in`:** retain core even if tax bill is high

When trades are added, replace step 1 releases with trade attempts where possible.

---

## Data Model

### New types (`packages/shared`)

#### Contract

```ts
type ContractType = 'standard' | 'rookie_scale' | 'minimum' | 'two_way'  // two_way deferred

type SigningException =
  | 'cap_room'
  | 'bird'
  | 'early_bird'
  | 'non_bird'
  | 'mle_non_taxpayer'
  | 'mle_taxpayer'
  | 'mle_room'
  | 'minimum'
  | 'rookie_scale'

type ContractOption = {
  yearIndex: number       // index into yearlySalaries
  type: 'team' | 'player'
}

type ContractStatus = 'active' | 'expired' | 'waived' | 'declined'

type Contract = {
  id: string
  playerId: string
  teamId: string
  startSeason: number
  endSeason: number
  yearlySalaries: number[]   // millions; index 0 = current season at start of cap year
  contractType: ContractType
  signingException: SigningException
  options?: ContractOption[]
  status: ContractStatus
  signedSeason: number
}
```

#### LeagueFinancials

```ts
type LeagueFinancials = {
  baseCap: number              // season 1 cap (e.g. 141)
  growthRate: number           // e.g. 0.05
  bySeason: Record<number, SeasonFinancials>
}

type SeasonFinancials = {
  season: number
  salaryCap: number
  minimumTeamSalary: number
  luxuryTaxLine: number
  taxBracketSize: number
  averageSalary: number        // cap / 15, used for Early Bird
  mleNonTaxpayer: number
  mleTaxpayer: number
  mleRoom: number
  minimumSalaries: { tier1: number; tier2: number; tier3: number }
  rookieScale: number[]        // index 0 = pick 1 salary, length 30 (or 60 for 2 rounds)
}
```

#### TeamFinancials

```ts
type TradeException = {
  id: string
  amount: number
  createdSeason: number
  expiresSeason: number        // createdSeason + 1
  originDescription: string    // e.g. "Traded Player X" — populated when trades exist
}

type TeamFinancials = {
  teamId: string
  spendingProfile: TeamSpendingProfile
  cashReserves: number
  debt: number
  consecutiveTaxSeasons: number
  lastTaxBill: number | null
  mleUsed: number              // amount consumed this cap year
  mleRemaining: number         // computed at cap year start
  wasUnderCapThisYear: boolean // for room MLE eligibility
  tradeExceptions: TradeException[]
}
```

#### Player additions

```ts
// Add to existing Player type:
activeContractId: string | null
seasonsWithTeam: number
yearsOfService: number
```

### LeagueRecord additions

```ts
type LeagueRecord = {
  // ... existing fields
  contracts: Contract[]
  leagueFinancials: LeagueFinancials
  teamFinancials: TeamFinancials[]   // one per team, keyed by teamId
  spendingProfileEvents: SpendingProfileEvent[]  // empty in v1
}
```

Contracts are stored at league level (not embedded in season state) so they persist across season archives. Active contracts referenced by `Player.activeContractId`.

---

## Payroll & Cap Space

### Team payroll (cap hit)

```
teamPayroll = sum(contract.yearlySalaries[0] for each active contract where teamId matches)
```

At start of cap year, advance all contracts: shift or decrement `yearlySalaries` (implementation choice: either pop index 0 or track `currentYearIndex`).

### Cap space

```
capSpace = salaryCap - teamPayroll
```

Negative cap space means team is over the cap (soft cap — can still sign with exceptions).

### Validation at season start

- Roster size: 12 players (existing `ROSTER_MAX`)
- Minimum team salary: if payroll < floor at season start, charge team a floor penalty equal to the shortfall (distributed conceptually; deduct from cash)
- No hard block for being over cap (soft cap)

---

## Offseason Sequence (updated)

Current flow: development → draft → startNextSeason.

Proposed flow:

```
1. beginOffseason
   └─ player development (existing)

2. processContracts
   └─ exercise/decline options (AI auto-decides)
   └─ expire contracts (status → expired, clear activeContractId)
   └─ move expired players to freeAgentPool, status → free_agent
   └─ increment yearsOfService for returning players
   └─ reset seasonsWithTeam for players who left

3. rollFinancialYear
   └─ compute SeasonFinancials for new season
   └─ reset mleUsed, wasUnderCapThisYear
   └─ expire old TPEs

4. processFreeAgency (new)
   └─ AI re-signs own FAs (Bird rights priority)
   └─ AI signs external FAs from pool
   └─ user can sign FAs (UI)

5. prepareDraft / makeDraftPick (existing)
   └─ attach rookie_scale contracts to drafted players

6. startNextSeason (existing + additions)
   └─ validate rosters and cap floor
   └─ AI cap cleanup if over tolerance targets
```

Tax assessment happens at **end of regular season** (before or during transition to `complete` phase), not in offseason.

---

## Initial Contract Generation

When a league is created, backfill contracts for all roster players:

1. Assign salary based on OVR, age, and potential (curve: elite players near max for their service tier, bench players near minimum)
2. Random remaining years: 1–4 (weighted toward 2–3)
3. Set `yearsOfService` from age heuristic (e.g. `max(0, age - 19)`)
4. Set `seasonsWithTeam` = `yearsOfService` for v1 (all players "homegrown" unless we add FA history later)
5. Store contracts in `LeagueRecord.contracts`, link via `activeContractId`

Deterministic from league seed for reproducibility.

---

## Rookie Scale

First-round picks (`draftInfo.round === 1`):

- 2 guaranteed years + 2 team option years
- Salary from `rookieScale[pickNumber - 1]` (pick 1 = highest)
- `signingException: 'rookie_scale'`

Second-round picks:

- 2-year minimum-ish deal
- `signingException: 'minimum'` or dedicated second-round scale (simplified: tier-1 minimum × 1.2)

---

## Free Agency (v1)

### Signing rules

- User and AI can offer contracts to `freeAgentPool` players
- Offer must satisfy: max salary for player's service tier, min years/salary for exception used, team has cap room or valid exception
- On sign: create `Contract`, set `player.teamId`, remove from pool, reset `seasonsWithTeam = 0`

### Offer types

| Situation | Exception |
|-----------|-----------|
| Team has cap room ≥ offer year-1 | cap_room |
| Re-signing own FA with Bird rights | bird / early_bird / non_bird |
| Over cap, non-taxpayer MLE available | mle_non_taxpayer |
| Over cap and tax line | mle_taxpayer |
| Minimum slot | minimum |

---

## UI Surfaces (v1)

| Surface | Content |
|---------|---------|
| Team cap sheet | Payroll, cap, cap space, tax line, projected tax, cash, debt, tolerance label |
| Roster table | Salary column, years remaining, option indicator |
| Free agency | Available FAs, offer builder with cap impact preview |
| League financials (optional) | Current season cap/tax/MLE amounts |

Show warnings (not hard blocks) when user action triggers tax or drains cash below zero.

---

## Save Migration

Bump `SAVE_VERSION` to 5.

`normalizeLeagueRecord` for v4 → v5:

1. Generate `leagueFinancials` with default base cap and growth rate
2. Generate `teamFinancials` with spending profiles per team
3. Generate initial contracts for all roster players
4. Set player fields: `activeContractId`, `seasonsWithTeam`, `yearsOfService`
5. Initialize `spendingProfileEvents: []`

Existing saves get plausible backfilled financials; no gameplay regression.

---

## Package Layout

| Package | New modules |
|---------|-------------|
| `packages/shared` | `contractTypes.ts`, `financialTypes.ts`, financial constants |
| `packages/sim` | `financials/` — cap math, tax calc, contract lifecycle, FA signing, AI cap logic |
| `packages/sim/tests` | Cap growth, max salary, tax tiers, Bird rights, contract expiration, migration |
| `apps/web` | Cap sheet component, roster salary column, FA signing UI |

---

## Testing Strategy

Pure functions with Vitest (same pattern as draft/roster):

- `calculateSeasonFinancials(baseCap, growthRate, season)` — growth math
- `calculateMaxSalary(cap, yearsOfService, priorSalary?)` — tier + 105% rule
- `calculateLuxuryTax(payroll, taxLine, bracketSize)` — incremental tiers
- `deriveBirdRights(seasonsWithTeam)` — rights tier
- `canSignPlayer(team, player, offer, context)` — validation
- `processContractExpiration(contracts, players)` — offseason step
- `assignSpendingProfiles(teams, rng)` — deterministic profile assignment
- Migration test: v4 save normalizes to v5 with contracts

---

## Implementation Phases (suggested)

| Phase | Deliverable |
|-------|-------------|
| **1 — Types & constants** | Shared types, financial constants, SAVE_VERSION bump |
| **2 — Cap math** | Growth, max/min, tax calculation, season financials |
| **3 — Contracts** | Entity CRUD, initial generation, expiration, options |
| **4 — Team finances** | Spending profiles, cash/revenue/tax at season end |
| **5 — Free agency** | Signing validation, AI re-sign/sign logic |
| **6 — Draft integration** | Rookie scale on draft picks |
| **7 — UI** | Cap sheet, roster salaries, FA UI |
| **8 — Migration** | v4 → v5 normalize + tests |

Phases 1–4 can ship as "contracts visible, tax at season end" before FA UI is complete.

---

## Open Questions (resolved)

| Question | Decision |
|----------|----------|
| Contract model | Option B — separate entity |
| Luxury tax | Full incremental penalty |
| User tax tolerance | Option C — preset per team at league gen; narrative events change later |
| Two aprons | Deferred |
| Trades / TPE | Model TPE on team; enforce when trades ship |

---

## Appendix: Tax Calculation Example

Cap year financials: tax line = $171M, bracket = $5.2M.

Team payroll = $185M → overage = $14M.

| Bracket | Overage in slice | Rate | Tax |
|---------|------------------|------|-----|
| 1st $5.2M | $5.2M | ×1.50 | $7.8M |
| 2nd $5.2M | $5.2M | ×1.75 | $9.1M |
| 3rd $5.2M | $3.6M | ×2.50 | $9.0M |
| **Total** | **$14M** | | **$25.9M** |

Tax bill of $25.9M deducted from team cash at season end.
