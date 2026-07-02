# Team Strategy & Financial AI — Design Spec

**Status:** Approved — pending implementation  
**Date:** 2026-07-02  
**Builds on:** [Contracts & Salary Cap v1](./2026-07-02-contracts-salary-cap-design.md), [Financials v1 Implementation](../plans/2026-07-02-financials-v1-implementation-plan.md)  
**Related:** [Owner, Goals & Narrative Layer](./2026-07-02-owner-goals-narrative-design.md) (future mode overrides)

---

## Summary

Add **`TeamMode`** — a first-class franchise strategy signal (`selling` | `buying` | `contending`) that drives financial AI and future draft/trade systems.

Combined with existing **`taxTolerance`** (how much an owner will spend) and **team quality** (OVR, wins, age), mode answers: *what is this franchise trying to accomplish right now?*

**v1.1 decisions:**
- All strategy fields **visible at team pick** (market, tolerance, mode, cap outlook) for debugging
- Auto-assign mode at league creation; re-evaluate each offseason with hysteresis
- Refactor financial AI: re-sign pass, team-scored FA, salary-aware cuts, tolerance + mode interaction

---

## TeamMode

```ts
type TeamMode = "selling" | "buying" | "contending"
```

| Mode | Franchise intent | Cap / roster posture |
|------|------------------|----------------------|
| **selling** | Lower payroll, accumulate assets, develop youth | Dump salary, minimum deals, let expensive vets walk |
| **buying** | Upgrade roster now, fill holes, spend exceptions | Aggressive FA, use cap room + MLE, targeted upgrades |
| **contending** | Protect core, stay competitive, small tweaks | Re-sign stars, depth minimums, accept tax if tolerance allows |

### Distinction from other concepts

| Concept | Question it answers |
|---------|---------------------|
| **TeamMode** | What direction is the franchise moving? |
| **taxTolerance** | How much is ownership willing to pay? |
| **Owner goals** (future) | What does the GM need to accomplish this season? |
| **Standings** | How good is the team right now? |

A 82 OVR team in **selling** mode is a fire-sale candidate. An 82 OVR **contending** team tries to run it back. Same talent, different behavior.

---

## Data model

```ts
type TeamModeSource = "initial" | "auto" | "owner" | "financial_distress"

type TeamStrategy = {
  mode: TeamMode
  modeSetSeason: number
  source: TeamModeSource
}

// Add to TeamFinancials:
type TeamFinancials = {
  // ... existing fields
  strategy: TeamStrategy
}
```

Future narrative events can set `source: "owner"` and override `mode` without a data model change.

---

## Initial assignment (league creation)

For each team, compute signals from starting roster:

```
avgAge = mean(player.age)
payroll  = team payroll
capSpace = salaryCap - payroll
teamOvr  = team.overall
```

**Rules (priority order):**

1. `payroll > taxLine + 5M` AND `avgAge >= 28` → **selling**
2. `capSpace >= nonTaxpayerMLE × 0.5` AND `teamOvr >= 75` → **buying**
3. `teamOvr >= 78` AND `avgAge <= 27` → **contending**
4. `teamOvr < 72` → **selling**
5. Default → **buying**

Bias by market (soft, not override):

- large market: +weight toward buying/contending
- small market: +weight toward selling

Deterministic from league seed + team index.

---

## Offseason re-evaluation (with hysteresis)

Run **`updateTeamStrategies(league)`** at start of `processOffseasonFinancials`, before FA AI.

Inputs per team:
- Last season wins, playoff appearance
- Current payroll vs cap / tax line
- Average roster age
- Cash reserves and debt
- Current mode

**Proposed flip rules:**

| Signal | Push toward |
|--------|-------------|
| Missed playoffs, payroll over tax, avgAge > 29 | selling |
| Cap space > $15M, wins within 5 of playoff cut line | buying |
| Made playoffs, top-4 seed, core age < 30 | contending |
| debt > $30M | selling (via financial_distress) |

**Hysteresis:** mode does not flip unless:
- 2 consecutive seasons of conflicting signals, OR
- A hard trigger (debt threshold, payroll $20M+ over tax)

Prevents oscillation selling ↔ buying every year.

---

## Financial AI behavior (by mode × tolerance)

### Pass order (offseason)

