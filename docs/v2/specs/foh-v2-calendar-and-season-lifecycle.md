# Front Office Hoops v2 — Calendar and Season Lifecycle

**Status:** Product direction agreed; implementation contract pending
**Scope:** Calendar, season phases, offseason sequencing, annual development transition, league-wide transition reporting, and simulation-control boundaries.
**Related:** [Product Brief](./foh-v2-product-brief.md), [Simulation Architecture](./foh-v2-simulation-architecture.md), [V2 Roadmap](../plans/foh-v2-roadmap.md)

## 1. Product decision

V2 uses a date-based season calendar as the canonical clock.

Games are scheduled events on the calendar. Phases determine which actions
are available. Game numbers are useful display information, but they are not
the primary source of time because teams can play on different dates and
league-wide deadlines are date-based.

The calendar must support:

- Regular-season and postseason games.
- Six preseason games per team.
- Multiple games on the same date.
- Dates without games.
- Injuries that last across dates and seasons.
- League-wide deadlines such as the trade deadline.
- Future team-scheduled exhibition games.
- Offseason phases that advance by dates and checkpoints rather than games.

## 2. Season structure

```text
Preseason
  → annual development transition
  → six exhibition games per team

Regular season
  → 82 games per team
  → trade deadline
  → final regular-season date

Playoffs
  → play-in tournament
  → conference playoffs
  → finals

Offseason
  → season review
  → staff signing and re-signing
  → player re-signing
  → draft
  → free agency stage one
  → free agency stage two
  → free agency stage three
  → preseason
```

There is no separate roster-completion phase. Entering preseason performs a
roster legality check. If a team is invalid, the transition is blocked with an
actionable explanation.

## 3. Recommended calendar cadence

