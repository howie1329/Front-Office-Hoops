# Scheduling, Calendar & Preseason — Implementation Plan

**Status:** Ready to execute  
**Date:** 2026-07-07  
**Design spec:** [Scheduling, Calendar & Preseason Design Spec](../specs/2026-07-07-scheduling-calendar-design.md)  
**Prerequisite:** None (no legacy save migration)

---

## Overview

Execute the scheduling/calendar overhaul in dependency order. Preseason ships structural features (camp, exhibitions, cuts) in this plan; **match fitness, camp development boosts, and age-skewed injury risk are deferred** — tracked in spec § Preseason future work.

### Goals

1. NBA-aligned rosters: **15** regular, **21** camp
2. Week-aware calendar with weekday labels
3. Constraint-based schedule (no double-headers, weekly caps, trip structure)
4. Advance runner with `stopAtUserGames` + `runThrough` + interrupts
5. Unified Advance UI; trade deadline stops **day after** deadline
6. Team calendar at `/league/calendar` (remove `/league/schedule`)
7. Schedule fatigue wired into rotation / sim / injuries
8. Preseason phase with exhibitions and cut flow

### Explicitly deferred

- Match fitness / playing shape attribute
- Camp development acceleration for young players
- Age-weighted preseason injury curves
- Player tags (`plays_into_shape`, etc.)
- Two-way contracts
- Live PBP / per-game quick sim from calendar
- AI narratives
- Save migration

---

## Build order

```
Phase 0: Roster constants (12 → 15, camp 21)
Phase 1: Calendar week model + milestones
Phase 2: Schedule generator rewrite
Phase 3: Dead air + phase snap
Phase 4: Advance runner + commands
Phase 5: Fatigue context + sim hooks
Phase 6: Unified Advance UI
Phase 7: Team calendar page (/league/calendar)
Phase 8: Preseason phase (camp + exhibitions + cuts)
```

Phases 6–7 can overlap once Phase 4 API is stable. Phase 8 last.

---

## Phase 0 — Roster size alignment

**Files:** `packages/shared/src/constants.ts`, tests across sim/web that assert `12`

| Task | Detail |
|------|--------|
| Change `PLAYERS_PER_TEAM` | 12 → **15** |
| Add `CAMP_ROSTER_MAX` | **21** |
| Add `PRESEASON_GAMES_PER_TEAM` | 4 (30-team), 2 (6-team) |
| Update roster pipeline | Generate 15 players at league create (regular); camp adds +6 at preseason start |
| Fix tests | league invariants, draft, trades, FA, generatePlayers |

**Acceptance:** All sim tests pass with 15-man rosters; no hardcoded `12` left in business logic.

---

## Phase 1 — Calendar week model

**Files:**

- `packages/shared/src/calendarTypes.ts`
- `packages/sim/src/calendar.ts`
- `packages/sim/tests/calendarGoalsAwardsProfiles.test.ts` (extend)

| Task | Detail |
|------|--------|
| Extend `CalendarDate` | `weekday`, `weekOfSeason`, richer `label` |
| Season block constants | Preseason length, regular length, start offsets |
| Extend `SeasonMilestones` | `preseasonStartDay`, `preseasonEndDay`, `regularSeasonStartDay` |
| `getWeekday(day)`, `getWeekOfSeason(day)` | Pure functions |
| Trade deadline helpers | `canTradeOnDate`: `day <= tradeDeadlineDay`; advance target = `tradeDeadlineDay + 1` |

**Acceptance:** Calendar tests cover weekday mapping, milestone ordering, trade deadline edge (deadline day tradable, next day not).

---

## Phase 2 — Schedule generator rewrite

**Files:**

- `packages/sim/src/createSchedule.ts` (major rewrite)
- `packages/shared/src/seasonTypes.ts` — `gameType` on `ScheduleGame`
- `packages/sim/tests/createSchedule.test.ts` (expand)

| Task | Detail |
|------|--------|
| No double-header | Team at most once per day |
| Weekly cap | Max 4 games / team / week |
| Weekday bias | Prefer Tue–Sun; lighter Mon |
| Trip clustering | Soft constraint for home/road blocks |
| B2B rate | Assert 15–20% band in tests (seeded) |
| Exhibition schedule fn | `createPreseasonSchedule()` — 4 games/team, 14 days |

**Acceptance:** 30-team schedule = 1230 regular games; each team 82; constraint tests green; deterministic with seed.

---

## Phase 3 — Dead air fix

**Files:**

- `packages/sim/src/simulateRegularDay.ts`
- `packages/sim/src/phaseEligibility.ts`
- `packages/sim/tests/simulateDay.test.ts`

| Task | Detail |
|------|--------|
| On last regular game final | Snap `currentDay` to `playoffsStartDay` |
| On season complete | Snap toward offseason milestone if behind |
| Relax or remove | Redundant calendar-only playoff gate if snap handles it |

**Acceptance:** Sim full regular season → `beginPlayoffs` immediately eligible without empty-day sim.

---

## Phase 4 — Advance runner

**Files:**

- `packages/sim/src/advance/advanceSeason.ts` (new)
- `packages/sim/src/leagueCommands/types.ts`
- `packages/sim/src/leagueCommands/applyLeagueCommand.ts`
- `packages/sim/tests/advance.test.ts` (new)

| Task | Detail |
|------|--------|
| `advanceSeason(state, target, policy, ctx)` | Loop `simulateDay` until stop |
| Policy `stopAtUserGames` | Pause before day with user game |
| Policy `runThrough` | Sim user games; check interrupts each day |
| Interrupts | roster cuts, phase gates, draft on clock |
| Targets | `day`, `week`, `trade_deadline` (+1), `playoffs`, `month_end`, `regular_season_end` |
| Return `AdvanceResult` | daysSimmed, gamesSimmed, stoppedReason |

