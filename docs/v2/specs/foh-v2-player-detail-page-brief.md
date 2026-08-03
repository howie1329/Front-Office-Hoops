# Front Office Hoops V2 — Player Detail Page Brief

**Status:** Shaped high-fidelity direction — confirmation required
**Scope:** Dedicated player information page for the V2 management surface  
**Proposed route:** `/league/players/:playerId`  
**Related:** [V2 UI Information Architecture](./foh-v2-ui-information-architecture.md), [Team & Roster Screen Brief](./foh-v2-team-roster-screen-brief.md), [Player Information Data Foundation](../plans/foh-v2-player-information-data-foundation-implementation-plan.md)

## Product role

The Player Detail page is the authoritative place to understand one player
over time. It should help a front-office user answer:

- Who is this player right now?
- How good is he, and what are his strengths?
- Is he developing, plateauing, or declining?
- What has he actually done in games and seasons?
- Is he available and what is his injury history?
- What does he cost, and how valuable is he to the team?

This is a management and evaluation surface. It is not a player-card screen,
scouting reveal, news feed, or simulation control panel.

## Locked decisions

- The page is a dedicated full-page route, not a roster sheet or modal.
- The page uses separate tabs rather than one long scrolling document.
- The initial tabs are:
  1. Overview
  2. Game Log
  3. Season Log
  4. Contract & Value
  5. Availability & Injuries
- Overview contains identity, ratings, skills, development, current production,
  a compact availability summary, and recent relevant events.
- Availability & Injuries contains the complete injury table.
- The first version uses an initials avatar. Portraits can be added later
  without changing the page structure.
- The header includes back-to-roster, previous/next-player navigation, and a
  link to the player's team.
- The header includes a secondary Actions menu with Edit Rotation, Review
  Contract, Add to Trade, and Release Player behind confirmation.
- The page must use the existing V2 shell, Shadcn primitives, CSS tokens, and
  data selectors. It should not invent a separate visual language.

## High-fidelity shape pass 2

### 1. Feature summary

This is a dedicated player-evaluation workspace for a front-office user
reviewing one individual player. It combines current identity, skill strength,
development trajectory, production, health, contract, and value context in a
fixed full-page route.

The page should feel like a serious league-office review tool: dense enough for
repeat use, calm enough to trust, and structured so a user can move from “who
is this player?” to “what should I do with him?” without leaving the page.

### 2. Primary user action

The primary action is reviewing one player and forming a roster decision. The
Overview tab should answer the current-state question immediately; the other
tabs provide evidence for deeper evaluation.

Success means the user can understand the player's current ability, trajectory,
availability, production, contract, and value without opening a second screen
or losing the player context.

### 3. Design direction

Use the existing V2 product register and a **Restrained** color strategy:

- true product surfaces and existing global tokens;
- one accent for active tabs, primary actions, and meaningful status;
- neutral separators and dense table hierarchy;
- system sans typography;
- no gradients, decorative illustrations, sports-media treatments, or repeated
  dashboard cards.

Scene sentence: a front-office operator is reviewing a player on a large
monitor in a quiet league office during a focused morning roster review, with
the current season state visible but no presentation noise competing with the
evidence.

Named anchors:

- Linear for fixed workspace hierarchy and persistent navigation context;
- Stripe Dashboard for restrained data density and readable financial tables;
- Baseball Savant for evidence-first sports data presentation, without copying
  its public-media styling.

The selected visual probe is **Direction 1 — Compact Evaluation Workspace**.
Direction 2's extra sidebar, expanded tab set, and portrait-first header are
intentionally rejected.

### 4. Scope

- Fidelity: high-fidelity responsive design brief;
- Breadth: one player route with five tab states;
- Interactivity: tab switching, internal scrolling, table controls, chart
  inspection, player navigation, and action-menu flows;
- Time intent: shape for production implementation, with code deferred until
  this direction is explicitly confirmed.

### 5. Layout strategy

The route owns a fixed viewport. The document body does not scroll.

Spatial hierarchy:

1. Global league shell remains visible and supplies season, phase, date, save,
   and navigation context.
2. A compact player header stays pinned beneath the shell. It contains the
   initials avatar, identity, OVR, development phase, availability, team link,
   previous/next controls, and Actions menu.
3. A five-tab strip stays pinned beneath the player header. The active tab is
   represented by the existing V2 tab treatment.
4. The active tab panel owns the scroll container. Long content scrolls inside
   the panel, never at the page level.

Overview topology on desktop:

- left column: ratings and skills, with the numeric value aligned to each
  progress bar;
- right column: overall-rating history graph above the compact availability
  summary;
- full-width lower region: current production summary table and recent events.

This establishes a clear evaluation sequence: ability → trajectory and health
→ evidence from current production.

