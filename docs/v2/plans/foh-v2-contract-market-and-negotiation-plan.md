# Front Office Hoops V2 Contract Market, Negotiation, and Free Agency

**Status:** Design review / proposed
**Date:** 2026-07-31
**Branch reviewed:** `codex/v2-labs-ui-pass`
**Roadmap position:** Phase 2 calibration, Market & Rules Lab; later Phase 5 league integration

## Design conclusion

Build one Market & Rules Lab over several pure V2 modules:

1. Economy and cap rules.
2. Contract demand and market estimates.
3. Offer legality and affordability.
4. Player offer evaluation and negotiation willingness.
5. Re-signing, extension, and free-agency market resolution.
6. Headless multi-season economy calibration.

The first implementation slice should be the smallest complete offer loop:

```text
player + UPV snapshot
  → contract demand
  → team offer
  → legality and affordability
  → player evaluation
  → willingness update
  → accept / wait / decline / lockout
  → validated fixture/report export
```

This should be a calibration fixture first, not an attempt to add the entire offseason lifecycle to the current foundation league. The current V2 `LeagueDocument` is still foundation-only, while `entities.contracts` and `entities.offers` are generic JSON placeholders. The market lab can establish the contracts before those records are promoted into authoritative gameplay state.

## 1. Current codebase findings

### V2 implementation

- `packages/domain-v2` owns canonical player, season, value, career, league, command, and event types.
- `PlayerEntity` contains age, positions, archetypes, skills, development profile, injury resistance, traits, and league status. It has no contract, salary, preference, owner, or team-finance fields.
- `LeagueDocument` is a valid foundation snapshot. It already has generic maps for `contracts`, `offers`, `owners`, and `staff`, but those maps are not typed V2 entities yet.
- `LeaguePhase` is currently only `"foundation"`; `AdvanceDay` is deliberately rejected. Contract commands must therefore be designed now but integrated into lifecycle commands later.
- `TeamEntity` currently contains only `id` and `name`. Team quality, payroll, cap position, roster needs, tax tolerance, and strategy must enter the market through a typed fixture context first.
- `PlayerLeagueStatus` already distinguishes rostered, re-signing, free-agent, draft-prospect, retired, and unassigned players. This is useful for projected-pool derivation, but it is not itself contract state.

### Existing value and production systems

- `packages/sim-v2/src/playerValue.ts` calculates `UniversalPlayerValue` from current ability, season production, age/trajectory, upside, durability, role, and defensive contribution.
- `UniversalPlayerValue.rawValue` is an unbounded additive signal. It is not a salary, ranking input, replacement-level value, or team-fit value.
- `UniversalPlayerValue.diagnostics.rank` and `percentile` are reporting views and must not become the contract-pricing input.
- `UniversalPlayerValue.sample.seasons` is currently `0` in the one-season runner. The market fixture must retain the value evaluation point and confidence rather than pretending the value is a fully mature three-season estimate.
- Production aggregation and career transitions are already pure, deterministic V2 modules. Contract code should consume their outputs and must not recalculate production, potential, age curves, or durability.

### Existing V2 lab and worker patterns

- Game, Production & Value, and Career Cohort labs use typed fixtures, strict schemas, JSON report envelopes, seeded deterministic runs, and Web Workers for long runs.
- `packages/calibration` owns headless batches and benchmark reports. `packages/sim-v2` must remain independent of calibration.
- `packages/league-schema` validates strict typed reports and the current foundation document. Contract fixtures and reports should follow the same pattern.
- `packages/db-v2` persists validated `LeagueDocument` snapshots and exports/imports JSON. It must not persist calibration reports as gameplay state.

### V1 reference code

V1 contains useful reference concepts in `packages/shared` and `packages/sim`, including contracts, cap math, extensions, free-agent scoring, offer evaluation, and offer records. V2 must not import those modules or their `LeagueRecord` assumptions. In particular, V1's rating-to-salary functions and offer-market flow do not provide a real market-clearing model, and V1 offer IDs use non-deterministic UUID behavior.

Use V1 only to identify product gaps and migration hazards. Reimplement the V2 contracts around typed fixtures, deterministic IDs, UPV inputs, and separate legality/interest/acceptance results.

## 2. Existing reusable systems

Reuse these V2 boundaries:

| Need | Reuse | Constraint |
|---|---|---|
| Player basketball signal | `UniversalPlayerValue` and its breakdown | Do not recompute production, potential, age, or durability in market code |
| Player identity/status | `PlayerEntity` and `PlayerLeagueStatus` | Contract state remains a separate entity |
| Player role and supply categories | Primary/secondary positions, archetypes, role output | Use broad market categories; do not price every archetype independently |
| Deterministic runs | `RandomSource` and explicit lab seeds | Stable IDs and seeded draws; never `crypto.randomUUID()` in lab facts |
| JSON boundaries | `league-schema` Zod schemas and versioned report envelopes | Strict fixtures, reports, and migrations |
| Long-running execution | Existing worker adapters and progress/cancel pattern | Single evaluation may run locally; batches belong in a worker |
| Persistence | `LeagueRepository` for future league snapshots | Lab reports remain separate from `LeagueDocument` |
| Explanations | `DiagnosticEntry`, `LeagueEvent`, and existing breakdown patterns | Use structured reason codes before prose |

## 3. Product decisions retained from the brief

The following decisions fit the current architecture:

- UPV is the primary basketball-value input, not a salary.
- Demand, market estimate, team-specific value, offer evaluation, legality, affordability, and surplus remain separate results.
- The initial economy is soft-cap-plus-tax with a hard payroll ceiling, not a complete NBA CBA.
- Re-signing, extensions, and free agency use the same demand and offer-evaluation modules with different context and eligibility rules.
- Free agency has three visible primary rounds with AI offers first, user offers second, and player decisions third.
- A player can wait, decline, accept, or lock a team out for the current negotiation phase.
- The market uses actual supply, team needs, cap position, alternatives, and remaining spending capacity.
- Outcomes are explainable through bounded components and reason codes.
- Standard gameplay settings are stable and predictable; volatility is an explicit preset or seeded lab setting.
- Lab outputs are evidence and fixtures, never an alternate league state.

## 4. Recommended pushback and changes

### 4.1 Add a small hidden preference profile to `PlayerEntity`

The market needs player-specific behavior to persist across seasons, so the agreed direction is to add a small typed `PlayerMarketProfile` to `PlayerEntity`. Generate it with its own deterministic random scope so changing preference calibration does not reroll basketball skills. This is a market behavior profile, not a general personality system.

The first profile should contain only salary priority, security priority, winning priority, role priority, loyalty, patience, and negotiation baseline. These are market behavior inputs, not narrative personality traits.

### 4.2 Do not add a separate production or potential model for contracts

UPV already contains production, current ability, trajectory, upside, durability, role, and defensive contribution. Reapplying those factors in contract demand will double-count them and make calibration impossible to interpret.

Contract code may use UPV confidence and evaluation age as context. It may not independently add points-per-game, potential, injury resistance, or age multipliers to salary without an explicit contract-specific reason.

### 4.3 Do not implement automatic counteroffers in the first slice

Counteroffers add another decision state without proving that the market is calibrated. Let the user submit a revised offer. The player returns a structured response with the gap, preferred term, and willingness change. A future negotiation mode can turn that information into generated counter terms.

### 4.4 Three rounds need a cleanup pass

Keep three visible rounds for pacing and user comprehension. Add one automatic late-market cleanup pass for minimum/depth players after Round 3. It is not a fourth user-facing negotiation round. Without it, the market will either leave too many legal-roster problems unresolved or force implausible Round 3 behavior.

### 4.5 Use a real simplified Bird-rights model

A soft cap with no exceptions is functionally a hard cap. The first market will use the Bird-rights family plus room and minimum mechanisms:

1. Cap-room signing: external signing using unused soft-cap room.
2. Full Bird, Early Bird, and Non-Bird rights for the team's own free agents.
3. Minimum-salary signings for roster completion.

Room teams may use cap space. Teams above the soft cap may use Bird rights for eligible own players or minimum mechanisms. MLE/BAE-style exceptions, trade exceptions, and other external above-cap mechanisms are deferred until the first market passes calibration.

The league retains a hard-cap state for future triggers, but no first-slice action needs to trigger it. Every accepted transaction must still pass the active hard-cap invariant when that state is present.

### 4.6 Do not make random annual cap growth the standard gameplay model

Standard cap growth should be a fixed, configurable rate with line-specific offsets and bounded floors/ceilings. A seeded economic shock can be used by the volatile lab preset. Random growth in the standard league would make long-run salary calibration noisy and make user expectations difficult to explain.

### 4.7 Options and guarantees should wait

Player options, team options, non-guaranteed money, stretch rules, and detailed guarantee structures affect projected availability, legality, negotiation utility, and dead money at once. They are not required to prove the market. The first contract model should use fully guaranteed annual salaries with no options. Add options only after the core market and save/resume flow are stable.

### 4.8 Dead money belongs in the first league integration, not the first market fixture

A fully guaranteed contract cannot be released for free in the eventual league. The league integration should derive dead money from waived remaining guarantees. The isolated Market Lab does not need release transactions to prove demand and market clearing, so dead money can follow the first contract model without blocking this lab.

## 5. Contract domain model

Create focused V2 types in `packages/domain-v2/src/contracts.ts` and `packages/domain-v2/src/market.ts`. Do not add more `JsonRecord` fields for the market.

### 5.1 Money representation

Represent salary and cap amounts as integer whole dollars in V2. The UI formats them as millions. This avoids ambiguous floating-point salary values and makes cap/payroll reconciliation exact.

```ts
type Money = number // integer USD; validated as non-negative where applicable
```

### 5.2 Economy configuration and snapshot

```ts
type EconomyGrowthPreset = "stable" | "standard" | "volatile"

type EconomyConfig = {
  version: 1
  presetId: "standard" | "custom"
  softCap: Money
  hardCap: Money
  taxLine: Money
  minimumSalary: Money
  maximumSalary: Money
  minimumTeamPayroll: Money
  capGrowthRate: number
  taxLineGrowthRate: number
  minimumSalaryGrowthRate: number
  maximumSalaryGrowthRate: number
  rookieScaleGrowthRate: number
  growthPreset: EconomyGrowthPreset
  taxRate: number
  roster: { minimum: number; maximum: number }
}

type EconomySnapshot = {
  season: number
  softCap: Money
  hardCap: Money
  taxLine: Money
  minimumSalary: Money
  maximumSalary: Money
  minimumTeamPayroll: Money
  taxRate: number
  rookieScaleVersion: number
}
```

