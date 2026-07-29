# Front Office Hoops v2 UI Information Architecture

## Product shell

V2 uses TanStack Start with a persistent league shell. The shell exposes:

- League name and active team.
- Save status and last committed day.
- Current season, phase, date, and deadline.
- Primary action and blocked reason.
- Navigation to Home, Team, League, Transactions, Draft, Staff, History, Settings, and Developer Labs.
- Universal search for players, teams, contracts, games, and events.

The dashboard is an action center, not a news feed. It answers what changed, what requires a decision, what is approaching, and why the next action is blocked or available.

## First-v2 screen inventory

### League and lifecycle

- **League creation:** standard settings, advanced settings, validation, generation progress.
- **Team selection:** generated team previews before user selection.
- **League dashboard:** goals, job-security strikes, injuries, offers, deadlines, recent events, next action.
- **Calendar:** games, deadlines, phase tasks, simulate-to controls.
- **Phase center:** in-season/offseason subphase, required tasks, completed tasks, blockers, advance action.
- **Standings:** record, point differential, efficiency, streak, playoff position.
- **League stats:** player/team box-score stats, production composite, overall, percentile, rank.
- **Transactions:** event history filtered by type, team, player, season, and importance.
- **History:** season archives, champions, awards, records, owner outcomes, milestones.

### Team management

- **Team overview:** roster health, rotation, coach philosophies, cap position, owner goals, staff, schedule.
- **Roster:** primary/secondary positions, overall, skills, traits, player value, production, contract, health.
- **Rotation:** starting five, depth order, target minutes, eligibility warnings, automatic rotation.
- **Player profile:** skills, overall, percentile/rank, traits, positions, archetypes, production, development, health, contract, value, events.
- **Player comparison:** side-by-side overall, skills, production, value, contract, health, and projections.
- **Cap sheet:** cap, tax, payroll, guarantees, options, holds, dead money, exceptions, and future seasons.
- **Contract detail:** terms, salary, guarantees, options, market range, player-value inputs, and negotiation state.
- **Trade center:** proposal builder, universal player value, contract adjustments, team-fit modifiers, picks, and explanations.
- **Incoming offers:** offers from other teams with terms, assets, and evaluation breakdown.

### Staff and offseason

- **Staff:** head coach, offensive coach, defensive coach, head scout, contracts, traits, philosophies, effects, hiring/firing.
- **Owner goals:** three goals—easy, medium, hard—progress, strikes, owner personality, and job-security explanation.
- **Re-signing:** expiring players, market range, contract history, offers, rounds, and responses.
- **Free agency:** three-stage market board.
- **Draft board:** public scouting ranges, potential ranges, mock draft, team needs, player value, floor/ceiling, and risk.
- **Draft day:** start draft, next pick, user’s next pick, end draft, current selection, remaining prospects, and pick ownership.
- **Prospect profile:** public ranges, measurements, production, archetypes, position eligibility, mock projection, and uncertainty.

### Data and developer tools

- **Save manager:** local saves, rename, duplicate, delete, backup, import, export, migration preview.
- **Settings:** standard preset, advanced league-creation settings, exact-value/debug toggles, and resolved configuration.
- **Developer Labs:** Game, Season, Career, Player Generation, Draft Class, Development, Injury, Contract Market, Trade Market, League Economy, and Baseline AI.

AI narrative and hosted account screens are later features, not first-v2 requirements.

## Simulation controls

The primary simulation controls are:

- Simulate to next game.
- Simulate to selected day.
- Simulate to next deadline.
- Simulate to playoffs.
- Simulate to offseason.

The UI shows worker progress, current day, games completed, events generated, and cancel/recovery behavior where safe. It does not provide a standalone “simulate game” control. Users open a completed game from the schedule, calendar, history, or event timeline to inspect its final box score.

## Phase-specific action model

Every route receives the same phase context:

```text
current top-level mode
current subphase
available actions
required actions
deadlines
automatic AI actions
blocked reasons
next phase
```

The UI must not infer lifecycle rules from route names or local booleans. It consumes command metadata and validation results from the simulation worker.

## Free-agency interaction

Each of the three fixed stages uses this visible sequence:

```text
AI offers appear
  → user reviews current offers
  → user submits offers
  → player accepts best internal contract utility or waits
  → stage results are saved and events are emitted
```

Offer cards show salary, years, guarantees, tax/cap effect, prior salary, market range, and interest label. They do not show the exact internal score by default. An advanced league setting may reveal the score and factors.

## Draft interaction

The user starts the two-round draft. Controls are `Next pick`, `User’s next pick`, and `End draft`. At a user pick, the user may select a prospect. If they simulate, baseline AI selects the best available prospect with small need/mode adjustments. The UI presents fog-of-war ratings and potential ranges, not exact true values.

## Rotation interaction

The rotation screen supports:

- Starting five selection.
- Bench/depth ordering.
- Target-minute entry.
- Automatic rotation generation.
- Minute normalization preview.
- Position eligibility validation.
- Injury/foul/emergency warnings.

No play-calling or live coaching controls are required.

## Settings interaction

League creation begins with a standard preset and offers advanced sections:

- Game environment.
- Player generation.
- Development and aging.
- Injury and retirement.
- Economy and cap/tax.
- Contract market.
- Trade market.
- Owner/staff behavior.
- Information/scouting.

Each setting needs a description, bounded input, default/reset action, and indication of whether it affects future simulation only. Settings are chosen before league generation and are not edited mid-league in the first v2. Exact player-value, contract-utility, and diagnostic fields can be toggled in advanced settings.

## Table strategy

Use TanStack Table for data-heavy screens from the beginning. The shared table wrapper must support:

- Typed columns and cell renderers.
- Sorting, filtering, grouping, and pagination/virtualization.
- Column visibility and density.
- Pinned identity columns.
- URL-serializable state.
- Saved views.
- Keyboard navigation and row actions.
- Responsive priority columns.
- Visible-row CSV/JSON export.

The current repository declares `@tanstack/react-table` but still has custom sorting and raw table implementations. V2 should establish one table contract rather than extend the bespoke table ecosystem.

## Desktop and mobile principles

- Desktop prioritizes comparison, multi-panel context, and keyboard actions.
- Mobile prioritizes one decision at a time, sticky identity/action regions, and compact detail views.
- Keep deadlines and blocked reasons visible at every width.
- Preserve filters and context after commands.
- Use skeleton, empty, error, and recoverable import states intentionally.
- Do not rely on color alone for status.
- Respect reduced-motion preferences.
- Keep primary action targets tappable even when tables become horizontally scrollable.

## Reusable management patterns

- `DecisionHeader`: phase, deadline, primary action, blocked reason.
- `EntityTable`: TanStack-backed table with saved views and URL state.
- `ComparisonDrawer`: compare selected players, contracts, or teams.
- `ExplanationPanel`: named factors, confidence, alternatives, and source events.
- `ScenarioToggle`: current state versus proposed action.
- `Timeline`: events grouped by season/day/importance.
- `CommandConfirm`: consequence summary and irreversible-action warning.
- `ImportReport`: schema result, migration steps, dropped optional data, and backup action.
- `WorkerProgress`: simulation progress, phase, day, and safe cancel state.
- `ResponsiveDetail`: desktop side panel and mobile full-screen detail.

## Screen design process

Before implementing each screen, write a one-page spec containing user goal, primary action, facts required, commands invoked, phase rules, empty/loading/error states, desktop layout, mobile layout, table columns, keyboard flow, and related-entity links. Validate the screen against a seeded golden league and a real locally generated league.
