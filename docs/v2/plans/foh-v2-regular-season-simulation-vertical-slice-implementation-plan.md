# Front Office Hoops V2 — Regular-Season Simulation Vertical Slice

**Status:** In progress — rotation slice implemented; simulation-target slice next
**Scope:** Saved rotations, first-game simulation, target-date controls, and
post-game state review after the user selects a team at the start of the
regular season.

**Related:**

- [V2 roadmap](./foh-v2-roadmap.md)
- [Lifecycle and dashboard controls](./foh-v2-lifecycle-and-dashboard-controls-implementation-plan.md)
- [League lifecycle implementation](./foh-v2-league-lifecycle-implementation-plan.md)
- [Production and player value in league state](./foh-v2-production-value-league-state-implementation-plan.md)
- [Calendar and season lifecycle](../specs/foh-v2-calendar-and-season-lifecycle.md)
- [Dashboard UI brief](../specs/foh-v2-dashboard-ui-brief.md)
- [Data and export design](../specs/foh-v2-data-and-export-design.md)

## Objective

Build the first user-driven regular-season loop:

```text
Select team
  → review team state
  → set or confirm rotation
  → simulate next game
  → review the result
  → save and reload
  → simulate to the next game, key date, or deadline
```

The user should be able to play forward from the first regular-season date
without leaving the authoritative V2 league document or using a developer lab.
Every simulation control must use the same worker, lifecycle, validation, and
persistence path.

This plan intentionally starts with regular-season gameplay. Draft, free
agency, offseason development, and full playoff management remain later
destinations. The target-control framework is built now so those destinations
can be added without creating separate simulation paths.

## Current baseline

The current V2 branch already provides:

- league creation and team selection;
- a saved `LeagueDocument` with a dated regular-season schedule;
- Dexie save, reload, and JSON export foundations;
- a dashboard with date, phase, record, standings, leaders, team statistics,
  and upcoming schedule;
- roster, finance, and free-agent read surfaces;
- persisted default rotations for every generated team;
- a `SetRotation` command with schema validation and command events;
- a roster rotation editor with starters, bench order, target minutes,
  validation feedback, save/reset behavior, and deep-linkable tabs;
- roster-release behavior that removes released players from saved rotations and
  preserves dead-money/payroll projections;
- a first `AdvanceDay` lifecycle command;
- completed game records containing final team and player box scores;
- seeded game, production/value, market, and draft lab modules.

The current gaps are:

- coaching plans are still created as neutral defaults rather than persisted;
- only `AdvanceDay` is enabled in the authoritative worker;
- next-game, key-date, deadline, regular-season-end, and next-phase controls are
  disabled or rejected;
- the rotation command does not yet enforce every gameplay-only rule at the
  command boundary, including selected-team ownership, exact 240-minute
  normalization, and persisted availability restrictions;
- availability and injuries are not yet carried reliably from one date to the
  next;
- production/value promotion and player-history selectors are not yet part of
  the completed command snapshot;
- the dashboard can display derived facts but does not yet complete the full
  simulate-review-reload workflow.

## Product decisions

### Simulation targets use one engine

Do not implement `SimulateToNextGame`, `SimulateToDate`, and deadline commands
as separate simulation loops. They resolve a target and call one shared
date-by-date runner.

```text
resolve target
  → validate target and phase
  → simulate each required calendar date
  → apply games, injuries, events, standings, production, and value
  → validate the resulting document
  → commit or retain the last valid snapshot
```

### Calendar semantics

The calendar remains authoritative. `state.calendar.currentDate` represents the
next unprocessed calendar date, as established by the existing lifecycle
contract.

Before implementation, lock these target behaviors in tests and command
metadata:

- `AdvanceDay` processes the current date and moves to the next date.
- `SimulateToNextGame` processes dates through the user's next scheduled game.
- `SimulateToDate` processes dates up to the requested boundary without
  overshooting it.
- `SimulateToNextKeyDate` resolves the next future milestone and stops at its
  management boundary.
- `SimulateToDeadline` stops at the trade-deadline boundary so the user can
  make deadline decisions.
- `SimulateToRegularSeasonEnd` completes all remaining regular-season games
  and leaves the document at the next legal season boundary.
- `SimulateToNextPhase` is enabled only when a legal phase transition and its
  target schedule exist; otherwise it returns a clear blocked reason.

The UI must display the target and resulting boundary precisely. A command
must never silently skip games, injuries, events, or intermediate dates.

### Persistence boundary

The completed user-facing command is the canonical save boundary:

- successful commands commit a complete validated snapshot;
- failed or cancelled commands never replace the last valid committed save;
- long-running commands may write daily recovery checkpoints separately;
- a successful command promotes its final snapshot over the previous commit;
- every completed snapshot contains its compact games, player box scores,
  standings, events, availability, production, and current player values.