```
1. updateTeamStrategies
2. assessLeagueSeasonFinances (existing)
3. expireOneYearContracts (existing)
4. processAiReSignings (NEW)
5. processAiFreeAgency (refactored)
6. (at startNextSeason) applyAiCapBehavior (refactored)
```

### 1. Re-sign pass (`processAiReSignings`)

Only own free agents in pool with Bird rights history on team.

| Mode | Re-sign policy |
|------|----------------|
| **selling** | Re-sign only if age ≤ 25 AND salary ≤ fairValue × 0.9 |
| **buying** | Re-sign top 3 OVR; others if cap room allows |
| **contending** | Re-sign all players OVR ≥ 75 up to Bird ceiling |

Tolerance caps offer ceiling (all_in pays up to max; tax_averse pays fairValue × 0.95 max).

### 2. FA scoring (`scoreFreeAgentForTeam`)

```
score = overall
      + positionNeedBonus(team, player.position)    // 0–10
      + modeBonus(mode, player)                     // see below
      + ageFitBonus(mode, player.age)
      - salaryPenalty(expectedOffer, fairSalary)
```

| Mode | modeBonus / ageFit |
|------|-------------------|
| **selling** | +potential gap; −8 if age > 28 |
| **buying** | +overall × 0.1; position need × 1.5 |
| **contending** | +3 if age 27–32; +5 if fills bottom-2 position need |

Select highest-scoring FA per team (not global best OVR).

### 3. Offer construction

```
fairSalary = estimateSalaryFromOverall(overall, yearsOfService, seasonFinancials)
multiplier = modeMultiplier × toleranceMultiplier
offerSalary = clamp(fairSalary × multiplier, minSalary, maxAffordable)
years = modeYears(mode, tolerance)   // selling: 1–2, buying: 2–3, contending: 2–4 for stars
```

### 4. Salary-aware cuts (`computeCapCutScore`)

```
capCutScore = salary × 2 + (90 - overall) + max(0, age - 25)
```

Use for cap relief instead of `computeAiCutScore` when releasing for tax reasons.

| Mode | Cut policy |
|------|------------|
| **selling** | Cut while payroll > taxLine OR above fair payroll for OVR |
| **buying** | No proactive cuts (only roster limit trim) |
| **contending** | Cut only capCutScore outliers (dead money) |

### 5. Tolerance floors (wire existing constants)

Use `TOLERANCE_CASH_FLOOR` from `financialConstants.ts`:

| Tolerance | Stop spending when projected cash below |
|-----------|--------------------------------------|
| tax_averse | +$5M |
| prudent | $0 |
| competitive | -$10M |
| all_in | -$25M |

Mode sets ambition; tolerance sets the budget ceiling.

---

## Future consumers (not this PR)

| System | How mode is used |
|--------|------------------|
| **Draft AI** | selling → BPA/upside; buying → need/ready-now; contending → safe depth |
| **Trades** | selling → favor picks/incoming cap relief; buying → favor incoming stars; contending → neutral, small upgrades |
| **Owner narrative** | owner events force mode changes |

---

## UI — full visibility at team pick

Each team card shows (debug-friendly, all visible):

| Field | Example |
|-------|---------|
| OVR | 78 OVR |
| Market | Large market |
| Tax tolerance | Competitive |
| **Team mode** | **Buying** |
| Payroll | $152.3M |
| Cap outlook | Over tax line |
| Cash | $12.4M |
| Debt | $0 |

Also show mode + tolerance on **Cap sheet** (My Team page).

We can hide fields behind difficulty labels later; for now everything is exposed.

---

## Save migration

Bump **`SAVE_VERSION` to 6**.

`migrateV5ToV6`:
- Add `strategy` to each `TeamFinancials` via `assignInitialTeamStrategy`
- No change to contracts or cap math

---

## Non-goals (this iteration)

- User-adjustable mode
- Owner-driven mode overrides
- Draft AI using mode
- Trade AI using mode
- Cross-team bidding wars

---

## Success metrics (playtest)

After 5 simulated seasons:
- ≥ 70% of 75+ OVR players re-signed by contending/buying teams
- Selling teams average payroll decreases vs league mean
- < 5% of teams fail to reach 12 players before season start
- Mode distribution roughly stable (no >40% of league flipping mode same year)