The default cadence should follow the shape of the NBA calendar while keeping
dates configurable per league. As a reference point, the [2025–26 NBA regular
season schedule](https://www.nba.com/news/2025-26-nba-regular-season-schedule)
opened October 21, ended April 12, had a February 5 trade deadline, and began
playoffs on April 18 after the play-in tournament. The [NBA key dates
calendar](https://www.nba.com/key-dates) is the reference for future cadence
reviews.

V2's initial calendar recommendation:

| Period | Default window or rule |
| --- | --- |
| Preseason | October 1–19 |
| Regular season | Around October 21–April 12 |
| Trade deadline | First Thursday in February, around 3 p.m. |
| Play-in | Three to four days after the regular season |
| Playoffs | Immediately after the play-in |
| Season review | First day after the Finals |
| Staff period | Seven days |
| Re-signing period | Seven days |
| Draft | One day |
| Free agency | Three separate stages, one day each initially |
| Next preseason | October 1 |

The calendar should use a configurable season anchor rather than permanently
hardcoding one real-world year's dates.

## 4. Preseason

Preseason contains six games per team. These are exhibition games and do not
affect regular-season standings, records, or playoff eligibility.

Preseason games:

- Use the same game engine as regular-season games.
- Can create injuries and player-performance events.
- Are marked `kind: "preseason"`.
- Are scheduled across the preseason date window.
- Are available through the same date-based simulation controls.

Six games per team creates 90 exhibition games across a 30-team league. The
league should not use six total exhibition games because that would leave most
teams without a preseason schedule.

## 5. Annual development transition

Annual development happens on the first day of preseason. It is not a separate
user-facing phase.

When the league enters preseason, the runtime should atomically:

1. Apply development, regression, or plateau outcomes to every player.
2. Recalculate player ratings and derived overalls.
3. Recalculate team overalls and league projections.
4. Recalculate payroll and roster summaries where applicable.
5. Store before-and-after values for the transition.
6. Generate a league-wide transition report.
7. Save the updated league before making preseason games available.

The transition should be represented by a command such as `BeginPreseason`,
with a recorded event such as `annual-development.completed`.

The user should not watch individual development rolls. The user sees the
resulting report and can inspect exact changes on their own roster.

## 6. League-wide transition report

The report is generated after annual development has been applied and is
persisted with the league for later review.

### Biggest changes

- Top 10 team risers by overall delta.
- Top 10 team fallers by overall delta.
- Top 10 player risers by overall delta.
- Top 10 player fallers by overall delta.

### Current landscape

- Top 10 teams by current overall.
- Bottom 10 teams by current overall.
- Top 10 players by current overall.
- Bottom 10 players by current overall.

Each row should include:

- Name.
- Previous overall, when applicable.
- New overall.
- Delta.
- Team for players.
- A short explanation such as development, regression, or plateau.

For players outside the user's team, the report should use public or scouted
values rather than reveal hidden exact development information. The user's own
roster may show exact changes.

## 7. Phase permissions

Phase rules are enforced by lifecycle commands and are also reflected in the
UI.

| Phase | Games | Trades | Extensions | Primary actions |
| --- | --- | --- | --- | --- |
| Preseason | Exhibition only | Limited or off | Off | Review development, play exhibitions |
| Regular season | 82 per team | On until deadline | On | Play games, manage roster |
| Play-in and playoffs | Postseason | Off | Off | Advance postseason games |
| Staff | None | Off | Off | Hire and retain staff |
| Re-signing | None | Limited | Re-signing rules | Handle expiring players |
| Draft | Draft event | Off | Off | Make draft selections |
| Free agency 1–3 | None | Off or limited | Off | Run the three market stages |

The initial product rule for extensions is that they are available during the
regular season and unavailable during the playoffs. Trades close at the trade
deadline and remain unavailable through the playoffs.

## 8. Calendar and schedule data

The authoritative document should eventually contain a calendar and schedule
similar to:

```ts
{
  currentDate: "2025-10-21",
  phase: "regular-season",
  schedule: [
    {
      id: "game-001",
      date: "2025-10-21",
      kind: "regular-season",
      homeTeamId: "team:01",
      awayTeamId: "team:02",
      status: "scheduled"
    }
  ],
  milestones: {
    tradeDeadline: "2026-02-05",
    regularSeasonEnd: "2026-04-12",
    playoffsStart: "2026-04-18"
  }
}
```

Injuries should use dates as their source of truth:

```ts
{
  playerId: "player:001",
  startsOn: "2025-11-03",
  returnsOn: "2025-11-12"
}
```

Games missed can then be derived from the schedule instead of being the only
stored duration.

## 9. Simulation and phase controls

Simulation controls process calendar time and scheduled games:

- **Next game:** advance to the user's next scheduled game.
- **Next day:** process all games and events on the next calendar date.
- **Next key date:** advance to the next meaningful milestone.
- **Trade deadline:** simulate until the trade deadline.
- **End regular season:** finish all remaining regular-season games.
- **Next playoff game:** advance through the postseason schedule.
- **Simulate playoffs:** finish the remaining postseason schedule.

Phase controls process management checkpoints without pretending that the user
is simulating games:

- Complete season review.
- Advance through staff.
- Advance through re-signing.
- Run the draft.
- Run free-agency stage one.
- Run free-agency stage two.
- Run free-agency stage three.
- Enter preseason.

Every control sends an authoritative command to the worker. The worker
processes all intermediate dates, games, injuries, AI actions, and events; it
does not teleport the document directly to the destination date.

## 10. Initial implementation sequence

The first lifecycle implementation should proceed in this order:

1. Add a real calendar and schedule to `LeagueDocument`.
2. Generate six preseason games per team and 82 regular-season games per team.
3. Add phase and milestone validation.
4. Implement `BeginPreseason` with annual development and report generation.
5. Implement date-based advancement through preseason and regular season.
6. Implement trade-deadline and extension permission gates.
7. Add worker progress, event persistence, and save checkpoints.
8. Add temporary simulation controls to the existing league shell.
9. Design the final dashboard after the lifecycle behavior is proven.

The first command to define in detail is `BeginPreseason` because it connects
offseason completion, annual player development, the league-wide report, and
the preseason schedule.
