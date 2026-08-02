# Front Office Hoops v2 — Dashboard UI Brief

**Status:** Product direction proposed  
**Scope:** The first official league dashboard and its navigation shell.  
**Related:** [UI Information Architecture](./foh-v2-ui-information-architecture.md), [League Lifecycle Implementation Plan](../plans/foh-v2-league-lifecycle-implementation-plan.md)

## Product role

The dashboard is the user's operating center. It should answer four questions
quickly:

1. What day and phase is the league in?
2. What can I do right now?
3. What is happening with my team?
4. What is coming next across the league?

It is not the full roster screen, cap sheet, news feed, or league schedule
screen. Those are deeper destinations. The dashboard gives enough context to
make the next decision and a clear path to inspect more.

## Recommended shell

Use a persistent left sidebar on desktop and a drawer or compact top bar on
smaller screens.

### Sidebar

The sidebar should contain:

- Front Office Hoops mark and active league name.
- Active team identity and conference/division.
- Primary navigation:
  - Dashboard
  - Team
  - League
  - Transactions
  - History
- Secondary navigation:
  - Save manager
  - Settings

The sidebar's single persistent CTA is the current phase action, such as
`Advance day` or `Simulate to next game`. Its label and disabled reason come
from command metadata; the UI must not guess them from the route.

Do not put every future destination in the sidebar as an active-looking link.
Unbuilt destinations can appear later when their commands and screens exist.

### Header

The header is reserved for time and simulation controls:

- Current date: `October 21, 2026`.
- Season and phase: `Season 1 · Regular season`.
- Next important deadline: `Trade deadline · February 5`.
- Compact controls:
  - `Next day`
  - `Next game`
  - `Next key date`
  - A `More simulation` menu for deadline and season controls.

The primary action remains visually clear, but the header should not become a
toolbar full of equal-weight buttons. The current action gets the filled
button; secondary controls use outline or ghost buttons.

## Main content layout

The content should use a simple two-column desktop layout that collapses to one
column on smaller screens.

### 1. Team snapshot

The first section is a compact summary of the user's organization:

- Team name.
- Conference and division.
- Record and conference rank.
- Next scheduled game: date, opponent, home/away, and status.
- Roster health summary: available players, injuries, and restrictions.

This should be a bordered text panel or compact table, not a grid of decorative
metric cards. The team name and next game should be the strongest visual
anchors.

### 2. Roster watch

Do not put the full roster table on the dashboard. It will make the dashboard
feel like the roster screen and create a second competing primary surface.

Instead, show a short roster-watch table with the players who require
attention:

| Player | Role | Overall | Health | Contract |
| --- | --- | ---: | --- | --- |
| Player name | Position/role | Rating | Available or injured | Expiring or stable |

Show up to five rows, prioritizing injuries, restrictions, expiring contracts,
and the highest-leverage players. The final row is `View full roster`.

### 3. League snapshot

Show a compact standings table, initially limited to the user's conference:

| Rank | Team | W–L | GB | Streak |
| ---: | --- | --- | ---: | --- |

Highlight the user's team and show a playoff-line marker when standings support
it. Include `View all standings` as the destination for the complete table.

This gives the user competitive context without turning the dashboard into a
full standings screen.

### 4. Upcoming schedule

Show the next five scheduled games for the user's team:

| Date | Opponent | H/A | Status |
| --- | --- | --- | --- |

Highlight the next playable or simulated game. If the user has no game on the
current date, state that plainly and show the next scheduled date. Preseason
games should be labeled as exhibitions and must not look like standings games.

### 5. Recent activity, when available

Add a small activity list below the primary sections once event persistence is
implemented. It should show only the latest three to five meaningful events:
game result, injury, transaction, deadline, or phase change. This is more useful
than a large news feed and can be omitted in the initial static dashboard
slice.

## Recommended first screen hierarchy

```text
Sidebar                     Main dashboard
─────────                   ─────────────────────────────────
League/team identity        Date · phase · deadline · controls
Dashboard                   Team snapshot        League snapshot
Team                        Roster watch         Upcoming schedule
League
Transactions
History

Phase CTA
Save manager / settings
```

The first viewport should show the date, primary action, team snapshot, and the
top of standings/schedule on a normal desktop screen. The dashboard may scroll
for the lower sections; unlike the landing page, operational density is
expected here.

## Phase-aware behavior

The dashboard consumes the authoritative phase context:

- Regular season: `Advance day`, `Next game`, standings, and upcoming schedule.
- Trade-deadline approach: deadline appears in the header and transaction CTA
  becomes more prominent.
- Playoffs: show postseason schedule and remove trade/extension actions.
- Offseason: replace game controls with the current offseason phase action.

When an action is blocked, keep it visible with a short reason and the required
next step. Do not hide controls behind navigation or make the user infer why a
button is unavailable.

## Loading, progress, and failure states

The dashboard needs explicit states for the worker-backed loop:

- Loading a save: preserve shell geometry with text skeletons.
- Simulating: show current date, games completed, and a safe cancel/recovery
  state where supported.
- No game today: show the next scheduled game and keep `Next day` available.
- Blocked action: show the command validation reason beside the action.
- Failed command: preserve the last committed league snapshot and offer retry.

## Visual direction

Keep the existing V2 language:

- White-first background and global semantic CSS tokens.
- Inter typography.
- Square corners, thin borders, and text-led hierarchy.
- One filled primary action at a time.
- Minimal icons; labels must carry the meaning.
- Shadcn primitives for sidebar, buttons, tables, dropdowns, alerts, and
  progress states.

The sidebar provides structure, not decoration. The main content should feel
like a clear league-office briefing: dense enough to operate, quiet enough to
scan.

## First implementation slice

Build in this order:

1. Add the persistent dashboard shell and sidebar using seeded league data.
2. Move the current league overview into the dashboard's team snapshot.
3. Add conference standings and the user's upcoming schedule from the new
   calendar/schedule contract.
4. Add the compact roster-watch table.
5. Implement and wire `Advance day` as the first worker command.
6. Add the remaining simulation controls after date advancement and standings
   persistence are reliable.

The dashboard should be designed against real generated saves, not placeholder
cards. Any control without a working command should be labeled as planned or
remain out of the active UI until its command contract exists.
