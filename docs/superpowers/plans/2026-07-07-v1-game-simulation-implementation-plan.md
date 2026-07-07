# v1 Game Simulation — Implementation Plan

**Status:** Approved for planning (user decisions 2026-07-07)  
**Date:** 2026-07-07  
**Base branch:** `master` @ `90a8713` (SAVE_VERSION 13)  
**Related research:** Basketball GM simulation comparison (2026-07-07 conversation)  
**Companion plans:** [v1 Financials & Trade](./2026-07-07-v1-financials-market-trade-plan.md), [Scheduling & Calendar](./2026-07-07-scheduling-calendar-implementation-plan.md)

---

## Summary

Upgrade **Front Office Hoops** from a single-pass aggregate game sim to a **segment-based simulation** that produces honest quarters, real overtime, blowout-aware rotations, archetype lineup synergy, team momentum, and coach-driven philosophy — while keeping the engine fast, deterministic, and testable.

This is a **GM game**: users hire coaches and build rosters; they do **not** set rotation minutes or tactical sliders directly.

### Ship list (in scope)

1. **Segment-based game structure** — Q1–Q4 are simulated, not post-hoc split
2. **Real overtime** — OT segments until a winner (no random tie-break bonus)
3. **Blowout logic** — stars sit in Q4 when margin is large; bench gets more run
4. **Archetype lineup synergy** — on-court chemistry affects efficiency and shot mix
5. **Coach philosophy infrastructure** — philosophy derived from staff (placeholder: `coachingLevel`); no user sliders
6. **Form / momentum** — rolling team efficiency affects segment modifiers
7. **Star stat concentration** — elite scorers capture more of team totals
8. **Skill model completion** — all 11 skills drive team-level sim, not just allocation
9. **Calibration pass** — league distributions tuned to NBA-ish targets with automated audit tests

### Explicit non-goals

- User rotation control (coaches own this eventually)
- User-facing tactical sliders
- Full possession-by-play simulation
- Live play-by-play watch mode
- Foul model / personal fouls in box scores
- In-game substitution AI (segment rotation adjustments only)

---

## User decisions (locked)

| Area | Decision |
|------|----------|
| Game structure | Segment-based (4 regulation segments + OT segments) |
| Overtime | Real OT segments, not random point bonus |
| Blowouts | Reduce star minutes / shift Q4 production to bench when margin large |
| Archetype synergy | Yes — lineup fit affects sim |
| Rotation control | **No** — auto rotation + coach philosophy only |
| Coaching | Infrastructure now; full coach hiring later; philosophy from staff not user |
| Momentum | Yes — rolling team form affects games |
| Star concentration | Yes — amplify usage weights for top players |
| Stats model | Expand usage in sim (11 skills already on master; wire fully into team-level model) |
| Quarters | Must matter — scores emerge from segments |
| Calibration | Required before v1 — automated distribution tests |

---

## Current state (master @ 90a8713)

### Already implemented

| Feature | Location | Notes |
|---------|----------|-------|
| 11-skill ratings | `playerTypes.ts`, `skillRatings.ts` | `threePoint`, `midRange`, `freeThrow`, `inside`, `passing`, `ballHandling`, `rebounding`, `defense`, `stamina`, `offensiveIQ`, `defensiveIQ` |
| Physical profile | `physicalProfile.ts` | Height, wingspan, reach → allocation modifiers |
| Archetype sim modifiers | `archetypes.ts` | Per-stat allocation multipliers |
| Expanded `buildScoringComponents` | `simulateTeamMatchup.ts` | Uses new skills for shooting/TOV; still **single-pass** |
| Expanded `allocatePlayerStats` | `allocatePlayerStats.ts` | Skills + physical + archetype in weights |
| Schedule fatigue | `schedule/fatigue.ts`, `simulateGameWithContext.ts` | B2B / road trip → efficiency penalty + minute reduction |
| `coachingLevel` placeholder | `TeamFinancials` | 1–10; used in development, not game sim yet |
| Deterministic RNG + tests | `simulateTeamMatchup.test.ts` | Score range, home court, reconciliation |

### Gaps to close

