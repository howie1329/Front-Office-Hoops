# V2 Career Cohort Explorer — UI Brief

**Status:** Implemented interaction contract; calibration acceptance pending<br>
**Last reviewed:** August 1, 2026<br>
**Surface:** `/developer-labs/development-cohorts`  
**Register:** Developer calibration tool  
**Companion:** [V2 Career Cohort Calibration](../plans/foh-v2-career-cohort-calibration-plan.md)

## Product intent

Turn the current Career Cohort Harness from a comparison page into a cohort
exploration workspace. The primary job is to follow one generated cohort,
select individual players from it, inspect their complete development and
decline timelines, and understand each player relative to the cohort
distribution.

Comparison remains useful, but it becomes a secondary analysis mode rather
than the page's organizing principle.

The surface is developer-only. It may show hidden peak age, decline age,
growth curve, decline curve, potential forecast, transition events, retirement
factors, and other diagnostics that must remain hidden in gameplay.

## Primary user workflow

```text
configure development scenario
  → run deterministic cohort
  → inspect cohort distribution
  → select a player
  → inspect the player career timeline
  → compare the player to cohort percentiles
  → export the cohort or selected-player evidence
```

The interface should make the selected cohort and selected player persistent
and obvious at all times.

## Information architecture

### Run header

The header is a compact command surface containing:

- Lab name and developer-only badge
- Current run status and worker progress
- Run ID
- Deterministic seed
- Cohort label and resolved curve settings
- Last completed run time
- Run, cancel, reset, and export actions

The header should make it clear whether the visible result is current,
running, failed, or stale after a settings change.

### Settings panel

Use grouped, progressive controls rather than a long list of raw settings.

#### Cohort definition

- Cohort mode: single cohort, individual trace, or matched comparison
- Population source: young/draft, roster, free agent, veteran fixture
- Starting age or named age cohort
- Sample size
- Career horizon: 1, 5, 10, 20, or 30 years
- Deterministic seed

#### Development rules

- Development profile: standard, high potential, low potential, high
  volatility
- Growth curve: generated distribution or forced slow/standard/fast/elite
- Decline curve: generated distribution or forced durable/standard/early/steep
- Peak-age distribution preset
- Decline-onset distribution preset

#### Environment

- Minutes opportunity: zero, low, typical, high
- Injury/availability: healthy, normal, injured
- Coaching development support: weak, standard, strong

#### Diagnostics and export

- Show hidden truth
- Retain outliers
- Export profile: summary, selected player, full debug
- Benchmark profile, when available

Controls should show short descriptions of what they affect. Raw multipliers,
random scopes, latent talent, and true potential values do not belong in the
default settings surface.

### Cohort overview

After a run, the first evidence surface should summarize the selected cohort:

- Player count
- Active and retired counts
- Average and percentile growth to peak
- Average peak and decline ages
- Growth-curve and decline-curve composition
- Availability and injury burden
- Retirement-age distribution
- Potential forecast versus realized peak
- Bust and breakout rates

Use dense summary rows and charts with explicit labels. Avoid a repeated grid
of decorative metric cards.

### Player index

The player index is the central new interaction. It should be a searchable,
sortable, filterable table backed by the compact cohort player index.

Recommended columns:

- Player ID or generated name
- Starting age
- Starting ability
- Potential forecast
- Growth curve
- Decline curve
- Peak age
- Realized peak
- Final ability
- Seasons simulated
- Retirement status/age
- Outlier marker

Recommended filters:

- Growth curve
- Decline curve
- Current phase at selected season
- Retired versus horizon-complete
- Starting-ability band
- Potential-gap band
- Largest improvement or decline
- Availability band

Rows must be keyboard-selectable. The selected row needs a clear non-color
state and should remain selected while the user changes the focused season.
Use virtualization or pagination for large cohorts; never render every full
timeline in the table.

### Selected-player detail

The selected-player area should contain four coordinated views:

1. **Career chart**
   - Current ability trajectory
   - Cohort mean and percentile band overlay
   - Potential forecast reference
   - Growth, plateau, and decline phase bands
   - Peak-age and decline-start markers
   - Retirement marker
   - Clickable season points

2. **Player summary**
   - Starting and final ability
   - Peak ability and realized peak age
   - Potential forecast
   - Growth and decline curves
   - Plateau length
   - Availability and retirement state

3. **Season inspector**
   - Entering-season age and ability
   - All eight skill values
   - Skill deltas for the season
   - Games played, minutes, and availability
   - Active curve traits and phase
   - Injury-development penalty
   - Retirement probability and factor explanations

4. **Event history**
   - Development events
   - Curve-transition events
   - Phase changes
   - Injury effects
   - Retirement decision

The chart and season table must select the same season. A selected season
should be deep-linkable or at least preserved while the user navigates within
the run.

