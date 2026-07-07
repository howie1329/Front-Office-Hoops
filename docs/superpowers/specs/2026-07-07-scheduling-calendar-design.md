# Scheduling, Calendar & Preseason — Design Spec

**Status:** Approved for planning — see [Implementation Plan](../plans/2026-07-07-scheduling-calendar-implementation-plan.md)  
**Date:** 2026-07-07  
**Scope:** Scheduling engine, week calendar, advance/play-until sim, team calendar UX, preseason camp (partial — see § Preseason future work)

---

## Summary

Overhaul how time and games flow in Front Office Hoops:

1. **Real week structure** — Mon–Sun calendar with weekday-aware scheduling
2. **Constraint-based schedule generation** — no double-headers, realistic weekly load, home stands / road trips
3. **Unified Advance control** — default “Advance 1 day” with smart stops; bulk “play until…” modes
4. **Team calendar UX** — heatmap, trip timeline, B2B markers (primary differentiator; no AI narrative)
5. **Preseason camp** — expanded camp roster, exhibition games, cuts to regular-season limit
6. **Schedule-aware fatigue** — B2B / 3-in-4 effects on rotation, performance, injury risk

**Explicitly out of scope for this initiative:** live play-by-play, AI game narratives, save migration (no users / no legacy saves), two-way contracts.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| **Default advance** | “Advance 1 day” — sim one day; under default policy, **stop before user-team games** |
| **Bulk sim** | “Play until trade deadline / playoffs / end of month” uses **runThrough** — sims user games unless a mandatory interrupt fires |
| **Trade deadline stop** | Trades **allowed on deadline day**. Sim **does not stop until the day after** deadline (first day trades are closed). |
| **Calendar route** | New `/league/calendar` replaces `/league/schedule` |
| **Legacy saves** | None — no migration logic required |
| **Differentiator** | Visual team calendar UX only (not AI) |

---

## Roster sizes (NBA-aligned)

### Real NBA (reference)

| Period | Standard roster | Two-way (optional) | Combined cap |
|--------|-----------------|--------------------|--------------|
| Regular season | **15** | up to **3** (don’t count toward 15) | 15 + 3 two-way |
| Offseason / training camp | — | — | up to **21** total (standard + two-way) |

Minimum regular-season roster is 14 with exceptions; we simplify to **15 fixed** for gameplay clarity.

### Game targets (v1)

| Constant | Current | Target | Notes |
|----------|---------|--------|-------|
| `ROSTER_MAX` / `PLAYERS_PER_TEAM` | 12 | **15** | Regular season active roster |
| `ROSTER_MIN` | 6 | **15** | Must hit exactly 15 to start regular season (existing “exact roster” pattern) |
| `CAMP_ROSTER_MAX` | — | **21** | Preseason training camp (NBA offseason max) |
| Cuts required | — | **6** | 21 → 15 before regular season |

**Deferred:** two-way contracts (3 slots, 50-game limit, no playoffs). Document in roster spec for a later pass; camp is 21 standard players only in v1.

**Impact:** touches `constants.ts`, roster generation, phase eligibility, trades, FA, draft, financial tests, UI roster displays. Schedule initiative includes this constant change as **Phase 0**.

---

## Calendar & week model

### Time representation

Keep integer `currentDay` as the simulation cursor. Derive calendar metadata:

```typescript
type CalendarDate = {
  month: number
  day: number
  label: string           // "Tue, Nov 12"
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6   // 0 = Sunday
  weekOfSeason: number    // 1-based
}
```

### Season blocks (30-team / 82-game)

| Block | ~Duration | Phase |
|-------|-----------|-------|
| Preseason | 14 days (~2 weeks) | `preseason` |
| Regular season | ~170 days (~24 weeks) | `regular` |
| Playoffs | dynamic | `playoffs` |
| Offseason | milestone offsets | `offseason` |

Weekday scheduling bias:

- Primary game days: **Tue–Sun**
- **Mon**: lighter league slate (rest bias)
- Target **3–4 games per team per week** during regular season
- **Hard cap: 1 game per team per day**

### Milestones

Extend `SeasonMilestones`:

```typescript
type SeasonMilestones = {
  preseasonStartDay: number
  preseasonEndDay: number
  regularSeasonStartDay: number
  tradeDeadlineDay: number
  regularSeasonEndDay: number
  playoffsStartDay: number
  // ... existing offseason milestones
}
```

**Trade deadline semantics:**

- `canTradeOnDate(day)` → `true` when `day <= tradeDeadlineDay` (trades allowed **on** deadline day)
- “Play until trade deadline” advance target → stop at `tradeDeadlineDay + 1` (first day after deadline)

---

## Schedule generation

Replace greedy `assignDays()` with constraint-aware assignment.

### Hard constraints

1. No team plays twice on the same day
2. Max **4** games per team per `weekOfSeason`
3. Min **3** games per team per week during regular season (soft target; relax for final week if needed)

### Soft constraints (schedule feel)

4. Prefer **2–4 game home stands / road trips** before flipping
5. Allow B2Bs at ~15–20% of team schedule (not random clusters)
6. Exhibition games: lower league density (~2 games/day), same no-double-header rule

### ScheduleGame extensions

```typescript
type GameType = 'exhibition' | 'regular' | 'playoff'

type ScheduleGame = {
  // existing fields...
  gameType: GameType
}
```

Computed at sim time (not persisted): `isBackToBack`, `gamesInLast3Days`, `gamesInLast7Days`, home/road trip position.

---

## Dead air fix

When the **last regular-season game** is finalized:

- Set `currentDay = milestones.playoffsStartDay` (calendar snap)
- Same pattern when season completes → snap toward `offseasonStartDay` if behind

Remove the need to sim empty days between last game and phase transitions.

---

## Advance & sim policy

### Policies

| Policy | Used by | Behavior |
|--------|---------|----------|
| `stopAtUserGames` | Default “Advance 1 day”, “Advance to next stop” | Day-by-day; pause **before** simulating a day that includes a user-team game |
| `runThrough` | Play until milestone / week / month | Continuous sim; **do not** stop for user games |

### Interrupt reasons (`runThrough` only)

Stop when human input is required:

| Interrupt | Notes |
|-----------|-------|
| Mandatory roster action | Over camp/regular limit, cuts due |
| Phase transition gate | e.g. regular complete → begin playoffs |
| User draft pick on clock | Existing draft flow |
| Pending user contract action | When re-sign UX requires it |
| **Target reached** | Terminal — e.g. day after trade deadline, playoffs start, month end |

**Not** interrupts: user-team games (under `runThrough`), empty rest days, AI-only games.

### Commands (replacing bare simDay/week/season)

```typescript
type AdvanceTarget =
  | 'day'                    // Advance 1 day (default label)
  | 'week'
  | 'trade_deadline'         // stops day AFTER deadline
  | 'playoffs'
  | 'month_end'
  | 'regular_season_end'

type AdvanceCommand = {
  type: 'advance'
  target: AdvanceTarget
  policy?: 'stopAtUserGames' | 'runThrough'  // default: stopAtUserGames for day/week; runThrough for milestones
}
```

Return shape for UI toasts:

```typescript
type AdvanceResult = {
  state: SeasonState
  daysSimmed: number
  gamesSimmed: number
  stoppedReason?: 'user_game' | 'interrupt' | 'target_reached'
  interrupt?: 'roster_cuts' | 'begin_playoffs' | 'draft_pick' | ...
}
```

---

## Schedule-aware fatigue

Computed per team at game time from recent schedule:

```typescript
type TeamScheduleFatigue = {
  playedYesterday: boolean
  gamesLast3Days: number
  gamesLast7Days: number
  roadTripLength: number
  isHomeStand: boolean
}
```

| Signal | Rotation | Performance | Injury risk |
|--------|----------|-------------|-------------|
| B2B (2nd night) | Starter targets −8–12 min | Team efficiency −1–2% | ×1.3 |
| 3-in-4 nights | More bench minutes | −2–3% | ×1.2 |
| Road trip game 3+ | — | −0.5% per extra road game | — |

Exhibition games count at **50%** toward fatigue accumulation. **Fatigue resets** at regular season start.

Hooks: `selectRotation`, `simulateTeamMatchup`, existing injury module.

---

## Preseason (v1 scope + future work)