| Gap | Current behavior |
|-----|------------------|
| Segments | One blob → `distributeQuarterScores` fakes quarters |
| Overtime | `resolveTie` adds random 1–4 pt FT fudge |
| Blowouts | No margin-aware rotation |
| Synergy | Archetypes affect allocation only, not team efficiency |
| Momentum | `developmentMomentum` exists for offseason; no in-season team form |
| Coach philosophy | Not wired to game sim |
| Star concentration | Proportional `weightedDistribute` — stars under-scoring |
| Skill coverage | `midRange`, `defensiveIQ` weak/absent in `buildScoringComponents` |
| Calibration | Score range test only; no league-wide distribution audit |

---

## Architecture overview

```
packages/shared/src/
  gameSimTypes.ts          NEW — segments, philosophy, synergy, momentum, OT metadata
  types.ts                 extend TeamMatchupInput, TeamMatchupResult, TeamMatchupMeta

packages/sim/src/gameSim/
  index.ts                 re-export public API
  types.ts                 internal segment/context types
  segments.ts              segment plan builder (regulation + OT)
  buildScoringComponents.ts  extract + extend from simulateTeamMatchup
  mergeComponents.ts       sum segment TeamStatComponents
  situationalModifiers.ts  crunch time, blowout, momentum, philosophy
  blowout.ts               Q4 rotation/minute shifts
  synergy.ts               archetype lineup chemistry
  coachingPhilosophy.ts    derive philosophy from coachingLevel (→ coach entity later)
  momentum.ts              rolling team form from recent games
  overtime.ts              OT loop until winner
  simulateRegulation.ts    run Q1–Q4 segments
  simulateTeamMatchup.ts   orchestrator (replaces monolith logic)

packages/sim/src/
  allocatePlayerStats.ts   star concentration exponent + segment minute merge
  simulateGameWithContext.ts  pass momentum + philosophy + recent games
  simulateRegularDay.ts    update team momentum after games

packages/sim/tests/
  gameSim/
    segments.test.ts
    overtime.test.ts
    blowout.test.ts
    synergy.test.ts
    momentum.test.ts
    calibration.test.ts    league distribution audit (500+ games)
```

### New game sim flow

```
simulateGameWithContext
  → load team momentum (last 5 games)
  → derive coachingPhilosophy(home/away coachingLevel)   // placeholder until coach entities
  → selectRotation (auto, unchanged)
  → simulateTeamMatchup:
      planRegulationSegments(pace, philosophy, fatigue)
      for each segment (Q1–Q4):
        apply segment rotation (blowout shift in Q4 if margin > threshold)
        compute synergy modifiers for on-court archetypes
        buildScoringComponents(segmentPossessions, modifiers)
        accumulate quarter scores + team components
      if tied → simulateOvertime(segments) until winner
      merge segment player minutes → allocatePlayerStats (star concentration)
      → TeamMatchupResult with real quarters, OT count, synergy + momentum meta
  → update team momentum in season state
```

---

## Phase 0 — Types & foundations

**Goal:** Shared types for segment sim; extend matchup input/output; bump SAVE_VERSION → 14.

### 0.1 New types (`packages/shared/src/gameSimTypes.ts`)

```typescript
export type CoachingPace = "slow" | "balanced" | "fast"
export type CoachingOffense = "attack_rim" | "balanced" | "perimeter"
export type CoachingRotation = "tight" | "standard" | "deep"

export type CoachingPhilosophy = {
  pace: CoachingPace
  offense: CoachingOffense
  rotation: CoachingRotation
}

export type SegmentKind = "q1" | "q2" | "q3" | "q4" | "ot"

export type LineupSynergyGrade = "A" | "B" | "C" | "D" | "F"

export type TeamMomentumState = {
  /** Rolling net rating over last N games (offRtg - defRtg), league-relative */
  rollingNetRtg: number
  /** Games included in rolling window */
  sampleSize: number
}

export type GameSimSegmentMeta = {
  kind: SegmentKind
  index: number
  homePoints: number
  awayPoints: number
  homePossessions: number
  awayPossessions: number
}

export type SynergyBreakdown = {
  grade: LineupSynergyGrade
  score: number // 0–100
  bonuses: string[] // e.g. "lead_guard+stretch_big: passing"
  penalties: string[]
}
```

### 0.2 Extend `TeamMatchupInput`

