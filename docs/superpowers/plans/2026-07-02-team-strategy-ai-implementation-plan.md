# Team Strategy & Financial AI — Implementation Plan

**Status:** Ready to execute  
**Date:** 2026-07-02  
**Design spec:** [Team Strategy & Financial AI](../specs/2026-07-02-team-strategy-ai-design.md)  
**Save version:** 5 → 6  
**Depends on:** Financials v1 (merged or on `cursor/financials-v1-implementation-8014`)

---

## Overview

1. Add **`TeamStrategy`** (`selling` | `buying` | `contending`) to `TeamFinancials`
2. Assign at league creation; re-evaluate each offseason with hysteresis
3. Refactor financial AI: re-sign pass → team-scored FA → salary-aware cuts → tolerance wiring
4. Show **all** strategy fields at team pick (market, tolerance, mode, cap, cash, debt)
5. SAVE_VERSION 6 migration for existing saves

**Estimated scope:** ~20 tasks, ~400–500 LOC in sim + ~80 LOC UI

---

## Architecture

```
packages/shared/
  financialTypes.ts          # TeamMode, TeamStrategy
  financialConstants.ts      # mode assignment thresholds, multipliers

packages/sim/src/financials/
  teamStrategy.ts            # assignInitial, updateOffseason, deriveSignals
  ai/
    reSignings.ts            # processAiReSignings
    freeAgentScoring.ts      # scoreFreeAgentForTeam, selectTarget
    capCuts.ts               # computeCapCutScore, applyAiCapBehavior (refactor)
    offers.ts                # buildAiOffer(mode, tolerance, player)
  freeAgency.ts              # orchestrate passes; slim down
  index.ts                   # wire updateTeamStrategies into offseason

apps/web/
  lib/moneyFormat.ts           # formatTeamMode, formatTolerance (already partial)
  routes/league/pick-team.tsx  # full debug card per team
  components/league/CapSheetCard.tsx  # show mode + tolerance
```

---

## Phase 1 — Types & constants

| # | Task | File(s) |
|---|------|---------|
| 1.1 | Add `TeamMode`, `TeamModeSource`, `TeamStrategy` | `financialTypes.ts` |
| 1.2 | Add `strategy: TeamStrategy` to `TeamFinancials` | `financialTypes.ts` |
| 1.3 | Add mode thresholds, multipliers, hysteresis constants | `financialConstants.ts` |
| 1.4 | Bump `SAVE_VERSION` to `6` | `leagueTypes.ts` |

### Constants to add

```ts
MODE_PAYROLL_OVER_TAX_SELLING = 5      // $M over tax → selling signal
MODE_CAP_SPACE_BUYING = 7              // $M cap space → buying signal
MODE_CONTENDING_OVR = 78
MODE_SELLING_OVR = 72
MODE_HYSTERESIS_SEASONS = 2
MODE_DEBT_FORCE_SELLING = 30           // $M debt → force selling

MODE_OFFER_MULTIPLIER: Record<TeamMode, { min: number; max: number }>
MODE_YEARS_RANGE: Record<TeamMode, [number, number]>
RE_SIGN_OVR_CONTENDING = 75
RE_SIGN_TOP_N_BUYING = 3
RE_SIGN_MAX_AGE_SELLING = 25
```

---

## Phase 2 — Team strategy assignment

| # | Task | File(s) |
|---|------|---------|
| 2.1 | `deriveTeamSignals(team, contracts, seasonFinancials)` → age, payroll, capSpace, ovr | `teamStrategy.ts` |
| 2.2 | `assignInitialTeamStrategy(team, signals, rng)` | `teamStrategy.ts` |
| 2.3 | `proposeTeamMode(signals, standings, teamFinance)` → candidate mode | `teamStrategy.ts` |
| 2.4 | `updateTeamStrategy(current, candidate, season)` → apply hysteresis | `teamStrategy.ts` |
| 2.5 | `updateAllTeamStrategies(league)` → map over teamFinancials | `teamStrategy.ts` |
| 2.6 | Wire `assignInitialTeamStrategy` in `initializeTeamFinancials` | `spendingProfiles.ts` |
| 2.7 | Unit tests: initial assignment, hysteresis, debt override | `tests/financials/teamStrategy.test.ts` |

---

## Phase 3 — AI: re-sign pass

| # | Task | File(s) |
|---|------|---------|
| 3.1 | `getOwnFreeAgents(league, teamId)` — pool + recently expired with seasonsWithTeam > 0 | `ai/reSignings.ts` |
| 3.2 | `shouldReSign(player, team, mode, tolerance, fairSalary)` | `ai/reSignings.ts` |
| 3.3 | `buildReSignOffer(player, mode, tolerance, birdRights, ...)` | `ai/offers.ts` |
| 3.4 | `processAiReSignings(league, rng)` — loop teams, re-sign eligible | `ai/reSignings.ts` |
| 3.5 | Insert before `processAiFreeAgency` in `processOffseasonFinancials` | `financials/index.ts` |
| 3.6 | Tests: contending re-signs star; selling lets vet walk | `tests/financials/reSignings.test.ts` |

---

## Phase 4 — AI: team-scored free agency

