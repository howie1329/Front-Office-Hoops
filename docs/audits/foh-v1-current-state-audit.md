# Front Office Hoops: Current-State Audit

> This is an audit of the v1 repository at the time of review. Product decisions made after the audit are captured in the [FOH v2 Product Brief](../v2/specs/foh-v2-product-brief.md) and [FOH v2 Roadmap](../v2/plans/foh-v2-roadmap.md).

**Audit date:** 2026-07-28  
**Scope:** repository behavior, shared data, simulation, lifecycle, persistence, UI, tests, and product documentation.  
**Evidence convention:** **Confirmed** means traced in code; **Documented** means stated in repository docs; **Intended** means described as future work; **Inference** is an architectural conclusion; **Recommendation** is proposed v2 direction.

## Executive finding

Front Office Hoops has a credible playable v1 and a useful testable pure simulation package. A targeted refactor can improve v1, but it is not a safe foundation for the complete v2 product because the canonical save model, lifecycle orchestration, value model, contract market, and UI information architecture are coupled around `LeagueRecord`. The recommended path is a parallel v2 inside the monorepo while v1 remains runnable.

The parts worth carrying forward are the pure seeded simulation utilities, correlated player-generation work, immutable-style command transformations, financial primitives that already have tests, and the existing dense-management visual language. The parts that should not be copied as v2 truth are the `LeagueRecord` snapshot contract, stored overall/potential semantics, single-master player valuation adapters, static fair-salary market, and split phase gates.

## 1. Repository map

| Area | Responsibility | Evidence | Assessment |
|---|---|---|---|
| `apps/web` | TanStack Start/Router application, routes, context, persistence wiring | `apps/web/src/routes`, `apps/web/src/hooks/useLeague.ts`, `apps/web/package.json` | Useful shell and route inventory; UI is coupled to v1 state shape |
| `packages/shared` | Domain types, constants, sample teams, rating weights | `packages/shared/src/leagueTypes.ts`, `playerTypes.ts`, `seasonTypes.ts`, `constants.ts` | Centralized but too broad; `LeagueRecord` is a god object |
| `packages/sim` | League creation, game simulation, development, contracts, trades, draft, commands | `packages/sim/src` | Strongest reusable asset; several foundational assumptions need v2 replacement |
| `packages/db` | Dexie IndexedDB repository | `packages/db/src/db.ts`, `leagueRepository.ts` | Adequate v1 adapter; not a portable league-document contract |
| `packages/ui` | Shared shadcn-derived components | `packages/ui/src` | Reuse visual primitives, not simulation semantics |
| `docs` | Architecture, product, data model, roadmap, contract notes | `docs/*.md` | Helpful intent record; several claims exceed current implementation |
| `plans` | Feature plans, including trade-evaluation rewrite | `plans/001-trade-evaluation-rewrite.md` | Useful design history, not authoritative implementation truth |

Current dependency direction is broadly `apps/web -> packages/{sim,shared,db,ui}` and `packages/sim -> packages/shared`. The simulation package does not import the web application. Persistence is injected at the web edge, but the persisted object is the complete simulation record, so the boundary is weaker than the package graph suggests.

## 2. Implemented feature inventory

### Confirmed implemented