```typescript
export type TeamMatchupInput = {
  // ...existing
  homePhilosophy?: CoachingPhilosophy
  awayPhilosophy?: CoachingPhilosophy
  homeMomentum?: TeamMomentumState
  awayMomentum?: TeamMomentumState
  gameType?: GameType // regular | playoff | exhibition
}
```

### 0.3 Extend `TeamMatchupResult` / meta

```typescript
export type TeamMatchupMeta = {
  // ...existing
  overtimes: number
  segments: GameSimSegmentMeta[]
  homeSynergy: SynergyBreakdown
  awaySynergy: SynergyBreakdown
  homeMomentumApplied: number // efficiency modifier used
  awayMomentumApplied: number
}
```

### 0.4 Season state: team momentum

Add to `SeasonState`:

```typescript
teamMomentum: Record<string, TeamMomentumState>
```

Initialize empty `{}` in `createInitialSeason`; reset on `startNextSeason`.

### 0.5 SAVE_VERSION 13 → 14

- Bump `SAVE_VERSION` in `leagueTypes.ts`
- `normalizeLeagueRecord`: default `teamMomentum: {}` for missing field

### Tests
- Type compile check across packages
- Normalization adds `teamMomentum`

---

## Phase 1 — Extract & extend scoring components

**Goal:** Move `buildScoringComponents`, `addRebounds`, helpers out of `simulateTeamMatchup.ts` into testable modules; accept modifier bundle.

### 1.1 Extract modules

| Module | Responsibility |
|--------|----------------|
| `gameSim/buildScoringComponents.ts` | Team stat generation from possessions + ratings |
| `gameSim/addRebounds.ts` | ORB/DRB after both teams shoot |
| `gameSim/ratingHelpers.ts` | `weightedAverage`, `ratingFactor`, `clamp`, `round` |

### 1.2 `SegmentModifiers` input

```typescript
export type SegmentModifiers = {
  efficiencyShift: number      // additive to shooting pct (synergy, momentum, fatigue)
  tpaRateShift: number
  ftaRateShift: number
  tovRateShift: number
  homeCourtPoints: number        // only Q1 or spread across segments — see 1.3
}
```

### 1.3 Complete skill wiring in `buildScoringComponents`

Ensure all 11 skills influence team-level output:

| Skill | Team-level use |
|-------|----------------|
| `threePoint` | 3PA rate, 3P% |
| `midRange` | 2P% (mid-range attempts implicit in 2PA) |
| `freeThrow` | FT% |
| `inside` | 2P%, FTA rate |
| `passing` | AST rate, TOV reduction |
| `ballHandling` | TOV reduction |
| `offensiveIQ` | Shot selection (3PA vs 2PA), AST, 3P%/2P% |
| `defensiveIQ` | Opponent TOV boost, opponent FG% suppression |
| `defense` | Opponent FG%, STL, BLK |
| `rebounding` | ORB/DRB (in `addRebounds`) |
| `stamina` | Segment efficiency decay in Q4 (optional light effect) |

### 1.4 Home court distribution

Split `DEFAULT_HOME_COURT_ADVANTAGE` (+3) across regulation segments (e.g. +0.75 per quarter) instead of lump sum in one pass. OT: no home court points (or half-point per OT segment — tune in calibration).

### Tests
- `buildScoringComponents` unit tests: better offense → more points
- `defensiveIQ` reduces opponent efficiency measurably
- `midRange` affects 2P% independently of `inside`

---

## Phase 2 — Segment-based regulation sim

**Goal:** Q1–Q4 produce real quarter scores and segment-accurate team totals.

### 2.1 Segment plan (`gameSim/segments.ts`)

Default possession shares (tune in Phase 9):

| Segment | Possession share | Rotation notes |
|---------|------------------|----------------|
| Q1 | 26% | Starters heavy |
| Q2 | 24% | Bench drag applies (+10% bench minutes) |
| Q3 | 24% | Starters heavy |
| Q4 | 26% | Crunch modifiers; blowout check |

Total possessions still from `estimatePossessions(homePace, awayPace)` × philosophy pace multiplier.

### 2.2 `simulateRegulation.ts`