**Acceptance:** Unit tests for each target and policy; trade deadline stops on `deadline + 1`; default day advance stops before user game.

---

## Phase 5 — Fatigue

**Files:**

- `packages/sim/src/schedule/fatigue.ts` (new)
- `packages/sim/src/selectRotation.ts`
- `packages/sim/src/simulateTeamMatchup.ts`
- `packages/sim/src/injuries.ts`
- `packages/sim/tests/fatigue.test.ts` (new)

| Task | Detail |
|------|--------|
| `getTeamScheduleFatigue(teamId, schedule, games, day)` | B2B, 3-in-4, road trip |
| Rotation adjustment | Reduce starter targets on B2B |
| Efficiency penalty | In team strength calc |
| Injury multiplier | B2B ×1.3, etc. |
| Exhibition weight | 0.5× toward fatigue |
| Regular season start | Reset fatigue state (implicit — no persisted fatigue) |

**Acceptance:** B2B game measurably lowers efficiency vs rested baseline in tests.

---

## Phase 6 — Unified Advance UI

**Files:**

- `apps/web/src/components/league/SimControls.tsx` → rename/refactor to `AdvanceControls.tsx`
- `apps/web/src/hooks/useLeague.ts`
- `apps/web/src/contexts/LeagueContext.tsx`
- `apps/web/src/routes/league/index.tsx`

| Task | Detail |
|------|--------|
| Primary button | **Advance 1 day** → `{ target: 'day', policy: 'stopAtUserGames' }` |
| Dropdown / sheet | Week, until month end, until trade deadline, until playoffs, rest of season |
| Toast / inline feedback | Show `AdvanceResult` summary |
| Remove | Old three equal buttons as primary pattern |

**Acceptance:** Dashboard advance flow matches locked decisions; bulk sim runs through user games.

---

## Phase 7 — Team calendar UI

**Files:**

- `apps/web/src/routes/league/calendar.tsx` (new)
- `apps/web/src/components/league/TeamCalendar.tsx` (new)
- `apps/web/src/components/league/CalendarHeatmap.tsx` (new)
- `apps/web/src/components/league/TripTimeline.tsx` (new)
- `apps/web/src/components/league/LeagueNav.tsx`
- `apps/web/src/routes/league/route.tsx`
- Delete or redirect `apps/web/src/routes/league/schedule.tsx`

| Task | Detail |
|------|--------|
| Month heatmap | Weeks × weekdays; tap day → drawer |
| B2B / 3-in-4 badges | From fatigue helpers (shared util or sim export) |
| Home / away icons | On cells and list |
| Trip timeline | Consecutive home/road blocks |
| Milestone markers | Trade deadline, preseason divider, today |
| Nav | “Calendar” replaces “Schedule” |
| Links | Dashboard, game detail back → `/league/calendar` |
| Remove `/league/schedule` | Delete route; update `routeTree.gen.ts` via dev build |

**Acceptance:** Mobile-first calendar shows user-team month view; no broken nav links.

---

## Phase 8 — Preseason

**Files:**

- `packages/shared/src/seasonTypes.ts` — `phase: 'preseason'`
- `packages/sim/src/createInitialSeason.ts`
- `packages/sim/src/preseason/` (new)
- `packages/sim/src/roster/rosterManagement.ts`
- `packages/sim/src/leagueCommands/applyLeagueCommand.ts` — `beginRegularSeason`
- `apps/web/src/components/league/SeasonPhaseCard.tsx`

| Task | Detail |
|------|--------|
| `startPreseason` / league create | Phase `preseason`, 21-man rosters (+6 camp players) |
| Camp player generation | Fringe profiles, non-guaranteed flag on contract |
| Exhibition schedule | Attach to state; `gameType: 'exhibition'` |
| Sim exhibitions | Reduced minutes, injury ×0.5 |
| Cut enforcement | Block `beginRegularSeason` until roster ≤ 15 |
| Urgent item | “6 cuts required” on dashboard |
| AI cuts | Trim to 15 when transitioning |
| Skip exhibitions | Command to sim remaining exhibitions instantly |
| Stats | Filter exhibition games in standings; optional preseason W-L on dashboard |

**Acceptance:** New league starts in preseason; cut to 15; regular season schedule unchanged; phase card transitions work.

**NOT in Phase 8:** match fitness, camp dev boost, age injury skew — add TODO comments pointing to design spec § Preseason future work.

---

## Testing checklist

- [ ] `createSchedule` constraint tests (no double-header, weekly band, B2B rate)
- [ ] Calendar weekday + trade deadline day/+1
- [ ] `advanceSeason` policy + interrupt tests
- [ ] Fatigue effect on sim output
- [ ] Preseason → regular transition with cuts
- [ ] Full season integration: preseason → regular → playoffs (existing flow)
- [ ] Web: calendar route renders; advance controls dispatch correctly

---

## Documentation updates

| File | Change |
|------|--------|
| `docs/simulation-engine.md` | Schedule, advance, fatigue, preseason |
| `docs/data-model.md` | `gameType`, calendar fields, camp roster |
| `docs/roadmap.md` | Mark scheduling/calendar items |
| `docs/architecture.md` | `/league/calendar` route |

---

## Future follow-up (separate plans)

1. **Preseason development pass** — match fitness, playing shape, camp dev boost, age injury skew, player tags
2. **Two-way contracts** — 3 slots, 50-game limit
3. **Per-game quick sim** from calendar day drawer
4. **League-wide schedule table** — optional filter inside calendar if needed
