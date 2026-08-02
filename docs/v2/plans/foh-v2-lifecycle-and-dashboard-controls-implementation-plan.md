# Front Office Hoops v2 — Lifecycle and Dashboard Controls Implementation Plan

**Status:** Planned
**Scope:** The first authoritative regular-season lifecycle slice and its dashboard simulation controls.
**Related:** [Calendar and Season Lifecycle](../specs/foh-v2-calendar-and-season-lifecycle.md), [Simulation Architecture](../specs/foh-v2-simulation-architecture.md), [Dashboard UI Brief](../specs/foh-v2-dashboard-ui-brief.md), [League Lifecycle Implementation Plan](./foh-v2-league-lifecycle-implementation-plan.md)

## Product outcome

Create a league, select a team, click `Advance day`, simulate the scheduled
games, save the result, and see the dashboard update.

This is the first vertical slice connecting the authoritative league document,
the simulation worker, Dexie persistence, and the dashboard shell.

## Phase 1 — Define the lifecycle contract

Update the authoritative V2 contracts in:

- `packages/domain-v2`;
- `packages/league-schema`;
- `packages/sim-v2`.

Add or formalize these command variants:

- `AdvanceDay`;
- `SimulateToNextGame`;
- `SimulateToDate`;
- `SimulateToDeadline`;
- `SimulateToRegularSeasonEnd`.

The first implementation only enables `AdvanceDay`. The other commands remain
explicitly blocked until the base behavior is reliable.

Add typed records for:

- completed league games;
- standings rows;
- game-result events;
- date-based injury intervals, when injuries are persisted;
- lifecycle action metadata and blocked reasons.

Any document-shape changes must include schema validation and migration or
backward-compatible defaults for existing saves.

The calendar remains the source of truth. Lifecycle advancement must not use a
synthetic game counter.

## Phase 2 — Implement `AdvanceDay`

Create a focused lifecycle module in `packages/sim-v2` instead of expanding
`executeCommand.ts` into a large orchestration file.

`AdvanceDay` must:

1. Validate the league document.
2. Confirm that the league is in a supported phase.
3. Treat `currentDate` as the next unprocessed calendar date.
4. Find all scheduled games on that date.
5. Build game fixtures from the authoritative league document.
6. Use deterministic default rotations until rotation management exists.
7. Run the existing game simulation engine.
8. Mark each scheduled game as completed.
9. Persist a compact game record and box score.
10. Update regular-season standings and records.
11. Persist game and injury events.
12. Advance the calendar to the next date.
13. Increment the league day.
14. Update `metadata.updatedAt`.
15. Validate the resulting document before returning it.

If there are no games on the current date, the command still advances to the
next calendar date.

The first slice supports the regular season only. Playoffs, offseason
transitions, `BeginPreseason`, trades, extensions, and owner goals remain
blocked with explicit reasons.

## Phase 3 — Preserve worker and save boundaries

The simulation package remains pure:

```text
Dashboard
  → league worker
  → execute command
  → return new LeagueDocument
  → repository.save(new document)
```

Update the worker flow so that:

- completed commands return the new snapshot and events;
- rejected commands return a structured reason;
- failed commands do not replace the last committed snapshot;
- progress reports include games completed and the current target date;
- the UI saves only a completed result;
- Dexie remains the checkpoint store;
- React state remains a view of the saved document.

The existing `runLeagueCommand` helper remains the browser worker boundary. Add
a small lifecycle orchestration helper in `apps/web-v2` to execute a command
and persist the completed result consistently.

## Phase 4 — Wire the dashboard controls

Update `apps/web-v2/src/routes/league.index.tsx` with state for:

- current committed league snapshot;
- active command;
- progress;
- error or rejection reason;
- retry state;
- abort state, if supported.

Initial control behavior:

- `Advance day`: enabled for supported regular-season saves;
- `Next game`: visible but disabled until target simulation exists;
- `Next key date`: visible but disabled until target simulation exists;
- `More simulation`: keeps future commands disabled with honest explanations.

After `AdvanceDay` is reliable, implement:

- `Next game`: process all dates until the user’s next scheduled game;
- `Next key date`: process until the next supported milestone;
- `Simulate to deadline`: process every intermediate date and game;
- `End regular season`: process through the final regular-season date.

Target commands must process every intermediate date, game, injury, and event
through the worker. They must not teleport the document directly to the
destination date.

Use the existing local ShadCN components:

- `Button`;
- `DropdownMenu`;
- `Progress`;
- `Alert`;
- `Badge`;
- `Skeleton`.

The primary available command gets the filled button. Secondary commands use
outline or ghost variants.

## Phase 5 — Make dashboard data authoritative

Replace remaining derived or placeholder assumptions with selectors based on
the saved document:

- current date and phase;
- next scheduled game;
- updated team record;
- updated standings;
- completed game status;
- recent game and event activity;
- current simulation availability.

Create reusable lifecycle selectors rather than keeping all logic inside the
route:

```text
getNextScheduledGame
getNextKeyDate
getLifecycleActionState
getTeamStanding
getRecentLeagueEvents
```

The sidebar and header receive their labels and disabled reasons from these
selectors or command metadata.

## Phase 6 — Tests

### Simulation and lifecycle

- Advance a date with no games.
- Simulate one game on a date.
- Simulate multiple games on the same date.
- Mark games completed.
- Update standings correctly.
- Persist game results and events.
- Keep preseason games out of regular-season standings.
- Reject unsupported phases.
- Reject invalid documents.
- Leave the original snapshot unchanged on failure.
- Produce repeatable results for deterministic lab leagues.

### Worker and repository

- Save and reload completed worker results.
- Do not overwrite saves for rejected results.
- Preserve the last committed snapshot after failed commands.
- Emit progress for multi-day simulations.

### Dashboard workflow

- Load the saved league.
- Enable `Advance day` when valid.
- Disable controls while simulating.
- Show progress.
- Update date, record, standings, and schedule after completion.
- Show a retryable error when a command is rejected or fails.

## Acceptance criteria

This slice is complete when:

1. A user creates and selects a league.
2. The dashboard opens on the first regular-season date.
3. `Advance day` simulates the scheduled games for that date.
4. The calendar moves forward.
5. Standings and game statuses update.
6. The updated document is saved to Dexie.
7. Reloading the page preserves the new state.
8. Errors do not destroy the last saved snapshot.
9. Focused lifecycle and worker tests pass.

After this slice, implement `Next game` and `Next key date`, followed by
standings polish and the first roster or management screen.