| # | Task | File(s) |
|---|------|---------|
| 4.1 | `getPositionNeeds(team)` → position → need score 0–10 | `ai/freeAgentScoring.ts` |
| 4.2 | `scoreFreeAgentForTeam(fa, team, mode, ...)` | `ai/freeAgentScoring.ts` |
| 4.3 | `selectFreeAgentTarget(league, teamId)` — best score, not global OVR | `ai/freeAgentScoring.ts` |
| 4.4 | `buildExternalFaOffer(fa, team, mode, tolerance, ...)` | `ai/offers.ts` |
| 4.5 | Refactor `processAiFreeAgency` to use scoring + offers | `freeAgency.ts` |
| 4.6 | Respect `TOLERANCE_CASH_FLOOR` before each sign | `ai/offers.ts` |
| 4.7 | Tests: buying team prefers need position; selling prefers youth | `tests/financials/freeAgency.test.ts` |

---

## Phase 5 — AI: salary-aware cap behavior

| # | Task | File(s) |
|---|------|---------|
| 5.1 | `computeCapCutScore(player, contract)` | `ai/capCuts.ts` |
| 5.2 | Refactor `applyAiCapBehavior` — all tolerances, not just tax_averse | `ai/capCuts.ts` |
| 5.3 | Mode-specific cut loops (selling dumps to tax line; contending dead money only) | `ai/capCuts.ts` |
| 5.4 | Replace `computeAiCutScore` in cap path only (keep age/OVR trim for roster limit) | `rosterManagement.ts` unchanged |
| 5.5 | Tests: selling team gets under tax; contending keeps core | `tests/financials/capCuts.test.ts` |

---

## Phase 6 — Migration & integration

| # | Task | File(s) |
|---|------|---------|
| 6.1 | `migrateV5ToV6(record)` — backfill `strategy` on teamFinancials | `financials/migrateV5ToV6.ts` |
| 6.2 | Branch in `normalizeLeagueRecord` for v5 → v6 | `normalizeLeague.ts` |
| 6.3 | Call `updateAllTeamStrategies` at start of `processOffseasonFinancials` | `financials/index.ts` |
| 6.4 | Export new public APIs from `packages/sim/src/index.ts` | `index.ts` |
| 6.5 | Integration test: full offseason cycle preserves mode + re-signs | `tests/financials/integration.test.ts` |

---

## Phase 7 — UI (full visibility at pick)

| # | Task | File(s) |
|---|------|---------|
| 7.1 | `formatTeamMode(mode)` → "Selling" / "Buying" / "Contending" | `moneyFormat.ts` |
| 7.2 | `formatTolerance` already exists — verify labels | `moneyFormat.ts` |
| 7.3 | Expand pick-team cards: mode, tolerance, payroll, cap outlook, cash, debt | `pick-team.tsx` |
| 7.4 | Add mode row to `CapSheetCard` | `CapSheetCard.tsx` |
| 7.5 | Optional: badge colors per mode (selling=muted, buying=primary, contending=green) | `pick-team.tsx` |

### Pick-team card layout (target)

```
Seattle Storm
SEA · 78 OVR · west · pacific
Buying · Competitive · Large market
Payroll $152.3M · Over tax line · Cash $12.4M · Debt $0
```

---

## Execution order

```
Phase 1 (types)
    ↓
Phase 2 (strategy assignment)
    ↓
Phase 3 (re-sign) ──┐
Phase 4 (FA scoring) ├── can parallel after Phase 2
Phase 5 (cap cuts) ──┘
    ↓
Phase 6 (migration + wire)
    ↓
Phase 7 (UI)
```

Single PR recommended (cohesive AI behavior change).

---

## Definition of done

- [ ] `SAVE_VERSION = 6`; v5 saves migrate with `strategy` backfilled
- [ ] Every team has `strategy.mode` at league creation
- [ ] Offseason updates mode with hysteresis
- [ ] AI re-signs core players on contending/buying teams before external FA
- [ ] FA targets scored per team (not global best OVR)
- [ ] Cap cuts use salary-aware score; selling teams get under tax line
- [ ] All four tax tolerances affect spend/cut behavior
- [ ] Team pick shows: mode, tolerance, market, payroll, cap outlook, cash, debt
- [ ] Cap sheet shows mode + tolerance
- [ ] All sim tests pass; new strategy/AI tests added

---

## Playtest checklist (manual)

1. Create league → pick team screen shows mode/tolerance for all 30 teams
2. Simulate season → begin offseason → verify contending team re-signed 75+ OVR players
3. Find a selling team → verify payroll trend down over 2–3 seasons (sim to offseason repeatedly)
4. tax_averse + selling → should never stay over tax line going into new season
5. Load old v5 save → migrates to v6 with strategy assigned

---

## Future hooks (document only)

| Consumer | When |
|----------|------|
| Draft `aiSelectProspect` | After this PR; weight by `team.strategy.mode` |
| Trade acceptance | Trades v1; mode as trade value multiplier |
| Owner events | Owner v1; `strategy.source = "owner"` override |

---

## Next action

Start **Phase 1, Task 1.1** on branch `cursor/team-strategy-ai-8014` off latest financials v1.