- Mini-league and 30-team league creation through `packages/sim/src/createLeague.ts`, `generateTeams.ts`, and `playerGeneration/leagueRosterGeneration.ts`.
- Correlated player profiles with position factors, archetype biases, skill noise, potential, age, peak age, scouting fuzz, and archetype-specific roster slots in `playerGeneration/generatePlayerProfile.ts` and `rosterPipeline.ts`.
- Possession-based game simulation with pace, four segments, rotations, synergy, momentum, situational modifiers, overtime, and aggregate-to-player stat allocation in `gameSim/*`, `simulateTeamMatchup.ts`, and `allocatePlayerStats.ts`.
- Regular season, playoffs, standings, schedules, box scores, injuries, awards, history, and season archives through `advance/advanceSeason.ts`, `deriveStandings.ts`, `archiveSeason.ts`, `awards.ts`, and related modules.
- Development and aging with skill-specific deltas, age curves, injuries, performance drift, Monte Carlo potential refresh, retirement pressure, and development reports in `development/*` and `retirement.ts`.
- Contracts, salary cap, tax, minimums, max salaries, Bird-style rights, cap holds, exceptions, dead money, options, extensions, free agency, and three-attempt offer negotiations in `financials/*`, `contracts/*`, and `contracts/offerMarket.ts`.
- Two-team trades with player and pick assets, projected player value, contract asset value, rotation impact, roster balance, and strategy adjustments in `tradeEvaluation.ts`, `trades.ts`, and `shared/src/tradeTypes.ts`.
- Draft classes, draft order, AI picks, rookie contracts, and draft-class caching in `draft/*`.
- Team modes, spending profiles, ownership goals, staff, scouting, coaching, development, and AI cap cleanup in `financials/teamStrategy.ts`, `financials/spendingProfiles.ts`, `staff/*`, and owner modules.
- A central command switch and shared eligibility evaluation in `leagueCommands/applyLeagueCommand.ts`, `leagueCommands/types.ts`, and `phaseEligibility.ts`.
- Full-record IndexedDB persistence with debounced save in `packages/db/src/leagueRepository.ts` and `apps/web/src/hooks/useLeague.ts`.
- A substantial test suite: `packages/sim/tests` contains unit, integration, invariant, development, financial, draft, trade, and full-season coverage.

### Documented but incomplete or narrower than implied

The README and product documents describe a broad GM feature set, but the implementation is materially narrower in several areas:

| Area | Code reality | Source |
|---|---|---|
| Configurable league | 30-team production generation plus a fixed mini-league path; not a general arbitrary-team generator | `createLeague.ts`, `generateTeams.ts`, `leagueRosterGeneration.ts` |
| NBA-style cap | Cap, tax, Bird rights, exceptions, and dead money exist; aprons, restricted free agency, sign-and-trades, and meaningful pick protections do not | `financials/capMath.ts`, `birdRights.ts`, `shared/src/draftTypes.ts` |
| History | Log and season summaries exist; a universal authoritative event ledger does not | `leagueLog.ts`, `archiveSeason.ts`, `logTypes.ts` |
| Determinism | Game and many simulation paths use seeded RNG; contract offer IDs use `crypto.randomUUID()` and timestamps use wall-clock time | `contracts/offerMarket.ts`, `leagueLog.ts` |
| Tables | `@tanstack/react-table` is declared, but repository search found no `useReactTable`; several screens use bespoke sorting or raw tables | `apps/web/package.json`, `apps/web/src/components/league/SortableTable.tsx`, route components |
| Save portability | Full snapshots are stored in IndexedDB; export/import, migration, and save validation are future work | `packages/db/src/*`, `docs/data-model.md`, `docs/roadmap.md` |
| Narrative | No AI narrative layer or structured StoryPacket is implemented | `docs/roadmap.md`, `apps/web/src/routes` |

## 3. Architectural strengths

1. **Simulation/UI separation is directionally correct.** `packages/sim` is pure TypeScript and does not depend on React or IndexedDB. This makes it possible to run batch calibration outside the browser.
2. **Seeded RNG is already a design habit.** `createRng` and deterministic keys in game, draft, and development code provide a basis for reproducible experiments, even though IDs and metadata still introduce nondeterminism.
3. **The player generator is better than independent random ratings.** `generatePlayerProfile.ts` uses correlation factors, position factors, archetype biases, age, and target-overall adjustment. This is a valuable starting point for a latent-talent model.
4. **Commands are mostly explicit transformations.** `applyLeagueCommand.ts` centralizes state changes, which is better than route components mutating records directly. `phaseEligibility.ts` is also a useful attempt at a shared guard.
5. **There is meaningful simulation test coverage.** Five-season mini-league invariants pass, and financial, development, draft, trade, injury, and game modules have focused tests. The failed calibration assertion is valuable because it reveals where correctness and realism need to be separated.
6. **The current UI has a coherent management-console direction.** `apps/web/DESIGN.md` and `PRODUCT.md` establish compact tables, keyboard focus, semantic color, and decision-oriented density. That visual language can survive a v2 information-architecture redesign.

## 4. Highest-risk foundations

### 4.1 `LeagueRecord` is the persistence and application god object

**Confirmed:** `packages/shared/src/leagueTypes.ts` defines `LeagueRecord` as metadata, current season state, contracts, financials, draft assets, trades, offers, negotiations, logs, owners, awards, career snapshots, development records, staff, and retired staff. `useLeague.ts` saves the entire record after commands.

