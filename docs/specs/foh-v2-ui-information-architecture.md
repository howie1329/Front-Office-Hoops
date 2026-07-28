# Front Office Hoops v2 UI Information Architecture

## Navigation model

Use a persistent league shell with:

- global league switcher and save status;
- current phase, date, deadline, and next required action;
- primary navigation: Home, Team, League, Transactions, Draft, Staff, History, Settings;
- contextual command bar for the active phase;
- universal search for players, teams, contracts, games, and events.

The home screen is an action center, not a decorative dashboard. It should answer: what changed, what needs a decision, what is approaching, and what is the likely consequence.

## Complete screen inventory

### Home and lifecycle

- League dashboard / GM inbox: urgent decisions, deadlines, injuries, offers, owner goals, recent events, next recommended action.
- Calendar: season timeline, games, deadlines, phase tasks, automatic league activity.
- Phase center: explicit user tasks, completed tasks, blocked tasks, and advance controls.

### League views

- Standings: record, point differential, efficiency, streak, playoff position, sortable and filterable.
- League stats: players and teams with per-game, per-minute, possession-adjusted, advanced, and availability views.
- Team stats: lineup, offense, defense, shot profile, role production, and trend comparisons.
- Playoffs: bracket, series state, injuries, rotation changes, and game links.
- Transactions: searchable event stream with filters for type, team, player, season, and importance.
- League history: season archive, champions, dynasties, awards, records, rule changes, and notable events.
- Records: career, season, team, playoff, and franchise records.
- News/story feed: fact-backed events and optional generated narrative.

### Team management

- Team overview: roster health, rotation, strategy, cap position, schedule, goals, and recent decisions.
- Roster: active, injured, two-way/developmental if enabled, contract, role, scouting, and value columns.
- Rotation: lineup units, minutes, roles, matchup plan, auto-rotation, and validation.
- Player profile: true/current/scouted views according to permissions, résumé, contract, development, health, fit, timeline, and events.
- Player comparison: side-by-side stats, ratings ranges, projection, contract, market, and fit.
- Cap sheet: payroll by year, guarantees, options, holds, exceptions, dead money, tax/apron state, and actions.
- Contract detail: terms, guarantees, options, rights, comparables, market explanation, and scenario outcomes.
- Trade center: roster search, pick assets, salary matching, proposals, evaluation breakdown, and incoming offers.

### Offseason

- Re-signing: expiring players, rights, market quotes, priorities, offer attempts, and explanations.
- Free agency: market board, filters, demand, bidders, role, cap impact, and offer comparison.
- Draft board: public scouting ranges, consensus, team board, needs, workouts/interviews, risk, floor/ceiling, and pick value.
- Prospect profile: measurements, production, scouting uncertainty, role projection, comparisons, and development risk.
- Staff: staff roster, contracts, specialties, effect evidence, market, and hiring.

### Configuration and tools

- League settings: teams, schedule, playoffs, rules preset, difficulty, narrative, and data retention.
- Simulation sliders: safe grouped presets and advanced developer controls with reset/version labels.
- Save import/export: profiles, data selection, validation preview, migration report, and backup.
- Developer labs: Game, Season, Career, Player Generation, Draft Class, Development, Injury, Contract Market, Trade Market, League Economy, and AI Team-Building.

## Phase-specific action model

Every screen receives a phase context with:

```text
available actions
required actions
deadlines
automatic actions
blocked reasons
next phase
```

The UI should not infer lifecycle rules from route names or hidden booleans. The phase center and action center consume the same command metadata as the simulation engine. Parallel tasks, such as staff hiring and roster planning, show independent completion status.

## Table strategy

Adopt TanStack Table from the beginning of v2 for every data-heavy screen. Provide one accessible wrapper supporting:

- typed columns and cell renderers;
- sorting, filtering, grouping, pagination/virtualization;
- column visibility and density;
- pinned identity columns;
- URL-serializable state;
- saved views;
- keyboard navigation and row actions;
- responsive priority columns;
- CSV/JSON export for the visible view.

The current repository already declares `@tanstack/react-table` but uses custom `SortableTable` and raw tables. v2 should avoid a second bespoke table ecosystem.

## Desktop and mobile principles

- Desktop prioritizes comparison, multi-panel context, and keyboard actions.
- Mobile prioritizes one decision at a time, sticky identity/action regions, cards for summaries, and horizontally scrollable tables only when comparison is essential.
- Never hide a deadline or blocked reason on mobile.
- Preserve filters and scroll position after a command.
- Use skeleton, empty, error, and recoverable import states intentionally.
- Keep semantic color limited to state meaning; use text and icons for accessibility.

## Screen-by-screen requirements

| Screen | Primary decision | Required data | Key interaction |
|---|---|---|---|
| Dashboard | What needs attention? | tasks, deadlines, events, health, cap | open action, snooze, inspect explanation |
| Calendar | What is next? | dates, games, phase tasks | advance, jump to event, view deadline |
| Roster | Who belongs on the team? | players, roles, contracts, health | filter, compare, set role, open profile |
| Rotation | How will we play? | units, minutes, fit, health | drag/reorder, auto-fill, validate |
| Player profile | Is this player valuable now/later? | résumé, projection, scouting, contract | compare, offer, trade, scout |
| Cap sheet | What can we afford? | salaries, holds, rights, exceptions | scenario toggle, waive, extend |
| Trade center | Does this improve our plan? | assets, fit, salary, picks, strategy | build proposal, explain, submit |
| Free agency | Where should money go? | market board, bidders, needs, alternatives | watch, offer, compare |
| Draft board | Who should we select? | scouting ranges, board, needs, picks | rank, filter, select, trade pick |
| History | What happened? | events, archives, records | filter, timeline, StoryPacket |
| Settings/export | How is this league configured? | rules, config, schema, backups | change preset, validate, export |
| Labs | Is the model believable? | seeds, batches, benchmarks | run, compare, download report |

## Reusable management patterns

- `DecisionHeader`: phase, deadline, primary action, blocked reason.
- `EntityTable`: TanStack-backed table with saved views and URL state.
- `ComparisonDrawer`: compare selected players/contracts/teams without losing context.
- `ExplanationPanel`: named factors, confidence, alternatives, and source events.
- `ScenarioToggle`: current state versus proposed action.
- `Timeline`: events grouped by season/day/importance.
- `CommandConfirm`: consequence summary and reversible/irreversible warning.
- `ImportReport`: schema result, migration steps, dropped optional data, backup action.
- `ResponsiveDetail`: desktop side panel, mobile full-screen detail.

## Design process before implementation

For each screen, produce a one-page spec with user goal, primary action, required facts, command outputs, empty/loading/error states, desktop layout, mobile layout, table columns, keyboard flow, and links to related entities. Validate the spec against a seeded golden league before writing production components.