On smaller screens, the header compresses, the tab strip scrolls horizontally,
and the Overview columns stack in this order: current snapshot, ratings and
skills, development graph, availability summary, current production, recent
events. The active panel remains the only vertical scroll region.

### 6. Key states

- Default: complete player data with Overview selected.
- Loading: skeleton identity header, tab strip, progress bars, chart region,
  and table rows; no page spinner.
- No archive: chart region explains that an overall-rating history appears
  after the first season archive.
- No current production: show the player identity and ratings with an explicit
  “No current-season games recorded” message.
- No contract: show “No active contract” and a link to the appropriate roster
  or market context.
- No injury history: show “No recorded injuries” while still showing current
  availability.
- Out or restricted: use a semantic status label, games remaining, expected
  return, and restriction details; never rely on color alone.
- Empty filtered log: keep the controls visible and explain that no rows match
  the selected filters.
- Player not found: explain that the player is unavailable in the selected
  save and provide Back to Roster.
- Stale snapshot: show the last committed state and a clear refresh/retry path.
- Worker/save failure: preserve the player context and explain whether the
  action was committed.
- Destructive action: release confirmation names the player, team, and impact.

### 7. Interaction model

- Active tab is URL-addressable and survives refresh, previous/next navigation,
  and return from an action workflow.
- Previous/next changes the player while preserving the active tab and origin
  roster context.
- The player header remains visible while the active panel scrolls.
- Game Log and Season Log use fixed table viewports with independent vertical
  and horizontal overflow, sticky table headers, and visible scroll affordance.
- Rating bars expose their values as text and accessible progress semantics.
- The development graph provides point inspection plus a text trend summary.
- Actions menu opens standard product controls: Edit Rotation, Review Contract,
  Add to Trade, and Release Player with confirmation.
- Tab changes should be immediate and quiet; no decorative page transitions.

### 8. Content requirements

Realistic data ranges:

- one player identity;
- eight primary skill bars plus physical, role, archetype, and trait metadata;
- zero to many seasons;
- zero to thousands of game-log rows over a long career;
- zero to many injury records;
- zero or one active contract;
- one current value record when a projection exists.

The content source is the typed `PlayerInformationView`; React formats and
labels values but does not recalculate ratings, production, value, contract
normalization, or injury history.

Required empty-state copy should be specific, such as:

- “No current-season games recorded.”
- “Overall history will appear after the first archived season.”
- “No active contract is recorded for this player.”
- “No recorded injuries for this player.”
- “No games match these filters.”

No portrait asset is required for this pass. The initials avatar is the accepted
placeholder and must preserve a future portrait slot.

### 9. Recommended implementation references

Implementation should consult:

- `reference/layout.md` for the fixed viewport, two-column Overview topology,
  table regions, and responsive stacking;
- `reference/adapt.md` for mobile tab overflow and internal scrolling;
- `reference/interaction-design.md` for tab, chart, table, and action feedback;
- `reference/typeset.md` for dense product hierarchy and table readability;
- `reference/harden.md` for stale, loading, empty, permission, and worker-error
  states.

### 10. Open questions

No material design questions remain for this shape pass. The remaining gate is
explicit confirmation of the Direction 1 layout and the fixed-viewport behavior
before implementation begins.

## Page shell and navigation

### Entry points

The page is opened from:

- a player row in the roster table;
- a player search result;
- a player reference in a transaction, injury, or game context;
- a direct URL or browser history entry.

The roster should preserve the originating team and save context when linking
to the page. The player ID is the route identity; save context follows the
existing V2 route conventions.

### Header navigation

The page header should contain:

- Back to Roster;
- previous-player and next-player controls using the originating roster order;
- team name as a link to the team roster;
- the current season, phase, and date through the global league shell;
- the Actions menu.

Previous/next controls are disabled at the beginning and end of the available
roster list. They should preserve the active tab while changing the player.

The Actions menu is secondary to the page content. Destructive release actions
must use an explicit confirmation dialog that names the player and explains the
consequence.

## Player identity header

The identity header is compact and information-dense. It should establish the
player before the user reads any tab content.

Display:

- initials avatar with team color treatment;
- full player name;
- primary and secondary position;
- primary and secondary archetype;
- age;
- team and roster status;
- current role or rotation status;
- overall rating;
- development phase;
- availability status.

The avatar is a stable slot. A future portrait asset may replace the initials
without moving the name, rating, or actions.

Do not use a large hero treatment or oversized decorative rating number. This is
a product page where information density and credibility matter more than
presentation.

## Tab 1 — Overview

Overview is the default landing tab. It should answer the most common player
questions without requiring a second click.

### Overview sections

#### Current snapshot

Use a restrained summary row for:

- Overall rating;
- current role and position;
- age and development phase;
- current availability;
- current-season games and minutes;
- Universal Player Value and confidence, when available.

