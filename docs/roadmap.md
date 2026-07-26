# Front Office Hoops — Roadmap

**Roadmap horizon:** July 2026 onward<br>
**Current product stage:** Early local-first prototype (`0.0.1`)<br>
**Current save schema:** `18`

This roadmap separates the playable foundation that exists today from the work required to make it a dependable product and the longer-term features that can deepen the franchise experience. It is directional rather than a promise of dates; priorities should move when playtesting or simulation audits expose a more important problem.

## Product strategy

The order matters:

1. Make the local league loop coherent, durable, and easy to understand.
2. Make the core workflows feel production-quality on desktop and mobile.
3. Deepen franchise identity and long-term consequences.
4. Add cloud and AI capabilities only after the local simulation and data contracts are stable.

The engine remains authoritative for stats, outcomes, contracts, and league state. Future services should extend the experience without making them prerequisites for single-player play.

## Shipped foundation

| Area | Current state | Evidence in the repository |
| --- | --- | --- |
| League setup | Implemented | Six-team mini leagues, 30-team leagues, team selection, multiple local saves |
| Regular season | Implemented | Seeded day, week, and season simulation; schedule, standings, injuries, and stats |
| Games and playoffs | Implemented | Aggregate game simulation, box scores, overtime, playoff brackets, best-of-3 and best-of-7 formats |
| Roster management | Implemented | Roster views, player detail, contracts, extensions, releases, injuries, career history |
| Financial systems | Implemented | Cap and tax math, dead money, exceptions, Bird rights, options, payroll, team strategy |
| Transactions | Implemented | Player and pick trades, trade exceptions, legality checks, valuation, AI offers, trade history |
| Offseason | Implemented | Staff, re-signing, draft, free agency, contract markets, next-season rollover |
| Staff | Implemented | Hiring, firing, extensions, budgets, employment lifecycle, philosophy and development effects |
| Player development | Implemented | Potential forecasts, aging, role/minutes, mentorship, staff, culture, injuries, retirement |
| Scouting | Implemented in player-facing views | Team scouting quality affects displayed ratings and player information precision |
| Franchise state | Engine support | Owners, owner goals, team strategy, staff budgets, awards, logs, and long-term snapshots |
| Developer tools | Implemented | `/sim-lab`, `/season-lab`, simulation unit tests, database tests |

## Near-term roadmap

### Now — Stabilize the local-first core loop

Goal: make a new save reliable from league creation through a second season.

- Add save export/import for `LeagueRecord` with validation and a clear user-facing format.
- Introduce a save migration strategy before the schema changes again; document recovery behavior for invalid or incompatible saves.
- Add browser-level coverage for league creation, simulation, playoffs, offseason, trades, and save switching.
- Audit phase completion, empty, error, and interrupted-save states across all major routes.
- Improve the first-session path so a new player understands what to do next without reading project documentation.
- Continue simulation audits around financial AI, scouting uncertainty, prospect generation, player value, and multi-season balance.

### Next — Productize the browser experience

Goal: make the implemented game feel dependable and comfortable to use repeatedly.

- Finish responsive behavior for roster, player detail, cap sheet, staff, draft, free agency, and trade workflows.
- Improve draft and free-agency presentation so the market, uncertainty, and decision consequences are easy to compare.
- Surface the currently modeled owner goals and team direction in the UI where they can guide decisions.
- Add settings and preferences for simulation pace, display density, reduced motion, and save management behavior.
- Complete PWA offline-shell and install support; distinguish offline play from future cloud features.
- Establish release checks for build, typecheck, lint, simulation tests, database tests, and critical browser journeys.

### Later — Deepen franchise identity

Goal: turn a capable league simulator into a more memorable multi-season franchise experience.

- Build a structured league-event model for championships, failed moves, player demands, owner changes, financial pressure, and other consequential moments.
- Expand owner goals from engine data into visible pressure, trust, patience, and strategic consequences.
- Add richer prospect reports, draft-class identity, player development explanations, and historical comparisons.
- Improve trade and free-agency reasoning so AI decisions expose concise, credible explanations.
- Add optional generated recaps, rumors, reports, and press interactions from structured simulation events.
- Add deeper team strategy and tactical controls only where they create meaningful decisions without slowing the core loop.

### Future — Optional hosted product capabilities

These capabilities should follow, rather than precede, a stable local-first experience:

- Convex-backed accounts and encrypted cloud save backups.
- Cross-device save sync and conflict handling.
- Optional spectator or shared-league experiences.
- Server-side orchestration for AI narrative so provider credentials never reach the browser.
- Aggregate product analytics and diagnostics with clear privacy boundaries.

## Explicitly out of scope for the current horizon

- Real NBA teams, logos, or licensed assets.
- Real-time head-to-head multiplayer gameplay.
- Server-authoritative simulation.
- Full CBA fidelity or pixel-perfect parity with Basketball GM.
- AI text that changes engine outcomes or becomes required to understand league truth.

## Quality gates for the next milestone

The local-first product is ready to move beyond prototype hardening when:

- A new player can create a league, choose a team, simulate a season, complete the offseason, and start season two.
- A save can be exported, re-imported, validated, and recovered after a browser restart.
- Critical league journeys have automated browser coverage.
- The main decision surfaces work on a phone and preserve keyboard/focus accessibility.
- Simulation regressions are reproducible from a seed and covered by focused tests.
- The docs, save version, and release checklist describe the same product state.

## Versioning notes

- **App version:** `0.0.1`
- **Save version:** `18` (`SAVE_VERSION` in `packages/shared/src/leagueTypes.ts`)
- **Migration status:** no save migration layer yet

Until migrations exist, breaking schema changes require clearing local IndexedDB saves during development. Any future persisted-data change should update `SAVE_VERSION`, add migration coverage, and update [Data Model](./data-model.md) in the same change.
