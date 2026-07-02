# Owner, Goals & Narrative Layer — Design Spec

**Status:** Draft — pending review  
**Date:** 2026-07-02  
**Scope:** Planning only. Companion to [Contracts & Salary Cap v1](./2026-07-02-contracts-salary-cap-design.md).  
**Relationship:** This document describes the **GM-facing game layer** that sits on top of the financial engine. Cap math is deterministic; owner behavior and narrative are the human drama around it.

---

## Summary

Front Office Hoops is not just a roster optimizer — it's a job sim. The user is a GM answerable to an owner, in a city, with a budget philosophy, cap reality, and expectations that change over time.

This spec covers:

- **City & market tier** — where the team plays affects revenue and owner spending
- **Owner personality** — preset archetypes that drive tolerance, patience, and priorities
- **Owner goals** — seasonal objectives the GM must pursue
- **Owner trust** — 0–100% relationship meter; hit zero → potential firing
- **Event system** — narrative and mechanical triggers (owner sale, bad trade, title run, etc.)
- **Team selection difficulty** — Easy / Medium / Hard derived from owner + cap + market + roster, not raw team OVR alone

**Not in scope for this document:** AI narrative text generation (Vercel AI SDK), Convex backend, UI wireframes.

---

## Design Principles

1. **Engine owns truth.** Stats, cap math, and outcomes are sim-computed. Narrative describes what happened; it never overrides results.
2. **Difficulty is situational.** A 78 OVR team with a patient billionaire owner and cap space is "Easy." An 82 OVR team with a cheap owner, tax bill, and win-now mandate is "Hard."
3. **Owners have memory.** Trust, goals, and tolerance shift based on what the GM did — not just W-L.
4. **Discover, don't spoil.** Early on, show enough to choose a team. Later, hide the full picture behind difficulty labels until you're in the job.
5. **Events are pluggable.** v1 financials store empty event logs; this system fills them when narrative ships.

---

## City & Market

Teams already generate with a **city** (`generateTeams.ts`). Extend `Team` with location metadata:

```ts
type MarketTier = 'large' | 'mid' | 'small'

type TeamLocation = {
  city: string
  marketTier: MarketTier
  // future: mediaMarketRank, regionalRevenueMultiplier
}
```

### Market assignment (v1)

At league creation, assign `marketTier` per team:

- **Deterministic from city** if we maintain a city → tier lookup table (preferred for realism: New York = large, Memphis = small)
- **Fallback:** seeded random tier weighted 6 large / 14 mid / 10 small across 30 teams

### Market effects

| System | Effect |
|--------|--------|
| Revenue | `baseRevenue = marketBase[tier]` — large >> small |
| Owner spending bias | Large markets skew toward `competitive` / `all_in` tolerance |
| Fan expectations | Large markets: higher trust penalty for losing; small markets: more rebuild patience |
| Narrative flavor | AI beat reporters reference market size ("small-market team punches above its weight") |

Market tier is **visible** at team selection — it's public knowledge, like real life.

---

## Owner Personality

Each team has one **owner** at league start. Owners are procedurally generated with a persistent archetype.

```ts
type OwnerArchetype =
  | 'frugal'        // hates tax, short leash, loves picks
  | 'patient'       // ok with rebuilds, long trust runway
  | 'win_now'       // spend aggressively, expects playoffs
  | 'meddling'      // frequent goal changes, volatile trust
  | 'hands_off'     // stable trust, vague goals, rarely fires
  | 'analytics'     // values youth, picks, efficiency; skeptical of stars on max deals

type Owner = {
  id: string
  teamId: string
  displayName: string           // e.g. "Victoria Chen"
  archetype: OwnerArchetype
  spendingProfile: TeamSpendingProfile  // from financial spec (marketTier + taxTolerance)
  trust: number                 // 0–100, starts at archetype default
  patience: 'low' | 'medium' | 'high'  // how fast trust decays on failure
  riskTolerance: 'low' | 'medium' | 'high'  // willingness to trade picks, take on bad contracts
}
```

### Archetype → financial profile mapping

