# Foundation — Offseason, Draft, Contracts & FA Implementation Plan

**Status:** Ready to execute  
**Date:** 2026-07-03  
**Scope:** Sim-layer foundation work before GM UI features  
**Save version:** 6 → 7  
**Prerequisite:** Player generation variance fix (PR #8 — tiered roster depth)

---

## Overview

This plan covers everything discussed for getting the core loop solid enough to test contracts, drafting, and roster management before investing in GM UI polish.

### Goals

1. Draft runs in **every** offseason starting after season 1
2. Young players get **rookie-scale / minimum** deals, not full OVR-based veteran contracts
3. Offseason is a **phased loop**: re-signing → draft → free agency
4. User re-signs first; AI re-signs and external FA run after user actions
5. Draft class matches NBA pick count (60) but generates a **larger prospect pool** with realistic tier distribution
6. FA pool is seeded at league creation and topped up each FA phase (target: **1–1.5× team count** available FAs)
7. Roster floor during offseason: **>5 players**, at least **one per primary position**

### Explicitly deferred (document only)

- In-game over-usage / fatigue penalties (requires stamina tracking; no injuries yet)
- Full GM UI (re-sign screen, dedicated FA route, narrative)
- Contract option exercise AI
- RFA / qualifying offers

---

## Current vs target behavior

| Area | Current | Target |
|------|---------|--------|
| First draft | After season 2 | After season 1 |
| Offseason | Single blob; AI acts on "Begin Offseason" | Sub-phases with gates |
| Re-signing | Same FA panel; AI goes first | User first, then "Sim AI re-signings" |
| External FA | Runs at begin offseason | Runs in FA phase after draft |
| League-start contracts | All OVR-based `standard` | Young/low-YoS → scale or minimum |
| Draft contracts | Web hook only on manual pick | Sim layer on every pick path |
| Draft class | 60 prospects = 60 picks (no undrafted) | Class > pick count; tiered talent |
| FA pool at start | Empty | Seeded veterans |
| FA pool each year | Expired + releases + undrafted only | + top-up batch if below threshold |
| Roster rules | Exactly 12 to start season | Floor 6 + position coverage in offseason |

---

## Architecture

```
packages/shared/src/
  seasonTypes.ts          # + OffseasonPhase, SeasonState.offseasonPhase
  constants.ts            # + ROSTER_MIN, FA_POOL_MIN_RATIO, DRAFT_CLASS_MULTIPLIER

packages/sim/src/
  offseason/
    index.ts
    phases.ts               # advanceOffseasonPhase, phase guards
    beginOffseason.ts       # (move/refactor) development + expire only
    reSigning.ts            # user + AI re-sign helpers
  draft/
    isDraftRequired.ts      # >= 1
    generateDraftClass.ts   # tiered, expanded class
    makeDraftPick.ts        # + attach rookie contract (via league callback or return type)
  financials/
    contracts/createContract.ts   # route young players to scale/min
    freeAgency.ts                 # ensureFaPoolMinimum, seedInitialFaPool
    index.ts                      # split processOffseasonFinancials
  roster/
    rosterManagement.ts     # validateRosterFloor, position coverage
  createLeague.ts           # seed FA pool at init

apps/web/src/
  contexts/LeagueContext.tsx    # phase gates
  hooks/useLeague.ts            # phase actions, defer financial batch
  components/league/SeasonPhaseCard.tsx
  components/league/FreeAgencyPanel.tsx   # filter re-sign vs external (minimal)
```

### Offseason state machine

```
Begin Offseason
  → expire contracts, development, assess finances
  → offseasonPhase = 're_signing'

Re-signing phase
  → user re-signs own expired players (FreeAgencyPanel filtered)
  → "Sim AI re-signings" → processAiReSignings
  → "Proceed to draft" → offseasonPhase = 'draft'

Draft phase
  → Prepare draft (if no draftState)
  → Run draft (all pick paths attach rookie contracts)
  → undrafted → FA pool
  → "Proceed to free agency" → offseasonPhase = 'free_agency'

Free agency phase
  → ensureFaPoolMinimum (top-up if thin)
  → user signs FAs
  → "Sim AI free agency" → processAiFreeAgency
  → validate roster floor + position coverage
  → "Start Season N+1" (requires exactly 12)
```

---

## Phase 1 — Draft after season 1

**Goal:** First offseason includes draft. Smallest possible change; unblocks testing.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 1.1 | Change `isDraftRequired` to `completedSeason >= 1` | `packages/sim/src/draft/isDraftRequired.ts` |
| 1.2 | Update test `"does not require a draft before season 2"` → requires draft after season 1 | `packages/sim/tests/draft.test.ts` |
| 1.3 | Simplify `runToDraftOffseason` helper — one season, not two | `packages/sim/tests/draft.test.ts` |
| 1.4 | Verify `canPrepareDraft` in LeagueContext works when `season === 1` and phase is offseason | `apps/web/src/contexts/LeagueContext.tsx` (likely no change) |

### Verification

```bash
npm run test --workspace=@workspace/sim -- draft
```

Manual: complete season 1 → begin offseason → "Prepare draft" button visible.

---

## Phase 2 — Rookie & young-player contracts

**Goal:** Age-appropriate salaries at league creation and on every draft pick.

### Contract routing rules (v1)

| Player profile | Contract type | Salary basis |
|----------------|---------------|--------------|
| Drafted (any round) | `rookie_scale` (R1) or `minimum` (R2) | Pick slot / min tier |
| Age ≤ 22 AND YoS ≤ 2 at league init | `minimum` | Min salary tier (not OVR curve) |
| Age 23–24 AND YoS ≤ 3 at league init | `minimum` or discounted scale | Cap at ~120% min tier, not OVR max |
| Age 25+ or YoS ≥ 4 | `standard` | Existing OVR curve |

Adjust thresholds in implementation; goal is **no 19–20 year old on a $25M+ deal**.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 2.1 | Add `createMinimumContract(player, teamId, season, seasonFinancials, years?)` if not sufficient | `financials/contracts/createContract.ts` |
| 2.2 | Add `resolveInitialContractType(player)` helper | `financials/contracts/createContract.ts` |
| 2.3 | Update `generateInitialContract` to route by age/YoS | `financials/contracts/createContract.ts` |
| 2.4 | Bias initial contract years: young players 1–2 years, veterans 2–4 | `financials/contracts/createContract.ts` |
| 2.5 | Move rookie contract attach into sim: extend `makeDraftPick` to accept optional `LeagueRecord` and return updated contracts, OR add `makeDraftPickWithContract(league, ...)` | `draft/makeDraftPick.ts`, `financials/index.ts` |
| 2.6 | Remove duplicate attach from web-only path; keep thin wrapper in `useLeague` | `apps/web/src/hooks/useLeague.ts` |
| 2.7 | Fix `simAiPick` / `simToUserPick` / `simDraftUntilComplete` to use contract attach | `draft/simAiPick.ts`, `useLeague.ts` |
| 2.8 | Tests: 19yo high-OVR player gets min deal; drafted R1 gets scale slot | `packages/sim/tests/financials/contracts.test.ts` (new) |

### Verification

```bash
npm run test --workspace=@workspace/sim -- financials
```

Manual: inspect cap sheet after league creation — bench 19–20 year olds should be low salary.

---

## Phase 3 — Offseason sub-phases (core)

**Goal:** Replace monolithic offseason with gated sub-phases. Biggest structural change.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 3.1 | Add `OffseasonPhase = 're_signing' | 'draft' | 'free_agency'` | `packages/shared/src/seasonTypes.ts` |
| 3.2 | Add `offseasonPhase?: OffseasonPhase` to `SeasonState` (set when entering offseason) | `packages/shared/src/seasonTypes.ts` |
| 3.3 | Split `processOffseasonFinancials`: **open** = strategies + assess + expire only; remove AI re-sign + AI FA | `financials/index.ts` |
| 3.4 | Add `openOffseason(league, rng)` export | `offseason/index.ts` or `financials/index.ts` |
| 3.5 | Add `advanceToDraftPhase(state)` — sets `offseasonPhase: 'draft'`, validates re-signing complete flag or allows skip if no expiring players | `offseason/phases.ts` |
| 3.6 | Add `advanceToFreeAgencyPhase(state, league, rng)` — runs `ensureFaPoolMinimum`, sets `offseasonPhase: 'free_agency'` | `offseason/phases.ts` |
| 3.7 | Add `completeReSigningPhase(league, rng)` — calls `processAiReSignings` | `offseason/reSigning.ts` |
| 3.8 | Add `completeFreeAgencyPhase(league, rng)` — calls `processAiFreeAgency` | `offseason/phases.ts` |
| 3.9 | Update `startNextSeason` to require `offseasonPhase === 'free_agency'` (or completed FA) and draft done | `startNextSeason.ts` |
| 3.10 | Update `beginOffseason` to set `offseasonPhase: 're_signing'` | `beginOffseason.ts` |
| 3.11 | Bump `SAVE_VERSION` to 7; migration: offseason saves get `offseasonPhase: 're_signing'` if phase is `'offseason'` | `leagueTypes.ts`, `normalizeLeague.ts`, `migrateV6ToV7.ts` |
| 3.12 | Export new functions from `packages/sim/src/index.ts` | `index.ts` |

### Verification

```bash
npm run test --workspace=@workspace/sim
```

Unit tests for phase transitions: invalid skips throw; valid sequence succeeds.

---

## Phase 4 — Re-signing flow (user first, then AI)

**Goal:** User gets first crack at own expiring players before AI acts.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 4.1 | Add `getTeamExpiredFreeAgents(league, teamId)` — FA pool players with expired contract on that team | `financials/freeAgency.ts` or `offseason/reSigning.ts` |
| 4.2 | Add `getExternalFreeAgents(league, teamId)` — everyone else in pool | same |
| 4.3 | Update `FreeAgencyPanel` to accept `mode: 're_sign' | 'external'` | `FreeAgencyPanel.tsx` |
| 4.4 | My Team page: show re-sign panel in re_signing phase; external FA panel in free_agency phase | `routes/league/team.tsx` |
| 4.5 | Add `canProceedToDraft`, `canProceedToFreeAgency`, `canSimAiReSignings`, `canSimAiFreeAgency` to LeagueContext | `LeagueContext.tsx` |
| 4.6 | SeasonPhaseCard buttons: "Sim AI re-signings" → "Proceed to draft" → "Proceed to free agency" → "Sim AI free agency" → "Start season" | `SeasonPhaseCard.tsx` |
| 4.7 | Wire actions in `useLeague.ts`; remove AI re-sign/FA from `beginOffseasonAction` | `useLeague.ts` |
| 4.8 | Optional: Bird-rights label on re-sign targets (prior salary, exception type) | `FreeAgencyPanel.tsx` |

### Verification

Manual flow:
1. Begin offseason — no AI signings yet
2. Re-sign one of your expiring players
3. Sim AI re-signings — other teams re-sign
4. Proceed to draft

---

## Phase 5 — Draft class expansion & tiered generation

**Goal:** NBA-sized draft (60 picks) with a larger prospect pool and realistic talent distribution.

### Constants (proposed)

| Constant | Value | Notes |
|----------|-------|-------|
| `DRAFT_ROUNDS` | 2 | unchanged |
| `DRAFT_CLASS_MULTIPLIER` | 1.5 | 30 teams → 90 prospects, 60 picks → ~30 undrafted |
| Mini league (6 teams) | 18 prospects, 12 picks | scale proportionally |

For FA minimum (Phase 6): `FA_POOL_MIN_COUNT = teamCount * 1.25` (midpoint of 1–1.5×).

### Prospect tiers (by index in sorted class)

| Tier | Slots (of 60) | Overall base | Potential gap |
|------|---------------|--------------|---------------|
| Lottery | 1–14 | 58–68 | +12 to +22 |
| Mid-first | 15–30 | 52–60 | +8 to +16 |
| Second round | 31–60 | 48–56 | +4 to +12 |
| Deep field (undrafted range) | 61+ | 45–52 | +2 to +20 (wider variance) |

Implementation: assign tier by generation index before shuffling or by explicit `projectedPick` field; sort/display by scout rank. Add some **low-potential, ready-now** profiles in second round (gap +2–6).

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 5.1 | Add `DRAFT_CLASS_MULTIPLIER` and `getDraftClassSize(teamCount)` | `constants.ts`, `isDraftRequired.ts` |
| 5.2 | Refactor `generateDraftClass` to use tiers | `draft/generateDraftClass.ts` |
| 5.3 | Add zero-sum position shaping (reuse pattern from `generatePlayers.ts`) | `draft/generateDraftClass.ts` |
| 5.4 | Ensure `finalizeDraftPool` receives undrafted prospects (class size > pick count) | `draft/completeDraft.ts` |
| 5.5 | Tests: class size, tier bounds, not all high potential, undrafted count > 0 | `draft.test.ts` |

### Verification

```bash
npm run test --workspace=@workspace/sim -- draft
```

Inspect draft board: mix of high/low OVR and potential; undrafted appear in FA after draft.

---

## Phase 6 — FA pool seeding & top-up

**Goal:** Active FA market from day one; each FA phase ensures 1–1.5× team count available.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 6.1 | Add `FA_POOL_MIN_RATIO = 1.25` (or min/max 1.0–1.5 configurable) | `constants.ts` |
| 6.2 | Add `generateFreeAgentPool(count, rng, teamOverallAnchor?)` — vet-minimum profiles, ages 25–35, OVR 45–65 | `generateFreeAgents.ts` (new) |
| 6.3 | Add `seedInitialFreeAgentPool(league, rng)` — call from `createLeague` after financial init | `createLeague.ts` |
| 6.4 | Add `ensureFaPoolMinimum(league, rng)` — if `freeAgentPool.length < teamCount * FA_POOL_MIN_RATIO`, generate batch | `financials/freeAgency.ts` |
| 6.5 | Call `ensureFaPoolMinimum` in `advanceToFreeAgencyPhase` | `offseason/phases.ts` |
| 6.6 | Generated FAs have no prior team (`teamId: null`), minimum contracts or FA-ready without contract until signed | `generateFreeAgents.ts` |
| 6.7 | Tests: league creation pool ≥ threshold; top-up fires when pool thin | `createLeague.test.ts`, `financials/integration.test.ts` |

### Verification

New league: FA pool non-empty before season 1. After draft + proceed to FA: pool ≥ 30 for 30-team league.

---

## Phase 7 — Roster floor & position rules

**Goal:** Prevent unplayable rosters during offseason; still require 12 to start season.

### Rules

- **Offseason floor:** roster size **≥ 6** (`ROSTER_MIN = 6`)
- **Position coverage:** at least one player at each of PG, SG, SF, PF, C
- **Season start:** exactly **12** players (unchanged)
- **Release validation:** block release if it would violate floor or position rules

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 7.1 | Add `ROSTER_MIN = 6` and `PRIMARY_POSITIONS` | `constants.ts` |
| 7.2 | Add `validateRosterFloor(players)` → `{ ok, reason? }` | `roster/rosterManagement.ts` |
| 7.3 | Add `hasPositionCoverage(players)` | `roster/rosterManagement.ts` |
| 7.4 | Call floor check in `releasePlayer` when in offseason | `rosterManagement.ts` + phase context or always for user |
| 7.5 | Update `canStartNextSeason`: still requires 12; add floor check for intermediate phases (can't proceed to next season with <6) | `LeagueContext.tsx`, `startNextSeason.ts` |
| 7.6 | Tests: cannot cut below 6; cannot cut last PG | `rosterManagement.test.ts` (new) |

### Verification

Try releasing down to 5 — blocked. Try releasing only center — blocked.

---

## Phase 8 — Web integration & testing checklist

**Goal:** Wire everything for end-to-end manual testing without full GM UI.

### Tasks

| # | Task | File(s) |
|---|------|---------|
| 8.1 | Update `SeasonPhaseCard` description copy per sub-phase | `SeasonPhaseCard.tsx` |
| 8.2 | Disable draft nav link until `offseasonPhase >= 'draft'` (optional but reduces confusion) | `LeagueNav.tsx` |
| 8.3 | Surface sim errors (prepareDraft, phase advance) via toast or inline error | `useLeague.ts` |
| 8.4 | Update `docs/simulation-engine.md` offseason section | docs |
| 8.5 | Update `docs/data-model.md` with `offseasonPhase` | docs |

### End-to-end manual test script

1. Create new league (mini or full)
2. Verify young bench salaries are low
3. Verify initial FA pool populated
4. Sim season 1 → playoffs → complete → begin offseason
5. Re-signing phase: re-sign a player, sim AI re-signings
6. Draft phase: prepare draft, sim to completion
7. Verify undrafted in FA pool; verify drafted players have rookie contracts
8. Free agency phase: verify pool ≥ 1.25× teams; sign a FA; sim AI FA
9. Cut to 12 (respecting floor during cuts)
10. Start season 2

---

## Phase 9 — Deferred: in-game over-usage

**Not in this implementation.** Document for future:

- Track rolling minutes per player per game / week
- Apply efficiency penalty when starter exceeds ~38 min/game average or back-to-back heavy minutes
- Scale by `stamina` rating and age
- Hooks: `simulateTeamMatchup.ts`, `allocatePlayerStats.ts`

---

## Execution order (recommended)

Execute phases **in order** — later phases depend on earlier ones:

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
```

Within a session, parallelizable pairs:
- Phase 5 (draft class) and Phase 6 (FA pool) after Phase 3
- Phase 2 (contracts) can start before Phase 3 but must finish before Phase 4 testing

**Suggested first PR:** Phases 1 + 2 (draft gate + contracts) — immediate testing value.  
**Second PR:** Phase 3 + 4 (offseason phases + re-signing).  
**Third PR:** Phases 5 + 6 + 7 (draft class, FA pool, roster rules).  
**Fourth PR:** Phase 8 (integration polish + docs).

---

## Save migration (v6 → v7)

```typescript
// migrateV6ToV7.ts
if (record.seasonState.phase === 'offseason' && !record.seasonState.offseasonPhase) {
  // Best-effort: if draft complete → free_agency; else if draftState → draft; else re_signing
  record.seasonState.offseasonPhase = inferOffseasonPhase(record.seasonState)
}
```

Add to `normalizeLeague.ts` chain.

---

## Success criteria

- [ ] Draft available after season 1 offseason
- [ ] No 19–20 year old with multi-million OVR-based deal at league start
- [ ] All draft pick paths attach rookie contracts
- [ ] Offseason sub-phases enforce re-sign → draft → FA order
- [ ] User re-signs before AI; AI external FA only in FA phase
- [ ] Draft class has tiered prospects; undrafted enter FA
- [ ] FA pool ≥ 1.25× team count at FA phase open
- [ ] Cannot release below 6 players or lose position coverage
- [ ] All sim tests pass; manual E2E script completes
- [ ] `SAVE_VERSION = 7`; existing saves migrate

---

## Key file index

| Concern | Path |
|---------|------|
| Season / phase types | `packages/shared/src/seasonTypes.ts` |
| Draft required gate | `packages/sim/src/draft/isDraftRequired.ts` |
| Draft class | `packages/sim/src/draft/generateDraftClass.ts` |
| Draft pick + contracts | `packages/sim/src/draft/makeDraftPick.ts` |
| Offseason open | `packages/sim/src/beginOffseason.ts` |
| Financial batch | `packages/sim/src/financials/index.ts` |
| Initial contracts | `packages/sim/src/financials/contracts/createContract.ts` |
| FA signing | `packages/sim/src/financials/freeAgency.ts` |
| AI re-sign | `packages/sim/src/financials/ai/reSignings.ts` |
| Roster rules | `packages/sim/src/roster/rosterManagement.ts` |
| League creation | `packages/sim/src/createLeague.ts` |
| UI gates | `apps/web/src/contexts/LeagueContext.tsx` |
| UI actions | `apps/web/src/hooks/useLeague.ts` |
| Phase card | `apps/web/src/components/league/SeasonPhaseCard.tsx` |
| Player generation (done) | `packages/sim/src/generatePlayers.ts` |

---

**Start with Phase 1, Task 1.1** — one-line gate change plus test update to unblock draft testing immediately.