> **⚠️ Preseason is intentionally not fully flushed out.** v1 ships camp roster, exhibition schedule, cuts, and basic sim differences. Player development, injury skew, and match fitness are **documented for follow-up** — see below.

### v1 — in scope

| Item | Spec |
|------|------|
| Phase | `SeasonPhase` adds `'preseason'` |
| Camp roster | **21** players per team (6 above regular limit) |
| Regular roster | **15** players required to start regular season |
| Exhibition games | **4** per team (30-team); **2** per team (6-team lab) over **14** / **7** days |
| Standings | No impact |
| Sim | Reduced starter minutes (~60–70%), injury risk ×0.5, stats tagged `gameType: 'exhibition'` |
| Transition | All exhibitions final OR “skip remaining exhibitions”; roster ≤ 15; `beginRegularSeason` |
| AI cuts | Auto-cut when user starts regular season (AI teams trim to 15) |

### Preseason — future work (NOT v1)

Document only; implement in a later **preseason development** pass:

#### 1. Camp development boost

- Players on **non-guaranteed camp contracts** under age ~24 receive accelerated offseason-style skill growth during preseason days
- Veterans on guaranteed deals: minimal or zero growth
- Ties into existing `progressPlayer` / role-minutes modifiers

#### 2. Age-weighted injury risk

- Preseason injury risk baseline ×0.5 (v1)
- **Future:** invert partially for older players (35+) — higher soft-tissue risk in exhibitions
- Young players: lower risk; camp competition for roster spots

#### 3. Match fitness / playing shape

Football Manager uses **Match Fitness** (condition sharpness for performance). Basketball equivalent: **playing shape** — whether a player can access full ratings *right now*.

```typescript
// Future player attribute (not v1)
type PlayerCondition = {
  matchFitness: number   // 0–100, sharpness
  playingShape: number   // 0–100, offseason prep / weight / readiness
}
```

**Design intent:**

- Separate from permanent **stamina** rating (engine attribute)
- `playingShape` changes slowly across preseason; improves with minutes in exhibitions
- Some player **tags/archetypes**: `"plays_into_shape"` (Shaq-style — starts season below peak, ramps up over 20–30 games), `"holdout_rust"`, `"offseason_beast"`
- Low shape → efficiency penalty until improved; high preseason minutes → faster shape recovery
- Tags system not built in v1 — reserve field on player profile

#### 4. Two-way contracts (optional)

- 3 slots, don’t count toward 15, 50-game active limit, no playoffs — separate spec

---

## Team calendar UX

Primary schedule surface: **`/league/calendar`**

### Views

1. **Month heatmap (default, especially mobile)**  
   - Grid: weeks × weekdays  
   - Cell intensity = user-team games that day  
   - Icons: home / away, B2B dot  
   - Tap → day drawer with matchup  

2. **Week list (desktop fallback)**  
   - Grouped: “Week 12 · Nov 18–24”  

3. **Trip timeline**  
   - Horizontal HOME / ROAD blocks (3+ consecutive)  

### Annotations

- Trade deadline marker (with note: trades allowed through that day)
- Preseason / regular divider
- Playoff start
- Today pin

### Route changes

- **Add:** `/league/calendar` — team-centric calendar (default nav item: “Calendar”)
- **Remove:** `/league/schedule` — league-wide table view deferred or folded into calendar filters later
- Update nav, dashboard links, game detail back-links

---

## Phase flow (updated)

```
createLeague
  → preseason (camp 21, exhibitions)
  → beginRegularSeason (cuts to 15, fatigue reset)
  → regular
  → playoffs
  → complete
  → offseason (re_signing → draft → free_agency)
  → startNextSeason (preseason again)
```

---

## Non-goals

- Live play-by-play
- AI narrative / scouting blurbs
- All-Star break, in-season tournament
- Save migration / backwards compatibility
- Two-way contracts (v1)
- Match fitness / playing shape implementation (documented only)
- Full camp development curves (documented only)

---

## Open items (minor)

- Exact B2B target percentage tuning (15% vs 20%) — tune in tests
- 6-team lab preseason: 2 exhibitions, 7 days — confirm in season-lab
- Whether “Sim 1 week” uses `stopAtUserGames` or `runThrough` — default **`stopAtUserGames`**, same as day