**Inference:** This creates broad invalidation, large writes, difficult migrations, accidental coupling, and no clear distinction between authoritative facts, derived state, and presentation data.

**Recommendation:** v2 should use a versioned league document with normalized entities, explicit derived projections, append-only events, and optional large-data sections. Do not make v1's type aliases the v2 schema.

### 4.2 The value model has multiple names but one dominant rating-derived truth

**Confirmed:** `packages/sim/src/playerValue/index.ts` keeps deprecated adapters such as `getPlayerWorth`, `calculatePlayerValue`, and `calculateContractValue`. They route through projected player value. `projectedValue.ts` starts from overall, adds performance drift, age, archetype market, and durability. `financials/ai/offers.ts`, `freeAgentScoring.ts`, and `draft/pickValues.ts` consume these values.

**Inference:** Trade value, contract salary, draft value, free-agent demand, and AI roster utility are not yet independent market concepts. `performanceDrift.ts` uses only a limited current-season production signal and expects production from overall.

**Recommendation:** define separate Talent, CurrentProduction, Projection, Reputation, MarketValue, SurplusValue, and TeamFit records before integrating AI decisions.

### 4.3 The contract market is a formula plus negotiation thresholds, not a clearing market

**Confirmed:** `getPlayerContractMarketValue` derives an expected salary from `getFairSalary`; `buildExternalFaOffer` and `buildReSignOffer` modify it by team mode, spending tolerance, and randomness. `evaluatePlayerContractOffer` scores salary relative to that expectation. Previous salary is available through `getPriorContractSalary`, but is not a principal market input. There is no explicit comparable-contract set, number of bidders, cap-room race, alternative free-agent pool, or market-clearing step.

**Inference:** FOH can produce implausible volatility similar to the Basketball GM experiment: the formula can move with rating/projection and random mode multipliers while contract continuity and market competition remain weak.

**Recommendation:** simulate the league market first, then generate explainable offers from demand, supply, cap room, comparables, prior salary, role, and player priorities.

### 4.4 Lifecycle control is distributed

**Confirmed:** `phaseEligibility.ts` defines actions and gates; `leagueCommands/types.ts` maps command names to actions; `applyLeagueCommand.ts` handles many workflows; `advance/advanceSeason.ts` also performs phase-dependent automatic processing; offseason modules own further transitions.

**Inference:** The model is an explicit phase enum wrapped in a partially implicit workflow. The `completeReSignings -> simAiReSignings` and `advanceToDraft -> proceedToDraft` mapping is evidence that the conceptual model and command vocabulary have drifted.

**Recommendation:** v2 should have a transition table/statechart, phase task status, serializable workflow state, and small commands. `advance` should plan and execute eligible automatic tasks rather than own the whole offseason.

### 4.5 Game output is aggregate-first with heuristic stat allocation

**Confirmed:** `buildScoringComponents.ts` generates team-level attempts, percentages, rebounds, assists, steals, blocks, and turnovers. `allocatePlayerStats.ts` distributes them using minutes, usage, ratings, archetype, position, physical traits, and a star-concentration exponent. The test suite currently fails a rebound calibration bound.

**Inference:** Team totals reconcile by construction, but player production may not emerge naturally from possessions, role, lineup, and matchup. The model is suitable for a prototype but requires calibration and likely a v2 stat-generation design before advanced economy and storytelling depend on it.

## 5. Subsystem classification

