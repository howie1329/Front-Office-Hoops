# Front Office Hoops v2 Roadmap

**Purpose:** sequenced development plan for the first rewrite.  
**Status:** Phase 0/1 foundations and the Phase 2 calibration workbenches are implemented in slices; calibration acceptance and authoritative league integration remain incomplete. The latest active implementation area is Market & Rules.
**Principle:** build the smallest complete vertical slice only after the contracts and calibration boundaries are clear.

The [V2 lab strategy](./foh-v2-lab-strategy.md) defines the permanent lab surfaces, headless batch harnesses, fixture boundaries, and promotion rules for this roadmap. This roadmap remains the delivery sequence; it does not require a separate visual route for every simulation subsystem.
The [V2 current state](../current-state.md) is the implementation-status source of truth.

## Current execution position — August 1, 2026

Completed or substantially complete:

- Phase 0 product, scope, and contract decisions.
- Phase 1 V2 document, schema, repository, command, and worker foundation.
- Player-generation and ratings calibration, including correlated profiles, development fields, identities, population presets, league statuses, and deterministic population assembly.
- Initial player-universe groundwork: 450 rostered players, 100 free agents, 90 draft prospects, and deterministic 30-team roster construction.
- Initial Game & Matchup engine and worker-backed lab, including rotations, availability, possession simulation, reconciliation, and seeded batch reports.
- Initial Production & Value season runner, production aggregation, universal player value, and worker-backed lab.
- Initial Career Cohort harness with development, decline, retirement, matched runs, settings, reports, and explorer UI.
- Initial Market & Rules implementation with economy, contract demand, offer utility, free-agency simulation, target boards, activity reporting, roster capacity, and cleanup behavior.

The project is currently in Phase 2 calibration. Existing workbenches are
available for evidence, but their standard gameplay behavior is not accepted
until benchmark ranges and promotion gates pass. The immediate sequence is:

1. Market & Rules calibration and multi-season economy evidence.
2. Cross-lab acceptance review for game, production/value, career, and population distributions.
3. League-creation adapter and the first authoritative lifecycle slice.

The full Phase 3 league shell follows those gates. The current lab routes are
fixture and calibration workbenches, not the authoritative league-creation
flow. V1 remains runnable while V2 progresses.

## v2 outcome

Ship a browser-hosted, local-first, single-player front-office simulation in which a user can:

1. Configure and generate a complete fictional 30-team league.
2. Select a team and understand its owner, staff, roster, cap, and outlook.
3. Set rotations and simulate to games, dates, deadlines, playoffs, and offseason.
4. Manage staff, contracts, trades, draft picks, free agency, injuries, and roster legality.
5. See box scores, player values, scouting ranges, production, events, history, and owner goals.
6. Complete multiple seasons with baseline AI teams.
7. Save locally, reload safely, and export/import the league as JSON.

## Delivery rules

- v1 remains runnable throughout development.
- No v2 gameplay feature is accepted without a command, schema, invariant, and user-facing failure state.
- Standard settings must work without advanced tuning.
- Advanced settings are available at league creation but bounded and documented.
- Experiments produce benchmark reports before model assumptions become product behavior. A benchmark report is not authoritative gameplay state until its production module and invariants are promoted.
- Worker, snapshot, event, and repository boundaries are established before broad UI implementation.
- Headless batch harnesses are preferred for distributional questions; visual labs are reserved for scenario setup, outliers, comparisons, and explanation inspection.
- Multi-year AI, morale, advanced CBA, rich scouting, narrative, and cloud services remain later phases.

## Phase 0 — Product and technical freeze

**Goal:** turn the interview decisions into executable contracts.

Deliverables:

- Approved v2 product brief.
- V2 roadmap and coexistence plan.
- Initial `LeagueDocument` schema outline.
- Command/event/diagnostic vocabulary.
- Standard settings catalog and advanced-setting categories.
- First-v2 non-goals recorded in the repository.
- Golden v1 saves selected for comparison/import fixtures.

Exit criteria:

- Team, phase, save, randomness, settings, and first-v2 scope decisions are explicit.
- No open product decision blocks the foundation prototypes.

## Phase 1 — Canonical document and worker foundation

**Goal:** prove the v2 application can create, validate, run, save, reload, and export a document before full simulation complexity exists.

Work:

- Create `packages/domain-v2`.
- Create `packages/league-schema`.
- Define `LeagueDocument`, `SimulationConfig`, `LeagueCommand`, `LeagueEvent`, `DiagnosticEntry`, and validation errors.
- Define the Web Worker request/result protocol.
- Define normal runtime randomness and deterministic lab randomness.
- Add Dexie repository interface and v2 document storage.
- Implement JSON full export/import round trip.
- Add schema version and migration harness.
- Build a minimal TanStack Start v2 shell that runs a fixture through the worker.

Exit criteria:

- A fixture loads from JSON, runs a no-op/advance command, saves to IndexedDB, reloads, and exports unchanged facts.
- Worker failure and interrupted-save paths have tests.

## Phase 2 — Calibration laboratories and core model experiments

**Goal:** choose model behavior before binding it to a polished product UI.

Priority experiments:

1. Ratings distribution and overall scale.
2. Correlated player-generation comparison.
3. Game simulation calibration.
4. Simple production composite and visible universal player value.
5. Contract/free-agency market behavior.
6. Development, injury, and retirement cohorts.
7. Baseline AI legal-action behavior.

Work:

- Create the small `packages/calibration` batch/report/fixture toolkit. Keep canonical scenario types in `domain-v2` and JSON validation/migrations in `league-schema`.
- Add explicit seeded batch runs and downloadable reports.
- Add benchmark profiles for games, players, careers, salaries, injuries, and competition.
- Keep model outputs separate from the UI until reports pass.
- Build the Game & Matchup Lab first, then the Season Production & Value Lab. Combine development, aging, injury, and retirement in a cohort harness; do not create separate permanent routes for each.
- Combine individual contract valuation, acceptance, market clearing, and simple finance inspection in one Market & Rules Lab while keeping legality, affordability, demand, and acceptance as separate production results.

Exit criteria:

- Standard defaults have accepted ranges for game, player, development, injury, and salary behavior.
- The value model has a visible breakdown and stable behavior across generated leagues.
- Failed seeds and outliers are retained as fixtures.
- The game, production, and value modules can consume the same typed fixtures that the future league loop will consume.

## Phase 3 — League creation and player universe

**Goal:** generate a coherent complete league before team selection.

Work:

- Promote the validated initial universe into `LeagueDocument` through a league-creation adapter; the current Team Assembly route remains a fixture generator until this exists.
- Fixed 30-team parody-name universe and NBA-like locations.
- Market-size categories.
- Owner personality and goal generation.
- Four staff roles: head coach, offensive coach, defensive coach, head scout.
- Correlated player generation from latent profiles.
- Permanent traits capped at approximately three.
- Primary/secondary positions.
- Derived primary/secondary archetypes.
- Initial contracts, cap state, draft assets, and initial draft class.
- Standard and advanced league-creation settings.
- Team-preview selection flow.

Exit criteria:

- Every generated league has legal teams, coherent players, staff, owners, contracts, and draft assets.
- The user can choose a team after inspecting the generated universe.

## Phase 4 — In-season vertical slice

**Goal:** deliver the first complete playable season segment.

Work:

- Preseason and owner-goals phase.
- Starters, depth order, and target minutes.
- Head-coach philosophy and rotation tendency.
- Head-scout fog-of-war precision.
- Simulate-to-next-game/date/deadline controls.
- Web Worker progress and recovery.
- The same production game engine calibrated by the Game & Matchup Lab.
- Final box scores and player game logs.
- Standings, injuries, game events, and phase gates.
- Current snapshot and event history saves.

Exit criteria:

- A user can create a league, select a team, set a rotation, simulate games, inspect box scores, recover from reload, and reach the trade deadline.
- Game and accounting invariants pass.

## Phase 5 — First-v2 front-office systems