The config is the resolved rules preset. The snapshot is the season-specific economic state used by a fixture or league command.

### 5.3 Contract entity

```ts
type ContractType = "standard" | "rookie-scale" | "minimum"
type ContractStatus = "active" | "expired" | "waived"

type ContractEntity = {
  id: string
  playerId: string
  teamId: string
  startSeason: number
  endSeason: number
  annualSalaries: Money[]
  guaranteedSalaries: Money[]
  type: ContractType
  status: ContractStatus
  signedSeason: number
}
```

The first version requires `annualSalaries.length === endSeason - startSeason + 1` and fully guaranteed salaries. `guaranteedSalaries` is retained as an explicit field so later partial guarantees do not require changing the contract shape.

### 5.4 Free-agency rights

```ts
type BirdRightsLevel = "none" | "non-bird" | "early-bird" | "bird"

type FreeAgencyRights = {
  playerId: string
  teamId: string
  level: BirdRightsLevel
  consecutiveSeasons: number
  eligibleSeason: number
  renounced: boolean
}
```

Rights are a team-player relationship derived from contract history and transactions, but the resolved relationship should be explicit in market fixtures and later in the league snapshot. The first market must test the three rights levels independently. Rights limits and term requirements belong in the legality result, not in player demand.

### 5.5 Offer and negotiation state

```ts
type ContractMarketPhase = "re-signing" | "extension" | "free-agency"
type ContractOfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired"

type ContractOffer = {
  id: string
  playerId: string
  teamId: string
  phase: ContractMarketPhase
  round: number
  years: number
  firstYearSalary: Money
  annualSalaries: Money[]
  status: ContractOfferStatus
  submittedSeason: number
  submittedDay: number
  legality: ContractLegalityResult
  decision?: ContractOfferDecision
}

type NegotiationState = {
  id: string
  playerId: string
  teamId: string
  phase: ContractMarketPhase
  season: number
  willingness: number // 0..100; the score is authoritative for the active phase
  status: "open" | "locked" | "accepted" | "ended"
  lastOfferId: string | null
  offersSubmitted: number
  lockReasonCode?: string
}
```

Use a willingness score plus a small derived state machine. Do not store a separate opaque "mood" and willingness value that can disagree.

### 5.6 Player and team market context

```ts
type PlayerMarketProfile = {
  salaryPriority: number
  securityPriority: number
  winningPriority: number
  rolePriority: number
  playingTimePriority: number
  marketSizePriority: number
  loyalty: number
  patience: number
  negotiationBaseline: number
}

type TeamMarketContext = {
  teamId: string
  teamQuality: number
  payroll: Money
  capRoom: Money
  hardCapRoom: Money
  taxRoom: Money
  rosterSlots: number
  needByPosition: Record<string, number>
  strategy: "rebuilding" | "neutral" | "contending"
  spendingTolerance: number
}
```

`PlayerMarketProfile` is persisted as hidden player state. Team quality, payroll, cap position, roster needs, tax tolerance, role opportunity, and strategy remain team/market context rather than player fields. The later league adapter derives `TeamMarketContext` from authoritative teams, contracts, standings, owners, and settings.

The player's `loyalty` field represents how much the player values familiarity and continuity. Actual loyalty to a specific team is calculated from the player profile plus team relationship facts such as tenure and prior contract history.

## 6. Contract schema

Add strict Zod schemas in `packages/league-schema/src/contracts.ts` or a focused section of `schema.ts`, then export them from `packages/league-schema/src/index.ts`.

Required schema boundaries:

- `economyConfigSchema`
- `economySnapshotSchema`
- `contractEntitySchema`
- `contractOfferSchema`
- `negotiationStateSchema`
- `contractMarketFixtureSchema`
- `contractMarketResultSchema`
- `contractMarketReportSchema`

Schema rules should enforce:

- Money values are integers and non-negative unless a field explicitly represents a signed adjustment.
- Salary arrays match the declared contract/offer years.
- First-year salary is between minimum and maximum salary.
- Annual raises are generated by the resolved rules and do not exceed configured bounds.
- Contract IDs, offer IDs, and negotiation IDs are stable and non-empty.
- A player has at most one active contract.
- A contract's team and player references exist in the fixture.
- A pending/accepted offer references a legal team and eligible player.
- A hard-cap-invalid offer cannot be marked accepted.
- A projected free-agent view references players and contracts rather than copying player records.
- Report schema versions are distinct from gameplay document schema versions.

The current foundation `LeagueDocument` should continue to validate while contract types are introduced. Promote `entities.contracts` and `entities.offers` from generic records only when the first lifecycle command needs them, with a schema migration and golden fixture.

## 7. Projected free-agency model

Projected free agency should be a derived view, not a second player pool and not an authoritative copy of player records.

```ts
type ProjectedFreeAgent = {
  playerId: string
  teamId: string | null
  eligibilitySeason: number
  reason: "currently-unassigned" | "contract-expiring" | "option-or-rule"
  projectedStatus: "likely" | "possible" | "controlled"
}

type ProjectedFreeAgencyView = {
  season: number
  generatedFromRulesVersion: number
  players: ProjectedFreeAgent[]
}
```

For the first version, include current free agents and players whose active contract ends after the current season. Because options are deferred, there is no option-resolution ambiguity. Extensions and re-signings change the active contract, so the view changes automatically when rebuilt.

Recommended storage:

- In a lab: include the derived view in the fixture/report for inspection and reproducibility.
- In a live league: derive it from player statuses and contracts at phase boundaries. Cache it in a rebuildable projection only if profiling proves it necessary.
- In JSON export: include it only in operational/debug projections, never as the only source of contract truth.

The view should be rebuilt after signings, extensions, releases, and phase transitions. It should not duplicate `PlayerEntity` data.

## 8. Contract-demand model

The demand pipeline should answer “what does this player expect?” without pretending to know which team will win the market.

```ts
calculateContractValueEstimate(input)
calculatePlayerContractDemand(input)
```

### 8.1 Inputs

- UPV snapshot and confidence.
- Current season/economic snapshot.
- Player age, career phase, role, position, and archetype.
- Prior contract salary and years, normalized to the current cap.
- Projected market context and broad comparable-market facts.
- Player market profile.
- Contract phase and requested term.

Production, potential, durability, and age should enter through UPV. The demand module may expose their UPV breakdown in the explanation, but should not independently add them again.

### 8.2 Value-to-salary mapping

Use a calibrated piecewise mapping from absolute UPV raw value to a cap-relative annual baseline. Do not use UPV percentile or a league-relative rank as the primary input. A player should carry roughly the same baseline contract value when moved between otherwise equivalent leagues.

The mapping should have named internal anchors such as depth, rotation, starter, high-level starter, and star. The exact thresholds and slopes belong in the versioned developer calibration config, not in the UI as arbitrary coefficients.

### 8.3 Contract-specific adjustments

Apply only factors that are not already UPV truth:

- Cap environment and salary scale.
- Prior-salary continuity, translated to the current cap.
- Market scarcity and alternative supply.
- Contract term/security preference.
- Negotiation phase and time pressure.
- Player preference for winning, role, loyalty, or security.

Prior salary is an anchor, not a floor. Rookie contracts are a deliberate exception because they are below-market by design. An old overpay should not perpetuate forever.

### 8.4 Demand output

```ts
type ContractDemandResult = {
  playerId: string
  phase: ContractMarketPhase
  expectedFirstYearSalary: Money
  acceptableFirstYearRange: { min: Money; max: Money }
  preferredYears: { min: number; max: number }
  securityPreference: number
  confidence: "provisional" | "early" | "established" | "full"
  components: {
    upvBaseline: Money
    priorSalaryAnchor: Money
    scarcityAdjustment: Money
    marketAdjustment: Money
    preferenceAdjustment: Money
  }
  reasonCodes: string[]
}
```

The demand range is not an offer. A team may value the player more or less, and a legal offer may still be declined because the player is waiting for a better market outcome.

## 9. Offer-evaluation model

Keep four production results separate:

1. `ContractDemandResult`: player expectation.
2. `TeamInterestResult`: team-specific basketball and financial interest.
3. `ContractLegalityResult`: whether the transaction is permitted.
4. `ContractOfferDecision`: how the player responds to a legal offer in context.

### 9.1 Team interest

```ts
type TeamInterestResult = {
  teamId: string
  playerId: string
  score: number
  maximumFirstYearSalary: Money
  preferredYears: { min: number; max: number }
  components: {
    upvValue: number
    positionalNeed: number
    roleFit: number
    teamTimeline: number
    replacementCost: number
    financialPressure: number
    alternativeAvailability: number
  }
  targetPriority: "primary" | "secondary" | "depth"
  reasonCodes: string[]
}
```

Team interest is not a second UPV. It adds team need, fit, replacement cost, financial pressure, and strategy context.

### 9.2 Legality and affordability

```ts
type ContractLegalityResult = {
  valid: boolean
  affordability: "affordable" | "over-budget" | "over-hard-cap"
  mechanism: "cap-room" | "bird" | "early-bird" | "non-bird" | "minimum" | "rookie-scale"
  payrollBefore: Money
  payrollAfter: Money
  hardCapRoomAfter: Money
  taxAfter: Money
  codes: string[]
}
```

Legality must run before player acceptance. A player can like an illegal offer; the offer cannot become an accepted contract.

### 9.3 Player offer decision

The first decision model should use a bounded utility score with visible components:

- Salary relative to demand.
- Guaranteed total/security.
- Years and end-of-contract risk.
- Team quality/winning.
- Expected role and positional opportunity.
- Loyalty/familiarity where applicable.
- Market timing and patience.
- Current negotiation willingness.
- Competing offers.

Return one of:

```ts
type ContractOfferDecision = {
  result: "accept" | "wait" | "decline" | "refuse"
  score: number
  reasonCodes: string[]
  summary: string
  breakdown: Record<string, number>
  willingnessBefore: number
  willingnessAfter: number
}
```

The exact internal score is a developer diagnostic. The normal product UI should show a market range, interest label, and reason summary rather than raw coefficients.

For the initial resolver, the highest qualifying offer utility wins for that player. An offer must first clear the player's acceptance threshold; if no offer qualifies, the player waits or declines according to patience, market round, and willingness. Do not randomly override the best qualifying offer. Seeded variance may break a genuinely close tie or model uncertainty, but the result must remain explainable and reproducible.

## 10. Negotiation-willingness model

Use a `0..100` score per player/team/phase/season. The score is deterministic and saved while the phase is active.

Suggested behavior:

- Start from a player/phase baseline, not always exactly 100.
- An offer near the demand range causes no or minimal penalty.
- A lowball penalty grows nonlinearly as the offer falls below demand.
- Repeated offers accumulate a smaller additional penalty.
- An improved offer recovers part of the previous penalty but does not erase history instantly.
- Reducing an offer is a stronger negative event than merely holding it flat.
- Better years/security can offset a modest salary gap.
- A better competing offer can reduce patience without making every other team hostile.
- Below the lockout threshold, the player refuses further offers from that team for the current phase.

The lockout is phase-scoped. It resets at the next negotiation phase; a re-signing lockout does not prevent the player from considering another team in open free agency.

Do not implement a universal three-strikes rule. The score and reason codes are the source of behavior; `locked` is derived from the score threshold and phase.

## 11. Re-signing workflow

Re-signing is a team-local negotiation window before open free agency:

1. Build the projected free-agent view.
2. Mark expiring players as `re-signing` candidates for their current team.
3. Calculate a market estimate and player demand without formal external offers.
4. The team submits an offer.
5. Validate eligibility, years, salary, hard cap, and roster/cap constraints.
6. Evaluate the player as `accept`, `wait`, `decline`, or `refuse`.
7. On acceptance, create a new active contract and emit signing events.
8. On no agreement at phase end, move the player to free agency.

The player can see that the projected market is strong or weak, but other teams do not submit formal offers during re-signing. This preserves the distinct purpose of the phase and avoids simulating the same market twice.

Re-signing should allow the current team to exceed the soft cap when the player has Full Bird, Early Bird, or Non-Bird rights, subject to the applicable rights limit, salary maximum, and any active hard-cap state. The re-signing phase gives the current team first negotiation access, not an automatic acceptance advantage.

## 12. Extension workflow

Use the same demand and offer modules with an extension context:

1. Confirm the player is on the team and has an active contract.
2. Apply a deliberately simple extension eligibility rule for the first version.
3. Determine projected value at the extension start, using the existing UPV/career snapshot rather than recalculating production.
4. Calculate demand with security, injury-before-free-agency, loyalty, and future-market-risk context.
5. Validate the offer against term, salary, maximum, and hard-cap rules.
6. Evaluate the player and either append the extension years or leave the current contract unchanged.

Do not implement every NBA extension restriction, holdout, or eligibility exception. The first version should support one clear extension window and a bounded maximum total term. Detailed eligibility can be added after the loop is playable.

## 13. Free-agency round workflow

Use three visible primary rounds plus an automatic cleanup pass.

```text
Round 1: AI offers → user offers → player decisions
Round 2: AI redirects → user offers → player decisions
Round 3: AI final targeting → user offers → player decisions
Cleanup: automatic minimum/depth signings and legal-roster repair
```

At each round:

1. Rebuild team payroll, cap room, hard-cap room, tax position, roster needs, and remaining exception capacity.
2. Recompute market supply and alternatives from unsigned players.
3. AI teams submit legal offers within their active offer/reservation limits.
4. The user reviews offers and submits, improves, withdraws, or passes.
5. Resolve player decisions across all offers using competing-offer utility.
6. Create contracts for accepted offers, expire conflicting offers, update statuses, and emit events.
7. Update willingness and market diagnostics.

The market should not resolve every player in Round 1. Star players with multiple strong legal offers should usually resolve earlier than uncertain role players. The last round and cleanup may accept lower offers when patience and alternatives have fallen.

Pending offers do not change payroll until accepted, but they reserve projected signing capacity for the submitting AI team. This prevents an AI team from maintaining impossible simultaneous commitments without modeling a full transaction escrow system.

## 14. AI team bidding model

The first AI does not need persistent organizational memory. It needs legal, explainable decisions.

For each team:

1. Build an eligible target pool from unsigned players.
2. Score each target using UPV, positional need, role fit, replacement cost, expected contract, team quality, timeline, and financial pressure.
3. Classify targets as primary, secondary, or depth.
4. Submit at most a small number of concurrent offers, reserving projected capacity.
5. After decisions, redirect to alternatives rather than bidding against a signed player.
6. Preserve a minimum amount of room for roster completion when required.

Use three baseline strategies only:

- `rebuilding`: youth/upside and flexibility.
- `neutral`: balanced value and need.
- `contending`: proven production, core retention, and higher tax tolerance.

Strategy profiles are behavior modifiers, not full persistent AI plans. Owner personality, multi-year planning, and complex organizational memory remain deferred.

## 15. Market-scarcity model

Start with broad, stable categories:

- Primary position.
- Quality tier derived from absolute UPV bands: star, starter, rotation, depth.
- Broad role family when available from the existing role/archetype output.

Do not use all 14 archetypes as independent pricing buckets. Small sample sizes would create unrealistic scarcity spikes.

For each category, calculate:

```text
market pressure = projected team demand / max(1, available supply)
scarcity adjustment = bounded function(market pressure - 1)
```

Demand counts should come from roster vacancies, team needs, and likely targets. Apply a bounded adjustment to contract demand, with a small maximum salary effect. Scarcity should not turn one unusual archetype into an automatic maximum contract.

Track two distinct effects:

- Player-level scarcity: changes the market expectation for a category.
- Team-level need: changes one team's interest and maximum offer.

When alternatives sign, remaining supply falls and the category pressure can rise. When many comparable players remain unsigned, pressure can fall. All changes should be reported as reason codes.

## 16. Simplified cap rules

### Included in the first model