| Subsystem | Classification | Evidence and reason |
|---|---|---|
| Shared domain model | Rewrite | `LeagueRecord` and broad types mix canonical, derived, UI, and history concerns |
| Save schema | Rewrite | `SAVE_VERSION = 18`, full snapshot persistence, no migration/export contract |
| IndexedDB adapter | Extract/Refactor | `packages/db` is a useful local adapter once it persists v2 documents |
| League creation | Refactor | `createLeague.ts` is clear, but hardcodes base cap and roster-generation tiers |
| Player generation | Refactor, then partially rewrite | Correlation/archetype work is valuable; tier slots and target-overall assumptions need a latent model |
| Ratings | Rewrite | Stored overall/potential and 40–90 bounds are used as a universal truth |
| Game simulation | Rewrite behind preserved RNG/config primitives | Possession structure is useful; aggregate constants and allocation need calibration |
| Stat allocation | Rewrite | Heuristic allocation makes player stats downstream of team totals |
| Rotations | Refactor | `selectRotation.ts` is a useful fallback; user plans and lineup effects need first-class modeling |
| Development | Refactor | Skill-specific rates and deterministic Monte Carlo are good; potential semantics and causal pathways need separation |
| Injuries | Refactor | Seeded and skill/minute/age-aware, but a small table and basic risk model lack exposure, diagnosis, recurrence, and career-path calibration (`injuries.ts`) |
| Retirement | Refactor | Explainable pressure model exists; needs career distribution validation and player-specific reasons |
| Player value | Rewrite | Deprecated adapters converge on projected value (`playerValue/index.ts`) |
| Contract value | Rewrite | `createContract.ts` and `marketValue.ts` convert value to salary without a market-clearing model |
| Contract market | Rewrite | `offerMarket.ts` is featureful but not economically grounded; UUIDs also break strict reproducibility |
| Cap rules | Refactor, simplify | `capMath.ts` has tested primitives; rules should be profiles, not scattered constants, and advanced NBA details should be optional |
| Trades | Refactor | `tradeEvaluation.ts` is a thoughtful recent rewrite, but only two-sided proposals and null pick protections exist |
| AI team management | Rewrite | `teamStrategy.ts` supplies a mode and hysteresis, not a persistent multi-year organization plan |
| Draft generation | Refactor | Class strength, position mix, and prospect fuzz exist; no lottery, international/developmental variation, or true scouting uncertainty |
| Draft AI | Rewrite | `pickValues.ts` ranks prospects through player worth and limited strategy multipliers |
| Free agency | Rewrite market layer; keep transaction primitives | `freeAgency.ts` correctly validates/signs players; demand and competition need replacement |
| Staff | Keep/Refactor | Staff contracts and roles are useful; causal staff effects need calibration |
| Phase model | Rewrite | Explicit enum is reusable, distributed transition ownership is not |
| Command system | Extract/Refactor | Central command boundary is good; commands need smaller responsibilities and replayable results |
| Event history | Rewrite | `logTypes.ts` is narrow, loose, and not an authoritative event ledger |
| UI shell | Extract/Refactor | Routes, design language, and shadcn primitives are useful |
| Tables | Rewrite shared table layer | Custom `SortableTable` and raw tables should converge on TanStack Table with URL state |
| Existing screens | Refactor selectively | Keep useful workflows; redesign around IA, phase actions, comparison, and responsive table patterns |
| Sim Lab / Season Lab | Rewrite as calibration platform | `sim-lab.tsx` and `season-lab.tsx` are interactive demos, not batch benchmark tools |
| AI narrative | Defer, then build as isolated consumer | No factual authority should be delegated to the narrative layer |

## 6. Simulation-specific findings

### Ratings and player identity

**Confirmed:** `deriveOverall` in `packages/sim/src/playerRatings.ts` is a weighted average of 11 skills and clamps to 40–90. `deriveUsage` is rank/overall-based. `emptySkillRatings` defaults to 50. `generatePlayerProfile.ts` adds correlations but ultimately adjusts skills toward a target overall.

**Recommendation:** use a latent player profile with separate physical, skill, decision, role, durability, and development dimensions. Store true attributes without storing a universal overall. Derive role-specific evaluation views. A useful default visible scale is replacement 40, average pro 50, rotation 54–58, good starter 60–67, All-Star 68–76, MVP 77–84, generational 85–90. Ratings above 70 should be uncommon, above 80 rare, and above 90 exceptional or unavailable in the default fictional universe. Public scouting should be uncertain estimates, not true values.

### Generation

The best v1 ingredient is `drawCorrelationFactors` plus position/archetype bias. The weakness is generation being roster-tier-first: `rosterPipeline.ts` chooses fixed archetype slots, target overall offsets, age bands, and tier counts. This can create coherent rosters but cannot naturally express class-wide talent, scarcity, generational prospects, busts, or late bloomers.

V2 should compare archetype-first, latent-talent, correlated multivariate, role-first, physical-first, and historical-sampling prototypes. The recommended model is hybrid: physical profile and latent talent first; skill clusters and role identity second; public scouting and draft production third.

### Development and aging