```typescript
function simulateRegulation(input, rng): RegulationResult {
  const totalPoss = estimatePossessions(...)
  const plans = buildSegmentPlans(totalPoss, input.homePhilosophy, input.awayPhilosophy)

  let homeQuarterScores: QuarterScores = [0,0,0,0]
  let awayQuarterScores: QuarterScores = [0,0,0,0]
  let homeAccum: TeamStatComponents = emptyComponents()
  let awayAccum: TeamStatComponents = emptyComponents()
  const segmentMeta: GameSimSegmentMeta[] = []
  const playerSegmentMinutes: Map<playerId, number> = ...

  for (const plan of plans) {
    const homeRot = applySegmentRotation(homeRotation, plan, runningMargin)
    const awayRot = applySegmentRotation(awayRotation, plan, -runningMargin)
    const homeMod = buildSegmentModifiers({ synergy, momentum, philosophy, fatigue, segment: plan })
    const awayMod = buildSegmentModifiers({ ... })

    const homeSeg = buildScoringComponents({ possessions: plan.homePoss, ... homeMod })
    const awaySeg = buildScoringComponents({ possessions: plan.awayPoss, ... awayMod })
    addRebounds(homeSeg, awaySeg, homeRot, awayRot, rng)

    homeQuarterScores[plan.quarterIndex] += homeSeg.points
    awayQuarterScores[plan.quarterIndex] += awaySeg.points
    mergeComponents(homeAccum, homeSeg)
    mergeComponents(awayAccum, awaySeg)
    trackPlayerSegmentMinutes(homeRot, awayRot)
    segmentMeta.push(...)
    runningMargin = sum(homeQuarterScores) - sum(awayQuarterScores)
  }

  return { homeScore, awayScore, homeQuarterScores, awayQuarterScores, homeAccum, awayAccum, segmentMeta, playerSegmentMinutes }
}
```

### 2.3 Crunch-time situational modifiers (Q4 only, close games)

When |margin| ≤ 8 entering Q4 segment:

| Situation | Modifier |
|-----------|----------|
| Trailing by 6+ | `tpaRateShift +0.04` (more 3s) |
| Leading by 6+ | `tpaRateShift -0.03`, efficiency -0.01 (clock management proxy) |
| Trailing ≤ 3 in last segment | `tpaRateShift +0.06` |

### 2.4 Remove `distributeQuarterScores` from main path

Keep function for legacy/tests but `simulateTeamMatchup` no longer calls it.

### Tests
- Quarter scores sum to final score
- Q1+Q2+Q3+Q4 each ≥ 0
- Segment possession shares sum to ~total possessions (±rounding)
- Deterministic per seed

---

## Phase 3 — Real overtime

**Goal:** Replace `resolveTie` random bonus with OT segments.

### 3.1 `gameSim/overtime.ts`

```typescript
const OT_POSSESSIONS = 10        // per team per OT period (tune in calibration)
const MAX_OVERTIMES = 4          // hard cap → tiebreaker only if still tied (rare)

function simulateOvertime(input, regulationResult, rng): OvertimeResult
```

- Each OT: one `SegmentKind: "ot"` per period
- No home court advantage in OT (or minimal — calibrate)
- Fatigue penalty +0.005 per prior OT segment
- If still tied after `MAX_OVERTIMES`: **final tiebreaker** — single sudden-death segment (2 possessions each) — document as last resort; should be <0.1% of games

### 3.2 Remove `resolveTie` FT fudge

Delete random `rng.int(1, 4)` bonus path.

### 3.3 Meta

`meta.overtimes = n` exposed in box score UI.

### Tests
- Regulation tie → OT produces different scores with winner
- `meta.overtimes >= 1` when regulation tied
- OT points appear in final score but **not** in quarter scores (quarters stay regulation-only)
- No game ends 0-0 OT without resolution

---

## Phase 4 — Blowout logic

**Goal:** When a team leads big entering Q4, stars sit and bench plays more.

### 4.1 Thresholds

| Entering Q4 margin | Effect |
|--------------------|--------|
| ≥ 20 | Starters −6 min, bench +6 min (redistributed) |
| ≥ 15 | Starters −4 min, bench +4 min |
| ≥ 25 | Starters −8 min, garbage time efficiency -0.02 for leading team |

Losing team down 20+: no minute reduction (still playing rotation).

### 4.2 `gameSim/blowout.ts`