| Archetype | Typical taxTolerance | Trust default | Patience |
|-----------|---------------------|---------------|----------|
| frugal | tax_averse | 60 | low |
| patient | prudent | 80 | high |
| win_now | competitive / all_in | 70 | medium |
| meddling | varies | 65 | low |
| hands_off | prudent | 85 | high |
| analytics | tax_averse / prudent | 75 | medium |

`baseTaxTolerance` on spending profile = owner's initial philosophy. Events (owner sale, etc.) can replace the entire `Owner` entity and reset profiles.

---

## Owner Goals

Each offseason (and optionally mid-season), the owner assigns **1–3 goals** for the GM. Goals have a deadline (usually end of season), success/failure criteria, and trust impact.

```ts
type GoalType =
  | 'make_playoffs'
  | 'win_championship'
  | 'win_total'              // e.g. "win 45+ games"
  | 're_sign_player'         // target: playerId
  | 'trade_for_picks'        // accumulate N picks
  | 'reduce_payroll'         // get under tax line by $X
  | 'reduce_avg_age'         // avg roster age below N
  | 'develop_youth'          // give rookies/sophomores X minutes
  | 'draft_top_prospect'     // pick in top N
  | 'avoid_luxury_tax'
  | 'sign_free_agent'        // fill position or star tier

type OwnerGoal = {
  id: string
  teamId: string
  season: number
  type: GoalType
  params: Record<string, number | string>  // e.g. { targetAge: 26, playerId: "..." }
  priority: 'primary' | 'secondary'
  trustReward: number       // +trust on success
  trustPenalty: number      // -trust on failure
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  assignedAt: string        // ISO date
  deadlineSeasonPhase: 'regular_end' | 'playoffs' | 'offseason'
}
```

### Goal generation

Goals are composed from **owner archetype + team situation**:

| Situation | Likely goals |
|-----------|--------------|
| Contender, win_now owner | make_playoffs, win_championship, re_sign_player (star) |
| Rebuilding, patient owner | trade_for_picks, reduce_avg_age, develop_youth |
| Over tax, frugal owner | avoid_luxury_tax, reduce_payroll |
| Star FA expiring | re_sign_player |
| Old roster | reduce_avg_age |

**Meddling owners** may swap or add goals mid-season via events.

### Goal evaluation

Run at season end (and on specific triggers for mid-season goals):

```
for each active goal:
  if criteriaMet(goal): status = completed, trust += trustReward
  else: status = failed, trust -= trustPenalty
```

Goals are **visible in UI** once assigned — they're the owner's explicit expectations.

---

## Owner Trust

Trust is the core relationship meter between GM (user) and owner.

```ts
// On Owner:
trust: number  // 0–100, clamped
```

### Starting trust

Set from archetype (typically 65–85). User doesn't start at 100 — they have to earn full confidence.

### Trust changes

| Event | Typical delta |
|-------|---------------|
| Goal completed (primary) | +8 to +15 |
| Goal completed (secondary) | +3 to +8 |
| Goal failed (primary) | -10 to -20 |
| Goal failed (secondary) | -5 to -10 |
| Made playoffs | +5 |
| Missed playoffs (win_now owner) | -10 |
| Won championship | +20 |
| Luxury tax (frugal owner) | -5 per season |
| Bad trade (see events) | -15 to -40 |
| Owner sale (new owner) | reset to new owner's default |

Trust changes should be **explainable** — show a log: *"Owner trust -12: Failed goal 'Re-sign Marcus Webb'"*.

### Firing

When `trust <= 0`:

1. **Warning state** at trust ≤ 15: UI shows "Owner confidence critical"
2. **Firing check** at trust ≤ 0: roll or auto-fire based on archetype
   - `win_now`, `frugal`, `meddling`: auto-fire at 0
   - `patient`, `hands_off`: one grace season at 0 before firing
3. **Instant firing** for severe events regardless of trust (see Events)

**On firing:** game over for that save (or offer "appeal" / new job search in a future meta-layer). v1 can show a summary screen.

---

## Event System