- Soft cap as the planning/reference line.
- Hard-cap state as an absolute payroll ceiling when a future trigger activates it.
- Tax line and simple progressive or linear tax rate.
- Minimum salary and minimum team payroll.
- One maximum salary amount with no detailed NBA eligibility tiers.
- Fully guaranteed standard and rookie-scale contracts.
- Contract terms of one to four years, with bounded raises.
- Cap-room, Full Bird, Early Bird, Non-Bird, minimum, and rookie-scale mechanisms.
- Payroll, cap-room, hard-cap-room, and tax projections.
- Exact legality diagnostics.

### Transaction rules

- A cap-room signing cannot consume more soft-cap room than exists.
- A rights-qualified signing can exceed the soft cap for a team's own player.
- An external above-cap signing uses only the minimum mechanism in the first slice.
- Every signing and extension must respect any active hard-cap state.
- All salaries must respect minimum and maximum amounts.
- Tax is a financial consequence, not a legality failure.
- Pending AI offers reserve projected capacity but do not count as payroll until accepted.
- A team cannot accept an offer that would violate roster or hard-cap invariants.

The exact tax curve, exception size, maximum amount, and roster counts are calibration outputs. They should be stored in the resolved economy config, not scattered constants.

## 17. Cap-growth model

Use a deterministic baseline:

```text
next line = round(previous line × (1 + configured growth rate))
```

Each line can have a bounded rate and minimum/maximum guardrail. The standard preset should use stable fixed rates. Lab presets can add a seeded bounded shock around the base rate:

```text
effective rate = clamp(base rate + seeded shock, floor, ceiling)
```

The shock must be recorded in the economy snapshot and report. It must never use ambient runtime randomness.

Calibrate cap, tax, minimum, maximum, and rookie-scale growth together. Growing only the cap while freezing the minimum or rookie scale would change roster economics over long runs.

## 18. Rookie-scale model

Rookie scale belongs in the shared economy configuration because it must scale with the salary cap, even though draft position supplies the slot.

```ts
type RookieScaleConfig = {
  version: 1
  slotCount: number
  topSlotSalary: Money
  bottomSlotSalary: Money
  declineCurve: "linear" | "smooth"
  annualGrowthRate: number
  contractYears: number
}
```

The first version should:

- assign a deterministic salary to each draft slot;
- use a four-year rookie-scale contract without negotiation;
- grow the scale with the resolved economy snapshot;
- preserve the slot and scale version for explanation;
- defer holdouts, options, and rookie exceptions.

The draft lab may inspect the scale, but `sim-v2` owns the salary calculation and contract creation.

## 19. Settings architecture

Every gameplay-relevant setting must be typed, versioned, bounded, serializable, and captured in reports.

### User-facing standard/advanced settings

- Economy preset.
- Cap growth preset.
- Tax severity.
- Minimum/maximum salary scale.
- Free-agency round count, with three as the standard.
- Negotiation difficulty.
- Player patience.
- Market volatility.
- AI spending aggressiveness.
- Whether players wait more often for later rounds.

### Developer calibration settings

- UPV-to-salary curve anchors.
- Prior salary anchor strength.
- Scarcity bounds.
- Comparable-market weight.
- Offer score weights.
- Willingness penalty/recovery curve.
- Lockout threshold.
- Round-to-round demand movement.
- AI shortlist size and offer reservation count.
- Minimum-roster cleanup behavior.

### Internal-only settings

- Raw utility coefficients.
- Seeded random draw details.
- Diagnostic thresholds.
- Benchmark targets.
- Failure classification thresholds.

League settings are chosen at creation and locked for the first V2 loop, matching the existing UI architecture. Lab settings can be changed between runs and must always show their resolved values.

Negotiation difficulty should change the gap between demand and acceptance thresholds, willingness sensitivity, and AI competitiveness—not secretly change player ability, production, or the legality rules.

## 20. Event model

Extend the V2 event vocabulary with structured transaction events:

- `contract.offer-submitted`
- `contract.offer-improved`
- `contract.offer-withdrawn`
- `contract.offer-resolved`
- `contract.negotiation-locked`
- `contract.player-signed`
- `contract.player-extended`
- `contract.player-entered-free-agency`
- `contract.player-waived`
- `market.round-resolved`
- `market.demand-shifted`
- `economy.season-advanced`

Do not emit a separate event for every derived scarcity calculation. Include market diagnostics in the round report and emit a compact round event with the relevant source facts.

Each event should include stable entity references, phase/season/day, source command or simulation ID, structured payload, summary, importance, and story tags. Event IDs must be deterministic within a deterministic lab fixture and stable after save/reload.

## 21. JSON and save strategy

### Calibration fixtures and reports

Add separate versioned envelopes:

- `foh-contract-market-fixture`
- `foh-contract-market-result`
- `foh-contract-market-calibration`
- `foh-economy-calibration`

Fixtures include players, UPV snapshots, team contexts, contracts, economy snapshot, projected pool, market profiles, settings, source/version, and seed. Reports include resolved settings, scenario inputs, offers, decisions, events, metrics, failures, and retained outlier fixtures.

Reports are not importable as league state.

### Live league state

When lifecycle integration begins:

- active contracts belong in `LeagueDocument.entities.contracts`;
- active/pending offers and negotiation states belong in typed operational state;
- current payroll/cap/tax values are rebuildable projections;
- projected free agency is a rebuildable projection;
- completed transaction events belong in `history.events`;
- old offer diagnostics may be retained in optional/debug data or compact event payloads.