The main league save remains the authoritative state. Recovery checkpoints must
not create a second competing league history.

## Phase 0 — Freeze contracts and target metadata

**Status:** Partially implemented. The saved rotation shape, `SetRotation`
command, schema validation, default creation, and worker routing are now in
place. Target metadata and target commands remain future work.

### Domain and schema

Update `packages/domain-v2` and `packages/league-schema` with typed contracts
for:

- persisted team game plans;
- current player availability and injury intervals;
- lifecycle targets and target metadata;
- worker progress and recovery checkpoints;
- current-season production/value projections from the related promotion plan.

Use a single canonical location for team plans. The recommended shape is a
league-state map keyed by team ID:

```ts
type TeamGamePlan = {
  rotation: GameRotationInput
  coaching: GameCoachingProfile
}

type LeagueGamePlans = Record<string, TeamGamePlan>
```

The exact field name may follow the existing domain naming, but rotations must
be part of the saved league document rather than React state or a temporary
fixture.

The following command is implemented in the current slice:

- `SetRotation`;

The remaining lifecycle commands are defined or reserved but not enabled:

- `SetTeamCoaching` when coaching controls are exposed;
- `AdvanceDay`;
- `SimulateToNextGame`;
- `SimulateToDate`;
- `SimulateToNextKeyDate`;
- `SimulateToDeadline`;
- `SimulateToRegularSeasonEnd`;
- `SimulateToNextPhase`.

Add typed lifecycle metadata:

```ts
type LifecycleTarget =
  | { kind: "next-game"; teamId: string; scheduleId: string }
  | { kind: "date"; date: string }
  | { kind: "key-date"; date: string; label: string }
  | { kind: "deadline"; date: string; label: string }
  | { kind: "regular-season-end"; date: string }
  | { kind: "next-phase"; phase: LeaguePhase; date: string }
```

Command metadata must expose:

- label;
- target date or schedule ID;
- enabled state;
- blocked reason;
- expected number of dates/games when known;
- current phase and required phase.

### Version behavior

New required state should use the V2 version/rules contract. Unsupported older
league versions should show a clear message and require creation of a new
league, consistent with the current project decision; do not build a migration
chain for this slice.

### Invariants

Add validation for:

- every team has a legal game plan;
- every rotation player belongs to that team's roster;
- starters are unique and position eligibility is respected;
- target minutes are finite, non-negative, and normalized by the game adapter;
- a player cannot be unavailable and start without an explicit emergency rule;
- every completed schedule entry has exactly one stored game record;
- completed games cannot be simulated twice;
- `currentDate` never moves backward;
- a target command never overshoots its target boundary;
- failed commands return the original committed snapshot unchanged.

## Phase 1 — Persist and edit rotations

**Status:** Mostly implemented in the current working slice.

### League creation defaults

Completed:

1. Build a legal default rotation for every team.
2. Store rotations in the authoritative league document.
3. Validate the generated document before it is offered for team selection.
4. Expose the rotation editor from the roster route.
5. Save the edited rotation through the worker and repository.
6. Remove released players from their saved rotation.

AI teams may retain the generated defaults for this slice. Coaching settings
remain neutral defaults until their own saved team-plan contract is added.

### Rotation command

The current implementation is `SetRotation` in `packages/sim-v2`:

- accept the selected team ID and a complete rotation payload;
- reject unknown players, duplicate players, and invalid minute plans;
- reject changes to a team other than the selected user team unless the command
  is explicitly an AI/internal command;
- return typed validation issues for the UI;
- emit a `rotation.updated` event or equivalent command event;
- save the validated plan.

The command should replace the complete rotation atomically. Avoid partial
starter/depth/minute writes that can leave a team temporarily invalid.

Remaining hardening for this slice:

- enforce selected-user-team ownership at the command boundary;
- enforce the exact 240-minute regulation total in the command, not only in
  the UI;
- reject unavailable starters using authoritative persisted availability;
- add explicit persistence/reload coverage for the browser workflow.

### Rotation UI

The first playable rotation UI is now implemented in the roster route. The
remaining UI work is limited to polish and end-to-end verification:

Add the first playable rotation route or panel:

- starters;
- depth order;
- target minutes;
- automatic/default rotation action;
- minute normalization preview;
- position and injury warnings;
- save/revert behavior;
- clear indication of unsaved changes.

Use the existing V2 UI primitives and the management UI conventions in the
dashboard brief. The screen should work at desktop and narrow widths and must
not rely on color alone for invalid states.

### Rotation acceptance

The user can change a rotation, save it, reload the page, and see the same
rotation. The next simulated game consumes that rotation, and a deterministic
run with the same league, rotation, and seed remains reproducible.

## Phase 2 — Extract the shared daily runner