Events are the backbone for narrative and mechanical surprises. Financial spec already defines `SpendingProfileEvent`; this generalizes to `LeagueEvent`.

```ts
type LeagueEventCategory =
  | 'ownership'
  | 'financial'
  | 'roster'
  | 'performance'
  | 'narrative'

type LeagueEvent = {
  id: string
  season: number
  day?: number
  teamId: string
  category: LeagueEventCategory
  type: string                    // e.g. 'owner_sale', 'bad_trade', 'championship'
  payload: Record<string, unknown>
  effects: EventEffect[]
  narrativeKey?: string            // hook for AI SDK text generation
  createdAt: string
}

type EventEffect =
  | { kind: 'trust_delta'; amount: number }
  | { kind: 'tolerance_change'; newTolerance: TaxTolerance }
  | { kind: 'owner_replace'; newOwner: Owner }
  | { kind: 'goal_add'; goal: OwnerGoal }
  | { kind: 'goal_cancel'; goalId: string }
  | { kind: 'firing' }
  | { kind: 'cash_delta'; amount: number }
```

### Example events

| Event type | Trigger | Effects |
|------------|---------|---------|
| `owner_sale` | Random / narrative / debt crisis | New owner, new tolerance, trust reset, new goals |
| `tax_fatigue` | 3+ consecutive tax seasons | tolerance down one step, goal: reduce_payroll |
| `championship_bonus` | Won title | tolerance up one step, trust +20, optional cash injection |
| `bad_trade` | Traded best player by OVR/value without fair return | trust -25 to -40, possible instant firing |
| `star_demands_trade` | Narrative / player unhappiness | goal conflict, trust pressure |
| `owner_meddlers` | meddling archetype, mid-season | cancel goal, add contradictory goal |
| `financial_distress` | debt > threshold | forced reduce_payroll goal, tolerance → tax_averse |

### Bad trade detection (for firing)

When trades ship, evaluate:

```
tradeValueOut = sum(contractValue + playerValue for outgoing players)
tradeValueIn = sum(same for incoming)

if outgoing includes topPlayerByOVR(team):
  if tradeValueIn < tradeValueOut * 0.7:  // configurable threshold
    emit bad_trade event
    if owner.archetype in ['win_now', 'meddling'] or trust < 30:
      instant firing possible
```

Value formula TBD at trade implementation — use OVR + age + contract for v1.

---

## Team Selection & Difficulty

When picking a starting team, the user should see a **difficulty rating** that reflects the full job, not just roster talent.

### Difficulty inputs

```ts
type TeamDifficultyInputs = {
  rosterOverall: number          // team.overall
  capHealth: 'clean' | 'tight' | 'tax_burden' | 'stuffed'  // derived from payroll vs cap/tax
  marketTier: MarketTier
  ownerArchetype: OwnerArchetype
  taxTolerance: TaxTolerance
  startingTrust: number
  goalSeverity: number           // how hard assigned year-1 goals are
}
```

### Difficulty score (conceptual)

Weighted composite → label:

```
score = 
  rosterFactor * 0.25 +      // lower OVR = harder (inverted)
  capFactor * 0.25 +           // tax/dead cap = harder
  ownerFactor * 0.30 +         // frugal/meddling/win_now = harder
  marketFactor * 0.10 +        // small market = slightly harder
  goalFactor * 0.10            // aggressive year-1 goals = harder
```

| Score range | Label |
|-------------|-------|
| 0.0 – 0.33 | **Easy** |
| 0.34 – 0.66 | **Medium** |
| 0.67 – 1.0 | **Hard** |

### UI visibility — phased approach

| Phase | Team selection screen shows | Rationale |
|-------|----------------------------|-----------|
| **Financials v1** (now) | City, market tier, roster OVR, payroll summary, tax outlook | Enough to choose; owner not fully surfaced yet |
| **Owner v1** | + Owner name/archetype, difficulty badge, year-1 goal hints | Full job preview |
| **Narrative era** | Difficulty badge + market + OVR only; owner archetype **hidden** | Discovery — you learn your boss after accepting the job |