Save after each completed offer command and market-round resolution. A reload must preserve the active phase, pending offers, willingness scores, completed decisions, and deterministic next IDs.

The worker owns the command and returns a validated new document. React state is read-only view state, and Dexie remains a repository adapter.

## 22. Contract and Market Lab design

Add a V2 route at `/developer-labs/market-rules` and keep it as one major lab with modes rather than several permanent routes.

### Mode A: Contract inspector — first visual slice

Select or generate a player and inspect:

- UPV and confidence.
- UPV breakdown and source evaluation point.
- Age, career phase, role, position, health/availability summary.
- Prior salary and current cap context.
- Projected free-agent status.
- Market category and scarcity.
- Demand range and preferred years.
- Comparable-market bucket, if available.

Submit several offers and inspect:

- legality and affordability;
- offer score and decision;
- willingness before/after;
- structured reason codes;
- resulting contract schedule;
- serialized fixture/report.

### Mode B: Re-signing and extension scenarios

Configure team, current contract, projected market, and offer terms. Show eligibility, demand, willingness, and the exact state transition.

### Mode C: Small market simulation

Run a compact deterministic market with several teams and players. Show rounds, offers, signings, lockouts, remaining supply, cap room, and outliers. This is the first place to prove competing offers and market evolution.

### Mode D: Headless/batch reports

Run 100-market and multi-season economy batches in a worker. The UI summarizes distributions, benchmark checks, failed seeds, and downloadable reports. It should not render every offer in a large batch. One-, four-, and five-year runs can begin as a market-only economy harness; ten-year runs should be labeled as economy harnesses until draft, retirement, development, and roster turnover are integrated with the league loop.

Use existing V2 UI conventions: `DecisionHeader`, `ExplanationPanel`, `ScenarioToggle`, `WorkerProgress`, responsive tables, keyboard-accessible offer controls, and explicit empty/loading/error states.

## 23. Automated test strategy

### Domain and schema tests

- Contract term/salary arrays are structurally valid.
- Money and growth values obey bounds.
- IDs and entity references are stable.
- Active contract uniqueness is enforced.
- Offer and negotiation schemas reject impossible states.
- Fixtures and reports round-trip through JSON.
- Current foundation league documents still validate.

### Pure simulation tests

- Same fixture and seed produce byte-equivalent results.
- Different seeds can vary outcomes without changing deterministic inputs.
- UPV is consumed without recalculating production or changing the player entity.
- Demand increases monotonically across calibrated UPV bands absent countervailing market context.
- Prior salary influences continuity but is not an absolute floor.
- Scarcity is bounded and cannot create an unlimited salary.
- Near-market offers do not trigger severe willingness loss.
- Extreme lowballs can lock a team out.
- Improved offers can recover willingness within bounds.
- Illegal offers never become accepted contracts.
- Accepted offers leave no duplicate active contracts or signed free agents.
- Competing offers resolve exactly one player outcome.
- Pending reservations cannot exceed a team's configured offer capacity.

### Market and economy invariants

- Payroll equals the sum of active salaries plus derived dead money.
- Tax equals the configured tax function of payroll above the tax line.
- No team exceeds the hard cap after any accepted transaction.
- All active salaries respect minimum/maximum rules.
- Rookie scale salaries match draft slots and season snapshots.
- Projected free-agent views match contract expirations and statuses.
- Re-signing, extension, and free-agency transitions are phase-valid.
- A market round is replayable after save/reload.

### UI/worker tests

- Worker forwards progress and cancellation.
- Worker failure returns a visible recoverable error.
- Reports retain the seed and resolved settings.
- Offer controls expose legality before submission.
- Keyboard users can move through offer terms and submit/withdraw actions.
- Responsive market tables preserve player/team identity and primary actions.

## 24. Calibration benchmark strategy

Begin with deterministic fixture families rather than a large realistic league:

1. Single-player salary ladder: same context, varying UPV.
2. Salary-continuity set: same player across prior salaries and career states.
3. Scarcity set: same quality players under shallow/deep position supply.
4. Competing-offer set: same player with different team quality, role, and cap contexts.
5. Negotiation set: near-market, moderate lowball, severe lowball, improving, and reducing offers.
6. Re-signing/extension set: current team versus projected market.
7. Small market: several teams, several tiers, three rounds.
8. Full 30-team market: generated universe, realistic payrolls, and legal roster targets.

The first batch should run at least 100 markets across explicit seeds. Retain every failed legality/invariant seed and a representative outlier for surprising but explainable outcomes.

Track:

- salary by UPV band and age/career band;
- salary as a percentage of cap;
- maximum/minimum frequency;
- median years by tier;
- prior-salary raises and pay cuts;
- bidder count and acceptance round;
- unsigned-player count and quality;
- willingness lockouts;
- AI target concentration;
- tax frequency and payroll spread;
- hard-cap violations;
- explanation coverage for unusual contracts.

The first acceptance bar is not “contracts look like the NBA.” It is:

- higher basketball value generally earns higher pay under matched contexts;
- market factors can create meaningful exceptions;
- no routine legality failures occur;
- pay cuts, bargains, and overpays are bounded and explainable;
- the user still has meaningful targets after AI bidding;
- repeated seeds produce stable distributions.

## 25. Multi-season economy validation

Run 30-season deterministic economy scenarios with:

- stable, standard, and volatile growth;
- low, standard, and high tax severity;
- different market-size and spending-tolerance distributions;
- young, balanced, and veteran-heavy player populations;
- standard and high-market-volatility settings.

Check:

- cap, tax, minimum, maximum, and rookie-scale growth remain bounded;
- average salary/cap ratio remains stable;
- payroll concentration does not collapse to one or two teams;
- maximum and minimum contracts remain plausible;
- tax is meaningful but not universal or irrelevant;
- hard-cap violations remain zero;
- teams can fill legal rosters;
- unsigned quality declines for understandable reasons;
- prior salary does not compound into uncontrolled inflation;
- the same rules produce comparable distributions across seeds.

The economy report should compare scenario arms and classify sensitivity as expected, neutral, or suspicious. It should not become gameplay state.

## 26. Implementation sequence

### Slice 0 — Contract and fixture boundaries

- Add domain types for money, economy, contracts, offers, demand, legality, evaluation, negotiation, and market fixtures.
- Add strict schemas and report envelopes.
- Add deterministic fixture builders using existing player/value fixtures.
- Add JSON round-trip tests.

### Slice 1 — Economy and legality

- Implement resolved economy presets and season growth.
- Implement salary curves, minimum/maximum checks, payroll, cap room, tax, hard-cap room, and the simple signing mechanisms.
- Add legality/affordability diagnostics and invariant tests.

### Slice 2 — Demand and single-offer evaluation

- Implement the calibrated UPV-to-salary mapping.
- Add prior-salary continuity and bounded scarcity inputs.
- Implement team interest separately.
- Implement offer utility, willingness updates, and lockout behavior.
- Build the Contract Inspector UI and worker-safe report export.

### Slice 3 — Re-signing and extension scenarios

- Derive projected free agency.
- Implement team-local re-signing.
- Implement the first simplified extension window.
- Persist/export active negotiations in fixtures and test phase resets.

### Slice 4 — Small market clearing

- Implement three rounds plus cleanup.
- Add competing offers, AI target selection, offer reservations, and redirects.
- Add market round reports and outlier fixtures.

### Slice 5 — Full market and economy calibration

- Run generated 30-team markets.
- Add batch workers, benchmark profiles, sensitivity reports, and multi-season economy runs.
- Tune standard settings only after invariant and distribution failures are visible.

### Slice 6 — League integration

- Promote typed contracts/offers into the `LeagueDocument`.
- Add contract commands and market phase commands to the worker protocol.
- Extend lifecycle phases, projections, events, save/reload, and import/export migrations.
- Add rookie-scale assignment after the draft and roster-completion gates.

Do not start with Slice 6. The current foundation league cannot safely host market state until the contract and legality contracts are proven independently.

## 27. Explicit deferred features

Defer unless calibration or the first complete loop proves they are necessary:

- First and second apron rules.
- Full NBA exception taxonomy.
- Complex sign-and-trades.
- Restricted free agency and matching rights.
- Every maximum-contract eligibility rule.
- Player/team options.
- Non-guaranteed contracts and partial guarantees.
- Stretch provisions and complex dead-money treatment.
- Contract incentives, bonuses, no-trade clauses, and trade kickers.
- Automatic counteroffers.
- Deep player personalities and narrative preferences.
- Persistent multi-year organizational AI.
- Full owner simulation and profitability model.
- Staff-market integration.
- Trade negotiations and trade value.
- AI-generated market narrative.
- Nearest-neighbor comparable search.
- Live online/cloud market services.

Trades may consume contract salary and surplus outputs later, but trade evaluation remains a separate system.

## 28. Risks and unresolved product decisions

### Risks

- The current UPV scale may not yet be stable enough for salary anchors. Demand calibration must preserve UPV version/config metadata and support re-running when UPV changes.
- The current V2 league schema is foundation-only. A rushed contract promotion could create a second incompatible save model.
- A soft cap with a single generic exception may still be too permissive or too restrictive. This must be tested against roster completion and user comprehension.
- Market scarcity can amplify generation problems. If position supply is implausible, the market should retain the fixture and report the upstream issue rather than compensating with extreme contracts.
- Simultaneous offers can create confusing cap reservations. The first version should reserve capacity conservatively and show it explicitly to AI diagnostics.
- Salary continuity can preserve bad historical contracts for too long. Prior salary must remain a bounded anchor, never a guaranteed floor.
- A player preference profile can become an accidental personality system. Keep the first profile small and market-specific.

### Decisions to resolve during calibration

1. What UPV bands map to depth, rotation, starter, and star salary ranges?
2. Should the future hard-cap line be a fixed headroom above the soft cap or a separate growth line?
3. What salary movement is plausible for a healthy player, aging player, injured player, and rookie-contract player?
4. How many simultaneous AI offers create useful competition without blocking the market?
5. What minimum legal roster size should cleanup guarantee?
6. How much should a near-market offer affect willingness?
7. Should low-tier players accept minimum offers automatically during cleanup or still evaluate team context?
8. When the three-season UPV horizon becomes available, how much should contract demand weight it against current form?

## Documentation updates

This design should become the contract-market implementation authority after review. The roadmap already calls for one Market & Rules Lab and a soft-cap-plus-tax economy, so it does not need a wholesale rewrite. The simulation architecture should receive only a link to this plan and the final command/event names once the first slice is approved. The existing V1 contract modules remain unchanged.