Move orchestration out of the command dispatcher and keep the worker command
switch thin. Add a focused lifecycle module with a pure internal operation such
as:

```ts
simulateOneLeagueDate(
  league: LeagueDocument,
  date: string,
): LeagueDateSimulationResult
```

For one date, the operation must:

1. Validate that the date is the next unprocessed date.
2. Find every scheduled game on that date.
3. Build fixtures from the league's saved plans, availability, roster, and
   resolved simulation settings.
4. Run the existing calibrated game engine.
5. Mark each successful schedule entry completed.
6. Store compact game records with final team and player box scores.
7. Apply injury events and update availability for future dates.
8. Update standings and team records.
9. Rebuild current-season production and Universal Player Value using the
   related promotion plan.
10. Append game, injury, and calendar events.
11. Advance the calendar and validate the resulting document.

No UI route may aggregate production, calculate value, or mutate standings.
Those calculations belong in `packages/sim-v2` and are invoked by the
authoritative lifecycle path.

### Injuries and availability

Use date-aware availability as the source of truth. A game injury must affect
subsequent fixtures until the player's return condition is met. Store enough
information to explain:

- when the injury began;
- expected return date or remaining restriction;
- whether the player is unavailable or minutes-limited;
- which games were missed.

Do not recreate an all-available map for every fixture.

### Settings and deterministic seeds

The fixture adapter must use the league's resolved settings. It must not call
the standard game-config factory unconditionally when the league has a valid
override. Seeds must include the league seed, season, schedule ID, and stable
simulation version inputs.

## Phase 3 — Implement `SimulateToNextGame`

This is the first complete user-facing simulation milestone.

### Target resolution

Resolve the first scheduled game involving `state.userTeamId` whose status is
scheduled and whose date is at or after the current date. The runner processes
all required dates through that game, including other league games on those
dates.

Reject with an actionable reason when:

- no user team is selected;
- no future user-team game exists;
- the current phase does not support game simulation;
- the league document is invalid;
- a scheduled game references missing teams or players.

### Worker behavior

Return:

- completed status and the new league document;
- command events;
- number of dates processed;
- games completed;
- current simulation date;
- target description;
- diagnostics and any non-fatal warnings.

For multi-date runs, report progress after each completed date. Cancellation
must stop at the last complete date and leave the last committed snapshot
unchanged unless the user explicitly chooses to recover a checkpoint.

### UI behavior

Wire the existing header CTA and menu:

- make `Next game` the primary action when it is supported;
- show the opponent, date, and expected work before starting;
- disable conflicting controls while a worker is active;
- show current date, dates processed, and games completed;
- surface a retryable failure without discarding the prior save;
- refresh dashboard selectors from the returned league document.

## Phase 4 — Persist and review the first game result

After `SimulateToNextGame`, the dashboard and player surfaces must read the
saved result.

### Canonical saved facts

Store:

- schedule ID, season, phase, and date;
- home/away teams and winner;
- final team box scores;
- final player box scores;
- injury facts and reconciliation status;
- game and injury events.

Keep full internal diagnostics and play-by-play out of normal saves. Use the
existing lab/debug export boundary for those details.

### Selectors and screens

Add reusable selectors for:

- completed games for a team;
- completed games for a player;
- current-season player totals;
- player totals by team stint;
- recent games and events;
- current production/value records;
- injury status and games missed.

Use the nested player box scores in stored game records as the canonical
player-game-log source. Do not create a duplicate authoritative
`playerGameLogs` collection.

The first review surface must support:

- final score;
- team box score;
- player box score;
- player game-by-game history;
- updated standings;
- injuries and availability;
- production and player value updates.

## Phase 5 — Add target-date and milestone commands

Once one-game simulation is reliable, add the generic target runner. Each
target calls `simulateOneLeagueDate` repeatedly and uses the same save,
validation, and progress behavior.

### `SimulateToDate`

- Accept a valid future date.
- Reject dates before the current date.
- Reject dates outside the supported season window.
- Do not overshoot the target.
- Explain whether the target date is a management boundary or a processed game
  date.

### `SimulateToNextKeyDate`

Resolve the next future milestone from the current calendar, initially:

1. Trade deadline.
2. Playoffs/play-in start boundary.
3. Regular-season end.

The UI label may say `Next major date`, while the command and selector should
use one stable internal name.

### `SimulateToDeadline`

- Resolve the configured trade deadline.
- Process every intermediate date and game.
- Stop at the deadline management boundary.
- Make trade/extension availability metadata reflect the deadline.
- Persist a deadline-arrival event and snapshot.

The actual trade command is outside this plan, but the simulation must arrive
at a trustworthy deadline state for the next front-office slice.

### `SimulateToRegularSeasonEnd`