**Recommendation for financials v1:** Show **market tier** and **cap outlook** (e.g. " $18M over tax line") on team pick screen. **Hide** owner archetype and exact tax tolerance until after selection — reveal on first cap sheet / owner intro screen. That bridges to the hidden-difficulty future without building the full owner system yet.

---

## Data Model Additions

```ts
// LeagueRecord additions (future)
type LeagueRecord = {
  // ... existing + financial spec fields
  owners: Owner[]
  ownerGoals: OwnerGoal[]
  leagueEvents: LeagueEvent[]
  trustLog: TrustChangeEntry[]   // audit trail for UI
}

type TrustChangeEntry = {
  id: string
  teamId: string
  season: number
  day?: number
  delta: number
  reason: string
  trustAfter: number
  createdAt: string
}
```

User's team is `league.userTeamId` → lookup `owners.find(o => o.teamId === userTeamId)`.

---

## Integration with Financial Spec

| Financial spec concept | Owner layer usage |
|------------------------|-------------------|
| `TeamSpendingProfile.marketTier` | Same field; drives revenue + difficulty |
| `TeamSpendingProfile.taxTolerance` | Owner archetype sets initial value; events mutate |
| `SpendingProfileEvent` | Subset of `LeagueEvent` |
| `cashReserves` / `debt` | Triggers `financial_distress` event |
| `consecutiveTaxSeasons` | Triggers `tax_fatigue` event |
| Luxury tax bill | Frugal owner trust penalty |

Financial v1 implements profiles and tax without owners. Owner v1 adds `Owner`, goals, trust. Narrative v1 adds event-driven text via AI SDK.

---

## AI Narrative Hooks (future)

When Vercel AI SDK narrative ships, events provide structured context:

```json
{
  "eventType": "bad_trade",
  "ownerName": "Victoria Chen",
  "ownerArchetype": "win_now",
  "playerTraded": "Marcus Webb",
  "trustBefore": 42,
  "trustAfter": 8,
  "tone": "furious"
}
```

AI generates press conference quotes, owner emails, beat reporter articles. **Never** changes trust or roster — display only.

Possible narrative surfaces:

- Owner email at goal assignment
- Press conference after bad loss
- Trade reaction headlines
- Firing letter / news break

---

## Phasing

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **Financials v1** | Contracts, cap, tax, spending profile (no owner UI) | — |
| **Owner v1** | Owner entity, archetypes, goals, trust, firing | Financials v1 |
| **Events v1** | LeagueEvent log, tax_fatigue, bad_trade, owner_sale | Owner v1, Trades |
| **Team pick v2** | Difficulty badge, hidden owner on selection | Owner v1 |
| **Narrative MVP** | AI text for events | Events v1, AI SDK |

Financials v1 should store `owners: []`, `ownerGoals: []`, `leagueEvents: []` as empty arrays (or skip until Owner v1) — minimal cost either way.

---

## Example: Same OVR, Different Jobs

**Team A — "Easy"**
- Seattle Storm, large market
- 76 OVR, $25M cap space, no tax
- Owner: hands_off, trust starts 85
- Goal: make_playoffs (secondary)

**Team B — "Hard"**
- Boise Stampede, small market
- 78 OVR, $12M over tax, dead money on bench
- Owner: frugal + win_now conflict (meddling), trust starts 60
- Goals: make_playoffs (primary), avoid_luxury_tax (primary), re_sign star (primary)

Team B has a better roster but a worse job. That's the design intent.

---

## Open Questions

| Question | Proposed default |
|----------|------------------|
| Show owner on team pick in v1? | No — reveal after pick on cap sheet |
| Firing = game over? | Yes for v1; "new job" meta later |
| AI owners for other teams? | Yes — same goal/trust logic, sim-only (no UI) |
| User pick difficulty filter? | Later — filter teams by Easy/Medium/Hard |

---

## References

- [Contracts & Salary Cap v1](./2026-07-02-contracts-salary-cap-design.md) — financial engine, spending profiles, tax
- [Roadmap](../../roadmap.md) — AI narrative planned via Vercel AI SDK
- `packages/sim/src/generateTeams.ts` — city already assigned at team gen