**Confirmed:** `computeBaseSkillDeltas.ts` has skill-specific growth/decline, age factors, potential headroom, archetype modifiers, and random variance. `monteCarloPotential.ts` runs 24 simulations to age 32 and returns a 75th percentile. `progressPlayer.ts` also applies performance drift, injury history, culture, coaching, and development context.

**Inference:** the model is more nuanced than a single overall delta, but stored `potential` is simultaneously a player field, a scouting-facing number, and a forecast. V2 should split true development trajectory, team estimate, and scouting report. Skill aging should be attached to traits: athleticism declines earlier; shooting, passing, and defensive recognition can improve later; injury can alter the trajectory rather than simply subtracting overall.

### Injuries and retirement

**Confirmed:** `injuries.ts` uses a base daily risk, minutes above 28, age above 30, stamina below 60, three severity bands, and a 15–45 game major-injury range. `retirement.ts` uses age, falloff, minutes, production, major injuries, and randomness.

**Recommendation:** preserve the explainable risk interface but calibrate injury incidence, games lost, recurrence, and career length against benchmark profiles. Record causal injury events and distinguish availability risk from talent decline.

## 7. Product and UX risks

- The route set is broad but lacks an explicit GM action center, player comparison, cap-sheet workflow, contract-detail view, incoming offers, story/news feed, settings, and import/export screens.
- Dense screens use mixed table implementations. `SortableTable.tsx`, route-local sorting, and raw shadcn tables make consistent filtering, sorting, column visibility, saved views, keyboard navigation, and mobile behavior expensive.
- Phase awareness is present in context and guards but not yet a coherent product model visible across every screen.
- `LeagueRecord` loading means UI screens indirectly depend on every save concern, making partial loading and large historical leagues difficult.
- Empty, error, loading, and recovery states are not represented as a deliberate screen system.

## 8. Missing or under-modeled systems

1. Canonical versioned league document, schema validation, migrations, import, export, and corruption recovery.
2. Authoritative event ledger with stable IDs, structured payloads, importance, tags, and source command.
3. Configurable typed simulation presets and calibration reports.
4. Distinct true talent, scouting, production, projection, reputation, market, surplus, and team-fit concepts.
5. Market-clearing free agency with comparables, supply/demand, cap-space competition, and contract explanations.
6. Explicit league rules profiles, especially a clear boundary between default rules and advanced NBA-inspired rules.
7. Lottery, protected picks, undrafted-player behavior, international/developmental prospect variation, and uncertainty-forward scouting.
8. Persistent AI organization plans spanning several seasons.
9. Career and historical records with immutable archival semantics.
10. StoryPacket generation input that separates facts from narrative text.
11. Batch labs with seeded reproducibility, downloadable reports, benchmark ranges, and distribution alerts.
12. Browser E2E, performance budgets, file-size budgets, replay diagnostics, and command-level observability.

## 9. Testing and observability assessment

The current suite proves many local invariants and supports a five-season mini-league run, but it does not yet prove realistic distributions. On the audit date:

- `npm run typecheck` passed for all five workspaces.
- `npm run test` ran 255 tests: 254 passed and one failed in `packages/sim/tests/gameSim/gameSim.test.ts`; mean rebounds were 54.149 versus an asserted maximum of 54.
- `packages/sim/tests/leagueInvariants.test.ts` passed five deterministic mini-league seasons.

The missing assertions include points reconciliation from player lines to team lines, wins/loss balance, payroll reconciliation, exact active-player ownership, pick ownership uniqueness after trades, no signed player remaining in free agency, minimum eligible players before games, immutable archived history, and phase transition reachability. V2 should add invariant checks after every command and statistical suites over 100 games, 100 seasons, 20 ten-year leagues, and 10 thirty-year leagues.

## 10. Final recommendation

FOH should evolve through targeted v1 maintenance and a parallel v2. Extract only primitives that can be contract-tested without sharing unstable domain assumptions: seeded RNG, generic IDs, money arithmetic, schema validation infrastructure, table primitives, and perhaps event serialization. Keep v1's `LeagueRecord`, valuation, economy, lifecycle, and UI routes isolated. Reuse ideas and selected algorithms after benchmark validation, not by sharing every existing function.

The current repository is valuable enough to carry forward, but not coherent enough to serve as the v2 canonical model. The rewrite boundary should be the simulation/domain/save contract, not the entire repository.