- Process every remaining regular-season date.
- Keep preseason/playoff games out of regular-season standings.
- Produce final regular-season production/value projections.
- Mark the regular-season boundary reached.
- Do not silently invent playoff results.

### `SimulateToNextPhase`

Add the target resolver and blocked-state metadata now. Enable it only for a
phase transition with a complete transition command and schedule. The first
activation target is regular season to play-in/playoffs. Draft, free agency,
and offseason phase controls become active only after their own authoritative
commands exist.

## Phase 6 — Phase-boundary scaffold

To support honest next-phase controls, add explicit phase-boundary handling:

- detect the final regular-season game;
- validate that all required games are complete;
- finalize regular-season standings and production/value;
- create the next supported schedule or return a blocked reason;
- update `state.phase` only through an authoritative command;
- emit a phase-transition event;
- save the boundary snapshot before the next phase is playable.

This slice does not implement the full draft, free agency, or offseason. It
does ensure `SimulateToNextPhase` cannot falsely claim that a phase exists.

## Phase 7 — Persistence and recovery

Extend the worker/repository boundary for long-running target commands.

### Canonical commit

`runAndCommitLeagueCommand` commits only a completed, validated result. Rejected
and failed results do not overwrite the active save.

### Recovery checkpoint

For multi-date commands:

- emit a checkpoint after each complete date;
- include the partial league document, command ID, date, and completed-game
  count;
- store it separately from the last committed snapshot;
- expose recovery only when the checkpoint validates;
- remove or supersede it after successful final commit.

### Export behavior

The last complete checkpoint must be exportable as a valid operational save if
the user chooses recovery. Debug diagnostics remain optional and must not bloat
normal league exports.

## Phase 8 — Tests and acceptance

### Domain and schema tests

- valid default plans pass validation;
- invalid rotation payloads return field-level issues;
- unsupported document versions are rejected clearly;
- target metadata serializes and reloads;
- current-season projection and game-history shapes validate.

### Simulation tests

- a no-game date advances without creating a game record;
- one date with multiple games completes all scheduled games;
- next-game simulation reaches the user's next game;
- target-date simulation never overshoots;
- key-date resolution chooses the next future milestone;
- deadline simulation stops at the deadline boundary;
- regular-season-end simulation completes every regular-season game;
- next-phase simulation is blocked when no transition exists;
- rotations and coaching settings reach the fixture adapter;
- injuries affect later availability;
- games cannot be simulated twice;
- standings and game records reconcile;
- production/value updates match the saved game facts;
- deterministic seeds produce repeatable results.

### Persistence and worker tests

- successful results save and reload;
- rejected commands do not save;
- failed commands preserve the last committed snapshot;
- checkpoints are emitted for multi-date runs;
- cancellation does not corrupt the committed save;
- final commit supersedes its recovery checkpoint.

### Browser workflow tests

Cover the user journey:

1. Create a league.
2. Select a team.
3. Open the dashboard on the regular-season start date.
4. Open and save a rotation.
5. Simulate the next game.
6. Review the score, box scores, standings, injury state, and player history.
7. Reload the save.
8. Confirm the same facts remain.
9. Simulate to the next key date or deadline.
10. Confirm progress, blocked reasons, and recovery behavior.

## Completion criteria

This plan is complete when:

- the user can set and persist a legal rotation;
- `SimulateToNextGame` is an authoritative worker command;
- the first simulated game uses the saved rotation;
- game records and player box scores are saved canonically;
- standings, injuries, availability, production, and player value update;
- the user can inspect the result through the dashboard and player surfaces;
- save/reload preserves the result;
- target-date, next-key-date, deadline, and regular-season-end commands use the
  shared runner;
- next-phase controls are either correctly enabled at a supported boundary or
  clearly blocked with an actionable reason;
- failed/cancelled commands preserve the last valid committed snapshot;
- focused simulation, schema, repository, and browser workflow tests pass.

## Immediate implementation sequence

Implement in this order:

1. Harden `SetRotation` with ownership, exact-minute, availability, and reload
   validation.
2. Persist coaching/availability state or define the smallest authoritative
   representation needed by the fixture adapter.
3. Extract `simulateOneLeagueDate` from the current day command.
4. Wire saved plans, availability, settings, and seeds into fixtures.
5. Add `SimulateToNextGame`.
6. Promote game facts into production/value and player-history selectors.
7. Build the post-game review state.
8. Add the generic target runner.
9. Enable next game, next key date, selected date, deadline, and regular-season
   end controls.
10. Add recovery checkpoints and cancellation behavior.
11. Add phase-boundary metadata and the first supported next-phase transition.
12. Run the full focused validation and update the current-state audit.

Do not start draft, free agency, or broad dashboard polish before steps 1–7
work end to end. Those systems should plug into the same target and persistence
contracts when their gameplay phases are implemented.