These are summary values, not a repeated dashboard card grid. Keep the labels
close to the values and let alignment create hierarchy.

#### Ratings and skills

Represent each skill with a labeled 0–100 progress bar and its numeric value:

- Shooting;
- Finishing;
- Passing;
- Handling;
- Rebounding;
- Defense;
- Basketball IQ;
- Stamina.

The numeric value must remain visible next to the bar. Do not rely on color or
bar length alone. Use a consistent scale, accessible names, and an accessible
value description such as “Shooting, 72 out of 100.”

Also show:

- physical profile when useful to roster decisions;
- positions and archetypes;
- traits;
- injury resistance only where the user's information permissions allow it.

#### Development

The development section contains the overall-rating history graph.

Graph requirements:

- x-axis: season or season-ending point;
- y-axis: overall rating from 0 to 100;
- one point per authoritative rating snapshot;
- current season shown distinctly from archived seasons;
- tooltip or accessible detail for season, age, phase, and rating;
- visible empty state before the first archive exists;
- a text summary of the trend for users who do not use the chart.

The graph should not imply precision between snapshots. It represents recorded
player-state snapshots, not a continuous simulation curve.

Show the current development phase, potential, peak age, decline timing, and
growth/decline curve labels beside or below the graph when those values are
permitted in the current information view.

#### Current production

Show a compact current-season production summary with:

- games played and scheduled;
- starts;
- minutes and minutes per game;
- points, rebounds, assists, steals, blocks, and turnovers per game;
- field-goal, three-point, free-throw, and true-shooting percentages;
- usage rate;
- role and shot profile.

The section links to the full Game Log and Season Log rather than duplicating
their tables.

#### Availability summary

Show the current state at a glance:

- Available, out, or minutes-limited;
- games remaining when out;
- expected return date;
- current restriction or minutes limit;
- games missed this season;
- most recent injury summary.

This is intentionally compact. The complete injury history belongs in the
Availability & Injuries tab.

#### Recent relevant events

Show a short, reverse-chronological list of player-specific events, such as:

- injury recorded or returned;
- production or value milestone;
- development update;
- contract or roster action.

Each event should include date, event type, short summary, and a link to the
relevant tab or context when one exists. Do not turn this into a general league
news feed.

## Tab 2 — Game Log

Game Log is a dense, sortable table showing every game in which the player
recorded minutes.

### Recommended columns

- Date;
- season;
- opponent;
- home/away indicator;
- result and win/loss;
- starter indicator;
- minutes;
- points;
- rebounds, offensive rebounds, and defensive rebounds;
- assists;
- steals and blocks;
- turnovers and fouls;
- field goals made/attempted and percentage;
- three-pointers made/attempted and percentage;
- free throws made/attempted and percentage;
- usage rate;
- shot profile when space permits.

The first version must not display plus/minus, on/off, or impact metrics because
the simulator does not produce those statistics authoritatively.

### Game Log behavior

- Sort newest first by default.
- Filter by season.
- Filter by competition type when preseason, regular season, playoffs, or
  other competition data exists.
- Preserve the selected filters in the URL when practical.
- Keep the identity/date columns readable while the table scrolls horizontally.
- Provide a clear empty state for no games, no games matching filters, and games
  not yet available in the saved snapshot.
- Use compact formatting consistently; do not hide important values behind
  hover-only interactions.

The log is derived from canonical saved game records and nested player box
scores. It must not read from a duplicate player-game-log store.

## Tab 3 — Season Log

Season Log shows one row per season and makes multi-season development and
production easy to compare.

### Recommended columns

- Season;
- team or teams;
- games played and scheduled;
- starts;
- minutes and minutes per game;
- points, rebounds, assists, steals, blocks, and turnovers per game;
- field-goal, three-point, free-throw, and true-shooting percentages;
- usage rate;
- role;
- overall rating at the recorded snapshot;
- Universal Player Value, rank, percentile, and confidence when available.

The current season should be clearly marked as in progress and show its
through-date. Archived seasons should show their completed state.

### Team splits

If a player appeared for more than one team in a season, the row exposes an
expandable team-split subtable. Each split includes the same core production
fields as the season total and identifies the team stint.

Do not make the user open a separate page to understand a trade-season split.
For players with one team, keep the split collapsed or omit the affordance.

## Tab 4 — Contract & Value

This tab explains both the player's financial commitment and the current
Universal Player Value context.

### Contract section

Display:

- team and contract status;
- contract source/type;
- current-season salary;
- annual salary by remaining season;
- years remaining;
- start and end season;
- total contract value;
- remaining contract value;
- expiring-season indicator;
- relevant guarantees, options, or rights when those fields exist.

Actions:

- Review Contract opens the contract detail or relevant finance surface.
- Add to Trade opens the trade workflow with the player preselected.

The page should consume the shared normalized contract selector. It must not
parse legacy `JsonRecord` contract shapes in the route.