```typescript
function applyBlowoutRotation(
  rotation: RotationEntry[],
  margin: number,        // positive = this team leading
  segment: SegmentKind,
): RotationEntry[]
```

- Only applies to `q4` segment
- Re-normalize minutes to segment total (not full game 240 — segment has its own minute pool)

### 4.3 Stat distribution in blowouts

When blowout active for leading team:
- Shift 8–15% of remaining scoring weight to bench players in allocation phase
- Prevents stars with 38 min in 112–88 wins

### Tests
- 25+ point Q3 margin → Q4 starter minutes < non-blowout baseline
- Blowout games have higher bench scoring share
- Close games unaffected (margin < 15)

---

## Phase 5 — Archetype lineup synergy

**Goal:** On-court archetype combinations create readable lineup fit that affects segment efficiency.

### 5.1 `gameSim/synergy.ts`

Score the **top-5 projected minute players** (segment rotation) by archetype pairs and coverage rules:

#### Bonuses (examples — tune magnitudes)

| Combo / coverage | Effect |
|------------------|--------|
| `lead_guard` + `stretch_big` | `efficiencyShift +0.012`, AST rate +3% |
| `rim_protector` + any guard with `defense ≥ 65` | Opponent `tpaRateShift -0.02` |
| `point_forward` + `scoring_guard` | Ball movement: AST +2% |
| 3+ players with `usage` avg ≥ 70 | `tovRateShift +0.015` (too many cooks) |
| No `rim_protector` / `rebounding_big` on court | Opponent `ftaRateShift +0.02` (paint vulnerable) |
| `three_and_d_wing` × 2+ on court | Perimeter defense: opponent 3P% -0.01 |

#### Grade mapping

| Score | Grade |
|-------|-------|
| ≥ 80 | A |
| 65–79 | B |
| 50–64 | C |
| 35–49 | D |
| < 35 | F |

### 5.2 Output

`SynergyBreakdown` on `TeamMatchupMeta`; surface in game detail UI as "Lineup Fit: B+" with tooltip for bonuses/penalties.

### 5.3 Differentiation note

This replaces BBGM's opaque skill-badge counting with **archetype-readable chemistry** — a core Front Office Hoops identity feature.

### Tests
- Rim protector + defensive guard roster → higher grade vs all-offense roster
- Three high-usage scorers → turnover penalty applied
- Synergy is deterministic given same rotation

---

## Phase 6 — Coaching philosophy infrastructure

**Goal:** Wire coaching style into segment sim now; swap `coachingLevel` for coach entities later without changing sim API.

### 6.1 `gameSim/coachingPhilosophy.ts`

```typescript
// Placeholder: derive from TeamFinancials.coachingLevel (1–10)
// Future: derive from HeadCoach.philosophy + assistant modifiers

export function deriveCoachingPhilosophy(coachingLevel: number): CoachingPhilosophy
```

**Mapping (initial — tune in calibration):**

| coachingLevel | pace | offense | rotation |
|---------------|------|---------|----------|
| 1–3 | slow | attack_rim | tight |
| 4–6 | balanced | balanced | standard |
| 7–8 | fast | perimeter | standard |
| 9–10 | fast | balanced | deep |

### 6.2 Philosophy effects on segments

| Philosophy | Sim effect |
|------------|------------|
| `pace: fast` | +2 possessions/game total |
| `pace: slow` | −2 possessions |
| `offense: attack_rim` | `ftaRate +0.03`, `tpaRate -0.04` |
| `offense: perimeter` | `tpaRate +0.05`, `ftaRate -0.02` |
| `rotation: tight` | Q2 bench minutes −15% |
| `rotation: deep` | Q2 bench minutes +15%, bench drag reduced 20% |

### 6.3 Integration

`simulateGameWithContext` reads `coachingLevel` from `leagueFinancials.teamFinancials[teamId]` and passes `homePhilosophy` / `awayPhilosophy`.

### 6.4 Future coach entity hook (types only in this phase)

```typescript
// packages/shared/src/coachTypes.ts (stub — no hiring UI yet)
export type HeadCoach = {
  id: string
  name: string
  philosophy: CoachingPhilosophy
  overall: number
  offense: number
  defense: number
  development: number
}
```

Store `headCoachId: string | null` on `TeamFinancials` (nullable; when null, use `coachingLevel` derivation).

