# Front Office Hoops v2 — League Lifecycle Implementation Plan

**Status:** Approved; first implementation slice complete  
**Scope:** League structure, date-based scheduling, new-save bootstrap, and the first lifecycle command slice.  
**Authority:** This plan turns the agreed product decisions into implementation order. The calendar product contract remains in [Calendar and Season Lifecycle](../specs/foh-v2-calendar-and-season-lifecycle.md).

## Product outcome

When a user creates a new league, V2 will:

1. Create the league structure first: two conferences, three divisions per conference, and five teams per division.
2. Assign the 30 generated teams to stable, explicit conference and division memberships.
3. Generate players, rosters, contracts, staff, and draft assets against those team IDs.
4. Generate six preseason games per team and an 82-game regular-season schedule.
5. Skip the preseason for a brand-new save because the initial generated ratings are already opening-day ratings.
6. Open the save on the first regular-season date, then let the user select a team.
7. Show conference and division in the team-selection table.

## League structure contract

The initial structure is NBA-shaped but fictional:

| Conference | Divisions                     | Teams per division |
| ---------- | ----------------------------- | ------------------ |
| Eastern    | Atlantic, Central, Southeast  | 5                  |
| Western    | Northwest, Pacific, Southwest | 5                  |

Team membership is deterministic and stored on both the team and the league
structure. It is not re-rolled after player generation. This keeps schedules,
standings, standings filters, and future playoff qualification stable.

The schema must enforce:

- exactly 30 teams for the standard generated league;
- two conferences;
- three divisions per conference;
- five teams per division;
- unique team membership;
- every team's conference and division references an existing structure entry.

## Calendar contract

The calendar is the canonical clock. It stores:

- `currentDate`;
- phase and offseason subphase;
- preseason and regular-season windows;
- trade-deadline, regular-season-end, and playoff-start milestones;
- dated schedule entries with kind, matchup, and status.

The initial defaults use October 1 as preseason opening and October 21 as
regular-season opening, with a configurable season anchor. The first Thursday
in February is the trade deadline. The regular season ends April 12 and the
postseason starts April 18 in the default cadence.

## Schedule contract

The standard generated schedule contains:

- six preseason games per team, or 90 games league-wide;
- 82 regular-season games per team;
- 16 games against division opponents;
- 36 games against other teams in the same conference;
- 30 games against the opposite conference;
- no self-matchups or double-booked teams on a schedule date;
- deterministic ordering from the league seed;
- balanced home/away assignment.

Preseason games do not affect regular-season standings. The schedule is stored
as data first; later simulation commands will consume it by date rather than
by a synthetic game counter.

## New-save bootstrap

New saves begin at the first regular-season date. Creation does not apply the
annual development transition because there is no prior season to transition
from. The first annual development transition occurs after Season 1, on the
first day of the next preseason, through `BeginPreseason`.

`BeginPreseason` will later validate offseason completion and roster legality,
apply development/regression/plateau, recalculate player and team summaries,
persist the league-wide transition report, generate the next preseason
schedule, and atomically enter preseason.

## Lifecycle command sequence

Implementation proceeds in this order:

1. Add structure, calendar, schedule, and phase types to the domain contract.
2. Extend strict schema validation for those types.
3. Add deterministic structure assignment before player generation.
4. Add schedule generation and calendar milestones.
5. Bootstrap new saves into regular-season opening day.
6. Add standings-ready projections and dated game results.
7. Implement `BeginPreseason` and annual development reporting.
8. Implement date-based advancement commands: next day, next game, next key date, deadline, end regular season, and postseason controls.
9. Add phase permission gates for trades and extensions.
10. Add temporary simulation controls to the league shell, then design the final dashboard around proven lifecycle behavior.

## Acceptance criteria for this slice

- Creating the same league with the same seed produces the same structure, calendar, schedule, rosters, and previews.
- The generated document passes strict schema validation.
- Every team preview includes conference and division.
- The generated document opens in `regular-season` on its regular-season opening date.
- Schedule invariants are tested for counts, membership, dates, and home/away balance.
- Existing foundation, creation, repository, and worker tests continue to pass.

## Implementation status

Completed in the first slice:

- Domain and strict-schema contracts for league structure, phases, calendar, and schedule entries.
- Deterministic two-conference/six-division/five-team structure assignment.
- Seeded six-game-per-team preseason schedule.
- Seeded 82-game-per-team regular-season schedule with division, conference, and cross-conference matchup counts.
- New-save bootstrap at regular-season opening day.
- Team-selection previews and league shell display conference, division, phase, and current date.

Still pending from this plan:

- Worker-driven date advancement and game-result persistence.
- Standings and playoff lifecycle integration.
- `BeginPreseason`, annual development transition, and league-wide transition report.
- Trade-deadline and extension permission commands.