**Goal:** make the user responsible for the roster and staff decisions.

Work:

- Soft cap, tax, minimum/maximum salaries, growth, contracts, options, and dead money.
- Simple trade proposals using universal player value plus contract/team-fit modifiers.
- Three-stage free agency: AI offers first, user offers second, player accepts/waits.
- Multi-round contract negotiations.
- Re-signing and extensions without role/security promises.
- Staff hiring, firing, and contracts.
- Roster cuts, legal roster gates, and contract cleanup.
- Event explanations for contracts, trades, signings, and blocked actions.

Exit criteria:

- The user can complete a legal season and offseason without manual repair.
- Contract outcomes have continuity and explainable market factors.
- Tax/payroll calculations reconcile.

## Phase 6 — Draft, playoffs, history, and full-season loop

**Goal:** complete the minimum viable multi-season game.

Work:

- Fixed lottery behavior.
- One-day, two-round draft.
- Mock draft projections and scouting ranges.
- Manual user picks and simulate-to-next/user/end controls.
- Baseline AI picks using best available plus small need/mode adjustments.
- Playoffs and season evaluation.
- Three owner goals, strikes, and job security.
- Season archives, records, player/team timelines, and retained box scores.
- Next-season generation, development, aging, retirement, and new draft class, using the Career Cohort findings and the same production transitions used by the League Loop Lab.

Exit criteria:

- The minimum playable loop reaches at least ten seasons in batch runs.
- Save/export/import works at every major phase.
- History remains internally consistent.

## Phase 7 — Management UI and production hardening

**Goal:** make the v2 loop usable and trustworthy.

Work:

- Dashboard/action center.
- Calendar and phase center.
- Roster, player, comparison, rotation, cap, trade, incoming offers, free agency, draft, staff, owner goals, history, save screens.
- TanStack Table wrapper and saved views.
- Responsive desktop/mobile behavior.
- Empty/loading/error/import-repair states.
- Accessibility and keyboard workflows.
- Browser E2E tests.
- Performance, memory, and file-size budgets.
- Standard/advanced settings UI and exact-value/debug toggles.

Exit criteria:

- Critical workflows pass browser tests at desktop and mobile widths.
- Long simulations do not freeze the UI.
- New users can understand the next action and why a blocked action is blocked.

## Phase 8 — Expansion after first-v2 stability

Only begin these after the first-v2 readiness bar passes:

- Multi-year organizational AI.
- Persistent team timelines and draft/trade plans.
- Morale, role promises, playing-time security, and trait evolution.
- Rich draft scouting with reports, interviews, and workouts.
- Advanced cap/apron rules, sign-and-trades, and complex pick protections.
- More detailed free-agent preferences and market narratives.
- AI-generated StoryPackets and optional narrative UI.
- Optional accounts, cloud saves, and cross-device sync.
- Optional server-side batch simulation or hosted services.

## Recommended implementation order for immediate development

The initial implementation slices are now complete or underway as follows:

1. **V2 document/worker/repository fixture:** complete.
2. **Population & Roster workbench:** implemented as a deterministic upstream fixture source; distributional acceptance and authoritative league embedding remain open.
3. **Game & Matchup, Production & Value, and Career Cohort:** initial worker-backed slices implemented; calibration acceptance remains open.
4. **Market & Rules:** active implementation and calibration; league integration remains open.
5. **Authoritative league shell:** next product gate after cross-lab acceptance.

Do not build the full league shell until the game, production/value, career,
population, and market calibration boundaries have accepted ranges and a
validated league-creation adapter exists. A thin developer fixture may be used
by experiments, but authoritative league creation remains a Phase 3 deliverable.

Do not begin with the full dashboard, advanced cap, AI narrative, or polished transaction screens. Their contracts depend on the calibrated model.

## Replacement gate

V2 can replace v1 only after it supports the complete first-v2 loop, passes multi-season calibration, preserves JSON portability, has no critical save/lifecycle regressions, and provides enough UI coverage for a user to manage a franchise without developer intervention.