### Tests
- High coachingLevel → more possessions on average over 100 sims
- `attack_rim` philosophy → higher FTA rate vs `perimeter`
- No user input required — philosophy auto-derived

---

## Phase 7 — Form / momentum system

**Goal:** Rolling team performance affects next game's segment modifiers.

### 7.1 `gameSim/momentum.ts`

```typescript
const MOMENTUM_WINDOW = 5 // games

function computeTeamMomentum(
  teamId: string,
  games: Game[],
  season: number,
): TeamMomentumState

function momentumEfficiencyModifier(state: TeamMomentumState): number
// rollingNetRtg league-relative: +5 net → +0.015 efficiency; -5 → -0.015; clamp ±0.025
```

### 7.2 Update after each game

In `simulateRegularDay` / `simulatePlayoffDay` after games finalize:

```typescript
teamMomentum[teamId] = computeTeamMomentum(teamId, updatedGames, season)
```

### 7.3 Streak interaction

Use existing `Standing.streak`:
- Win streak ≥ 3: additional `+0.005` efficiency
- Loss streak ≥ 3: `-0.005`

Cap total momentum modifier at ±0.03 per segment.

### 7.4 UI (light)

- Standings or team dashboard: "Form: Hot" / "Cold" / "Neutral" from `rollingNetRtg`
- Game box score meta: momentum applied value

### Tests
- Team on 5-game win streak with strong net rating → higher scoring next game on average
- Momentum resets window correctly when season changes
- Deterministic given same game history

---

## Phase 8 — Star stat concentration

**Goal:** Best scorers capture more production; reduce flat bench scoring.

### 8.1 Weight amplification (`allocatePlayerStats.ts`)

```typescript
const STAR_CONCENTRATION_EXPONENT = 1.35

function amplifyWeight(weight: number, usage: number, overall: number): number {
  const starFactor = Math.pow((usage / 60) * (overall / 70), STAR_CONCENTRATION_EXPONENT)
  return weight * Math.max(0.5, starFactor)
}
```

Apply to scoring weights (`twoPointWeight`, `threePointWeight`, `freeThrowWeight`); lighter touch on AST/STL/BLK.

### 8.2 Validation targets (over 200 games)

| Metric | Target |
|--------|--------|
| Top scorer avg PTS (star player) | 24–32 |
| 8th man avg PTS | 4–10 |
| Single player 40+ PTS frequency | < 3% of games |
| Team top-2 scorers share of points | 42–52% |

### Tests
- 80 OVR high-usage player averages more PPG than 55 OVR bench over 100 games
- Team point reconciliation still exact

---

## Phase 9 — Calibration pass

**Goal:** Automated league distribution audit; tune constants until targets met.

### 9.1 `packages/sim/tests/gameSim/calibration.test.ts`

Sim 500 regular games (30-team rosters or 6-team mini) and assert:

| Metric | Target range |
|--------|--------------|
| Avg team score | 108–116 |
| Avg pace (possessions) | 96–104 |
| FG% | 44–48% |
| 3P% | 34–38% |
| AST per team | 22–28 |
| TOV per team | 12–16 |
| REB per team | 42–48 |
| Margin ≥ 20 (blowout) | 12–22% of games |
| OT rate | 4–8% of games |
| Home win % | 52–58% |
| Q4 points share | 24–30% of total (crunch scoring) |

### 9.2 Tuning knobs (priority order)

1. `STAR_CONCENTRATION_EXPONENT`
2. Segment possession shares
3. Base shooting percentages in `buildScoringComponents`
4. Synergy bonus magnitudes
5. Momentum modifier caps
6. Blowout thresholds

### 9.3 Season Lab integration

Add calibration summary panel to `/season-lab` showing live distributions after sim.

### 9.4 `balanceAudit.test.ts` extension

Add `game simulation calibration` describe block or separate file.

---

## Phase 10 — Integration & wiring

**Goal:** Connect all pieces through existing game sim entry points.

### 10.1 `simulateTeamMatchup.ts` refactor

Becomes thin orchestrator calling `gameSim/*` modules.

### 10.2 `simulateGameWithContext.ts`

```typescript
const homePhilosophy = deriveCoachingPhilosophy(homeFinancials.coachingLevel)
const homeMomentum = scheduleState.teamMomentum[home.id] ?? defaultMomentum()
// pass to simulateTeamMatchup
```