### Universal Player Value section

Display:

- current value;
- confidence level;
- percentile and league rank;
- sample size in games, minutes, and seasons;
- current ability, recent production, projected contribution, age trajectory,
  upside, durability, opportunity, role context, and defensive contribution;
- relevant diagnostic flags in an explanatory, non-alarmist presentation.

Value should be explained as an evaluation context, not presented as an
objective truth. Keep the underlying factors visible enough that a user can
understand why a player ranks where he does.

## Tab 5 — Availability & Injuries

This tab is the complete health-history surface.

### Current availability

Repeat the current state in a compact header so the tab is understandable when
opened directly:

- availability state;
- games remaining;
- expected return;
- restriction or minutes limit;
- games missed this season.

### Injury history table

Columns:

- injury date;
- description;
- expected return;
- actual return;
- games missed;
- source game or schedule reference;
- season.

Open-ended injuries should clearly show that an actual return has not yet been
recorded. A zero-game injury history is a valid empty state and should explain
that no injury records exist for this player.

The table reads the typed injury ledger. It must not reconstruct history by
parsing generic event summaries.

## Responsive behavior

### Desktop

- Keep the global league shell visible.
- Use a centered, readable content column with a stable player header.
- Keep tabs visible below the header while content changes.
- Use a two-column Overview layout where the ratings/development content needs
  more room than the compact summary rail.
- Allow Game Log and Season Log tables to scroll horizontally within the page.

### Smaller screens

- Keep player name, overall, availability, and active tab visible near the top.
- Make the tab list horizontally scrollable with the selected tab brought into
  view.
- Collapse the player header into a compact identity row.
- Stack Overview sections in reading order.
- Keep tables horizontally scrollable rather than hiding core statistics.
- Keep row heights and action targets large enough for touch input.
- Do not replace tables with inaccessible card stacks solely to avoid scrolling.

## Interaction and accessibility requirements

- Use semantic tab controls with correct selected and panel relationships.
- Support keyboard navigation through tabs, header controls, and tables.
- Preserve focus when switching tabs and restore focus after returning from an
  action workflow.
- Provide visible focus states and do not use color alone for availability,
  injury, development, or contract status.
- Give progress bars explicit accessible values from 0 to 100.
- Provide a text alternative for the overall-rating graph.
- Use table captions or accessible names that identify the player and table
  purpose.
- Ensure empty, loading, error, blocked-action, and stale-snapshot states are
  understandable without visual styling.
- Respect reduced-motion preferences; tab changes do not need decorative
  animation.

## Required states

The page must handle:

- loading a player from a saved league;
- player not found;
- player exists but has no games;
- player exists but has no archived seasons;
- no current-season projection yet;
- no contract or free-agent status;
- no injury history;
- no value sample or provisional value;
- filtered game log with no matching rows;
- worker or save failure after an action;
- stale player data after another management command;
- unavailable action due to league phase or rule restrictions.

Empty states should explain what is absent and, where useful, link to the next
available action. Avoid generic “No data” labels.

## Data contract

The page should consume the composed `PlayerInformationView` selector from the
V2 simulation package. The view provides:

- player identity and profile;
- current rating and rating history;
- availability;
- normalized contract context;
- rotation context;
- current production and value;
- season logs;
- game log;
- typed injury history;
- recent player-specific events.

Canonical sources remain:

- `optionalData.games` for game records and nested player box scores;
- `history.seasonArchives` for completed seasons;
- `history.injuries` for the typed injury ledger;
- `projections.currentSeason` for rebuildable current-season read models;
- player entities for current ratings, skills, identity, and development state.

React should format and present these values. It should not recalculate
production, value, contract normalization, injury history, or rating history.

## Visual direction

Use the existing product register: precise, calm, trustworthy, and dense where
the task requires density.

- System sans typography and existing V2 tokens.
- Restrained accent color for active tab, primary actions, and semantic status.
- Quiet surfaces and clear separators instead of decorative card grids.
- Consistent Shadcn buttons, tabs, menus, badges, progress bars, and tables.
- No gradients, decorative illustrations, sports-media styling, or oversized
  player-card treatments.
- Let alignment, spacing, and table hierarchy carry the page.

## First-version boundaries

Included:

- dedicated player route;
- five-tab structure;
- overview ratings, skills, development graph, current production, and health
  summary;
- game and season logs;
- contract and Universal Player Value context;
- availability and injury table;
- contextual player actions;
- responsive and accessible states.

Deferred:

- portrait generation or image management;
- plus/minus, on/off, impact, and other unsupported statistics;
- skill-by-skill historical charts beyond the overall-rating graph;
- player comparison mode;
- scouting-specific uncertainty controls;
- player news or narrative feeds;
- full contract negotiation embedded directly in the page;
- advanced trade construction embedded directly in the page.