### Cohort distributions

The cohort view should answer “how common is this career?” without requiring
the user to inspect every player. Include:

- Mean, median, p10, and p90 skill trajectories
- Overall-ability percentile bands
- Growth-to-peak distribution
- Peak-age distribution
- Decline severity distribution
- Retirement-age distribution
- Survival/active-player count by season
- Curve-tier outcome comparison

The selected player should be overlaid on these distributions. A full
spaghetti plot of every player is not the default; offer it only as an
explicit debug view for smaller cohorts.

### Comparison mode

Comparison should be an explicit secondary mode with:

- Cohort A and B settings shown side by side
- A matched-variable summary identifying what differs
- Dual percentile/mean trajectories
- Outcome delta table
- Optional selected-player trace from each cohort

The UI must warn when multiple variables differ, such as age, injury, and
growth curve. The user should be able to run a one-variable counterfactual
without rebuilding a second unrelated preset.

## Responsive behavior

### Desktop

Use a dense three-region workspace:

- Left: sticky settings rail
- Center: cohort overview and player index
- Right: sticky selected-player inspector

The full-width lower area can hold cohort distributions and event history.
Keep the player identity and selected season visible while scrolling.

### Mobile and narrow windows

Collapse into four tabs or stacked sections:

1. Settings
2. Cohort
3. Players
4. Selected player

Keep the selected player and run status in a sticky compact header. Tables may
scroll horizontally, but identity and selection controls must remain usable.

## Loading, empty, error, and stale states

- **Initial:** explain that a deterministic cohort run is required and provide
  the default run action.
- **Running:** show worker progress by cohort/player count with a safe cancel
  action.
- **Stale:** when controls change after a completed run, label the displayed
  report as generated from previous settings until rerun.
- **Error:** preserve the last valid report, show the failed setting or seed,
  and provide rerun/reset actions.
- **Empty index:** explain that no players matched the filters and provide a
  clear reset-filter action.
- **Retired trace:** label the retirement season as the beginning-of-season
  terminal snapshot and distinguish it from the last fully developed season.

## Export behavior

Provide explicit export profiles:

- **Summary:** resolved settings, cohort metrics, trajectories, and player
  index.
- **Selected player:** summary plus one full timeline and relevant cohort
  context.
- **Full debug:** all retained timelines, hidden truth, events, diagnostics,
  random mode/scopes, and failed seeds.

Every export must include:

- Bundle schema and report version
- Unique run/export identifier
- Engine/config version
- Resolved settings
- Seed and cohort definitions
- Selected player ID, if applicable
- Whether hidden diagnostics are included

Compact exports should reference outliers and selected players by ID rather
than duplicating full timeline objects.

## Component and interaction rules

- Reuse `@workspace/ui` controls, badges, tables, buttons, and labels.
- Use the shared TanStack Table contract when available; support sorting,
  filtering, virtualization/pagination, keyboard selection, and visible-row
  JSON/CSV export.
- Do not add a chart dependency for the initial explorer. Continue using the
  existing lightweight chart approach unless a specific accessibility or
  interaction requirement proves it insufficient.
- Use semantic state colors, but never rely on color alone for phase, status,
  or selection.
- Preserve visible focus rings and readable contrast.
- Support keyboard navigation from settings to player index to season detail.
- Respect reduced-motion preferences; transitions should communicate state,
  not decorate the page.
- Keep the density and restrained visual language of the developer labs. This
  is a calibration tool, not a sports-media dashboard or player-card gallery.

## Required report/UI seam

The UI should consume typed report projections rather than calculate career
rules. The report boundary should provide:

- Cohort summary and percentile trajectories
- Compact `CareerPlayerSummary` index
- Selected-player full timeline
- Resolved settings
- Failed seeds and outliers
- Benchmark results when present

The route may derive display formatting and filter state, but it must not own
curve multipliers, retirement rules, random scopes, or development formulas.

## Non-goals

- No gameplay-facing display of hidden curve traits or true potential.
- No direct production-based development control.
- No archetype/physical coupling for curve assignment in this iteration.
- No full league-history screen inside the lab.
- No second simulation implementation in React.
- No decorative visualization that cannot answer a development or decline
  question.

## UI completion criteria

The explorer is ready for implementation review when a seeded run can:

1. Configure development and decline settings independently.
2. Run one cohort without requiring a comparison cohort.
3. Search and select any indexed player.
4. Overlay that player's career against cohort percentile bands.
5. Inspect any season's skills, development inputs, availability, phase, and
   retirement factors.
6. Explain curve changes through visible events.
7. Export the selected player and cohort evidence with resolved settings.
8. Work with a 1,000-player cohort without rendering or duplicating every
   full timeline in the visible table.
9. Preserve keyboard access, responsive behavior, readable contrast, and
   explicit loading/error/stale states.