### 10.3 Playoffs

- `simulateSeriesGame.ts` uses same `simulateGameWithContext` path
- Playoff games: `gameType: "playoff"` → +0.005 defensive intensity both teams (optional)
- Momentum carries into playoffs

### 10.4 Player stat minutes

Merge segment minutes per player before `allocatePlayerStats`:

```typescript
const mergedRotation = rotation.map(entry => ({
  ...entry,
  minutes: segmentMinutes.get(entry.player.id) ?? entry.minutes,
}))
```

### Tests
- Full day sim still passes `leagueInvariants`
- Playoff series still advances correctly
- `simulateTeamMatchup.test.ts` updated for OT + quarters

---

## Phase 11 — UI updates (minimal, v1)

**Goal:** Surface new sim data without full coaching UI.

| Surface | Change |
|---------|--------|
| `/league/games/$gameId` | Show OT badge if `meta.overtimes > 0`; quarter scores already shown — now real |
| Game detail | Lineup Fit grade (home/away) with synergy tooltip |
| Team dashboard / standings | Form indicator (Hot/Neutral/Cold) |
| Box score | No change required if player stats reconcile |

**No coaching hire UI in this plan** — only philosophy derived from `coachingLevel`.

---

## Phase 12 — Documentation

Update:
- `docs/simulation-engine.md` — segment flow, OT, synergy, momentum, philosophy
- `docs/roadmap.md` — mark game sim upgrades ✅
- `docs/data-model.md` — `teamMomentum`, extended `TeamMatchupMeta`

---

## Implementation order (recommended)

```
Phase 0  (types, SAVE_VERSION)
   ↓
Phase 1  (extract buildScoringComponents + full skill wiring)
   ↓
Phase 2  (segment regulation) ──→ Phase 4 (blowout) can parallel after 2
   ↓
Phase 3  (overtime)
   ↓
Phase 5  (synergy) + Phase 6 (philosophy) + Phase 7 (momentum) — parallelizable
   ↓
Phase 8  (star concentration)
   ↓
Phase 10 (integration)
   ↓
Phase 9  (calibration — iterative tuning)
   ↓
Phase 11 (UI) + Phase 12 (docs)
```

**Suggested execution chunks for PRs:**

| PR | Phases | Theme |
|----|--------|-------|
| 1 | 0, 1 | Foundations + extract scoring |
| 2 | 2, 3, 4 | Segment sim + OT + blowouts |
| 3 | 5, 6, 7 | Synergy + philosophy + momentum |
| 4 | 8, 9, 10 | Star concentration + calibration + integration |
| 5 | 11, 12 | UI + docs |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Segment rounding breaks stat reconciliation | `mergeComponents` + existing `reconcileComponentPoints`; property tests |
| OT infinite loop | `MAX_OVERTIMES` + sudden-death fallback |
| Calibration can't hit all targets simultaneously | Prioritize score/pace/FG%; widen bounds slightly for minor stats |
| Performance regression (4× sim work) | Segments are cheap math, not PBP; benchmark 1000 games < 2s |
| SAVE_VERSION bump breaks dev saves | Expected; document in commit |
| Synergy too strong → meta rosters | Cap total synergy modifier at ±0.03 efficiency |

---

## Success criteria (v1 game sim)

- [ ] Quarter scores are simulated, not post-hoc distributed
- [ ] Overtime games show `meta.overtimes >= 1` with no FT fudge
- [ ] Blowouts reduce star Q4 minutes and increase bench production share
- [ ] Archetype synergy grade visible and affects outcomes measurably
- [ ] Coaching philosophy derived from staff level affects pace/shot mix
- [ ] Team momentum updates after games and affects next sim
- [ ] Star players average 24–32 PPG; team stats reconcile
- [ ] Calibration test suite passes on 500-game sample
- [ ] All existing `packages/sim` tests pass
- [ ] No user rotation or tactical slider UI introduced

---

## Open items for future plans (out of scope)

- Head coach / assistant coach hiring UI and market
- Coach AI rotation decisions replacing `selectRotation` auto logic
- Play-by-play text generation for user team games
- Foul model and PF in box scores
- In-game injury from specific events (keep existing post-game injury model)
