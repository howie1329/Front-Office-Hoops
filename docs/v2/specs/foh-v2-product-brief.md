# Front Office Hoops v2 Product Brief

**Status:** Product direction approved; numerical calibration remains experimental.
**Audience:** Principal product, simulation, and engineering reference for the first rewrite.
**Related:** [v2 roadmap](../plans/foh-v2-roadmap.md), [simulation architecture](./foh-v2-simulation-architecture.md), [data/export design](./foh-v2-data-and-export-design.md).

## Product identity

Front Office Hoops v2 is a browser-hosted, single-player basketball front-office simulation. The user runs one franchise through a fictional professional league that follows a familiar NBA-shaped format while using its own teams, players, histories, and simplified rules.

The product is a GM/front-office simulation first. It is not a coaching simulator, a live basketball game, a multiplayer league, or an AI story generator that invents simulation facts.

## Product decisions already made

| Area | v2 decision |
|---|---|
| Hosting | Browser-hosted; no gameplay backend or accounts in the first release |
| Framework | TanStack Start + React; client-first application |
| Persistence | IndexedDB through Dexie; user-facing JSON import/export |
| Simulation runtime | Web Worker owns active simulation state; UI receives snapshots/events |
| Sharing | JSON save export is the maximum initial sharing feature; no multiplayer/co-op |
| League format | Fixed 30 teams, same locations as the NBA, 82 games, NBA-shaped playoffs and calendar |
| League identity | Fictional/parody team names; no logos/colors/team histories/rivalries initially |
| Rules | Soft cap plus luxury tax; configurable values and growth; no apron system initially |
| Configuration | Standard defaults plus deeper settings at league creation; no mid-league editing initially |
| User agency | User personally handles trades, contracts, draft picks, free agency, staff, and roster cuts |
| AI agency | Baseline AI handles other teams’ required actions; multi-year organization AI is later roadmap work |
| Game control | User sets starters, depth order, and minutes; coaches own tactical philosophy |
| Game presentation | Simulate to a game/date/deadline; completed box scores only, no play-by-play |
| Randomness | Fresh runtime randomness in normal play; explicit seeds for labs/debugging |
| History | Current league snapshot plus event history and retained final box scores |

## Target player

The target player enjoys long-running basketball management games and wants a modern, dense, understandable front-office experience. They want to make consequential roster decisions, see uncertainty without fake precision, understand why the market behaves as it does, and carry a fictional league through multiple seasons.

## Core fantasy

> I am responsible for the direction of a basketball organization, and my decisions create a history worth remembering.

## Product principles

1. **Front office first.** The user manages the roster, contracts, staff, draft, trades, and lineup deployment; the coach manages tactical identity.
2. **NBA-shaped, not NBA-bound.** Preserve familiar structure while choosing simpler fictional rules where they improve clarity and calibration.
3. **Uncertainty is gameplay.** Scouting, potential, health, development, and markets use ranges and confidence rather than precise hidden truth.
4. **Configuration is a product feature.** Users get sensible defaults and deep league-creation settings without choosing the algorithm itself.
5. **Every important outcome is explainable.** Contract decisions, trades, development, injuries, owner goals, and phase blocks return understandable reasons.
6. **The simulation owns truth.** UI state, persistence, and future AI narrative consume authoritative simulation outputs.
7. **Simple first, extensible underneath.** Avoid morale, role promises, advanced CBA, and multi-year AI until the simpler core is stable.
8. **History matters.** Saves preserve what the league is and what happened to it.

## League creation

The user creates the complete league before choosing a team. Generation creates:

- 30 fictional teams in NBA-like locations.
- Market-size categories approximating the real basketball market.
- Owners and owner personalities.
- Head coaches, offensive coaches, defensive coaches, and head scouts.
- Initial players, traits, contracts, financial state, draft assets, and draft class.
- A fresh random runtime state for normal play.

The user then reviews team previews and selects a franchise. Previews should show roster quality, cap position, market size, owner goals/personality, staff, and broad outlook.

## League format and lifecycle

The structural format is fixed for the first v2:

- 30 teams.
- NBA-like conferences and divisions.
- 82-game regular season.
- NBA-shaped playoff field and series length.
- Two-round draft and fixed lottery behavior.
- Familiar trade deadline and offseason rhythm.

The lifecycle has two product-level modes:

```text
IN-SEASON
  preseason → owner goals → regular season → trade deadline → playoffs → season end

OFFSEASON
  contract decisions → staff → re-signing → lottery/draft → free agency → roster completion → preseason
```

Owner goals are set in a phase between offseason and preseason. Every phase has explicit required actions and stop reasons. The user cannot advance when a legal roster or required staff state is impossible—for example, too few eligible players to play or missing required coaches.

Simulation controls are:

- Simulate to next game.
- Simulate to a selected day.
- Simulate to the next meaningful deadline or phase.
- Simulate to the playoffs.
- Simulate to the offseason.

## User-controlled front office

The user personally handles major decisions in the first release:

- Roster cuts and signings.
- Trades.
- Contract offers and negotiations.
- Free agency.
- Draft picks.
- Staff hiring, firing, and contracts.
- Starting lineup, depth order, and target minutes.

There is no delegation-policy system initially. Other teams use baseline AI so the league can function, but the user’s team is not silently managed.

## Coaching and staff

The initial staff has four roles:

1. **Head coach:** offensive philosophy, defensive philosophy, pace, rotation tendency, and development emphasis.
2. **Offensive coach:** modest offensive bonus or penalty when aligned with the head coach/system.
3. **Defensive coach:** modest defensive bonus or penalty when aligned with the head coach/system.
4. **Head scout:** controls scouting error and fog-of-war precision.

Staff traits and deeper effects should be supported by the model but kept small and explainable in the first release.

## Owners and job security

Owners are visible strategic constraints, not transaction vetoes. Owner personality influences spending tolerance, patience, market expectations, and goal selection.

Before each season, the owner assigns exactly three goals:

- One easy goal.
- One medium goal.
- One hard goal.

Goals may involve wins, playoffs, player quality, development, payroll, or roster direction. If the user fails all three goals, they receive one strike. Three strikes results in termination. The first version does not use continuous probability-based job security or mid-season firing.

## Ratings, skills, traits, and positions

### Overall and skills

Use a 0–100 internal/display scale unless calibration experiments show a better scale. The user sees one general overall derived from skills. Overall is not the source of truth; individual skills are.

The user also sees league percentile and rank calculated from overall. Role-fit calculations remain separate and may be used by the coach, trade evaluator, draft AI, and rotation validator.

### Skills versus traits

- **Skills:** basketball abilities such as shooting, finishing, passing, handling, rebounding, defense, stamina, athleticism, and decision-making.
- **Traits:** behavioral/personality tendencies such as hard worker, leader, loyal, undisciplined, volatile, adaptable, or injury-prone.

Players have no more than approximately three traits. Traits are mostly visible, but their exact effect strength is uncertain. Traits are permanent in the first v2 and do not directly add rating points.

### Positions and archetypes

Players have a primary position and optional secondary position. A rotation cannot place a player at an ineligible position.

Generation creates the player first from a correlated physical/skill/trajectory profile. A primary and optional secondary archetype are assigned afterward from the completed profile. Archetype quotas do not drive roster generation.

## Scouting and fog of war

The user knows their own players’ current information fairly well but does not know exact potential, development risk, or future role. Other teams, free agents, and draft prospects are uncertain.

The head scout affects only fog-of-war accuracy in the first release:

- Poor scout: wider and less accurate ranges.
- Strong scout: narrower and more accurate ranges.
- No reports, interviews, or year-round scouting workflow initially.

Draft screens show scouting ranges, potential ranges, mock-draft projections, production, measurements, role projection, and uncertainty. Exact true ratings are never shown during the normal draft experience.

## Player value and production

V2 uses a visible universal player value plus explicit context modifiers.

```text
Universal player value
  = current ability + simple recent production + age/trajectory
    + potential/upside + durability + scarcity context

Trade value
  = player value + contract adjustment + simple team-fit adjustment
```

Player value is visible. Contract value and trade adjustments can be exposed through an advanced setting and explained in the UI.

Recent production uses a deliberately simple, role-adjusted, multi-season box-score composite based on:

- Scoring and shooting efficiency.
- Assists and turnovers.
- Rebounding.
- Steals and blocks.
- Games and minutes played.
- Basic role context.

Production influences value and contract demand without automatically rewriting true skill ratings.

## Contracts and free agency

The first cap model is a configurable soft cap with a luxury tax. Cap amount, tax line, salary minimum/maximum, and annual growth are league-creation settings. Aprons, sign-and-trades, and complex NBA exceptions are deferred.

Contract demand may consider:

- Player value.
- Current and recent production.
- Age, projection, and durability.
- Previous salary and comparable contracts.
- Market supply/demand and available cap room.
- Player preferences such as money, market size, winning organization, and recent team success.

Role guarantees, playing-time security, and role-fulfillment morale are explicitly deferred.

Free agency uses three fixed stages:

1. AI teams submit offers.
2. The user sees those offers and submits offers.
3. The player accepts the best internal contract utility or waits for the next stage.

The UI shows terms and labels such as “strong interest” or “competitive offer,” not the exact internal contract score. An advanced league setting may reveal the score and breakdown.

## Draft

The draft is a single day with two rounds. The user starts the draft and may:

- Simulate to the next pick.
- Simulate to the user’s next pick.
- Simulate to the end of the draft.

At user picks, manual selection is available. If the user simulates, the baseline AI selects the best available player using public scouting, mock draft, team need, team mode, and rookie contract value. More sophisticated multi-year drafting is later work.

## Game and rotation experience

The user does not coach games live. They set starters, depth order, and target minutes. The coach controls pace, offensive philosophy, defensive philosophy, and rotation tendency.

Games produce final box scores, player game logs, standings changes, injuries, and important event metadata. There is no play-by-play or live game interface in the first v2.

## Configuration at league creation

Every league starts from standard recommended settings. Advanced settings can alter the experience before generation begins.

Configurable groups include:

- Game environment: pace, offense, defense, shot mix, free throws, turnovers, rebounds, variance.
- Player generation: talent level, star frequency, class variance, archetype/position distributions, age and physical variance.
- Development: volatility, breakout frequency, aging, late-bloomer frequency.
- Injuries and retirement: frequency, severity, recovery, career-length behavior.
- Economy: cap, tax, growth, salaries, market volatility, contract continuity.
- Trade market: AI aggressiveness and acceptance volatility.
- Owner/staff behavior: within validated bounds.

Users do not choose the generation algorithm or edit unconstrained internal constants.

## Persistence, export, and history

The save is a first-class versioned JSON document stored locally through Dexie/IndexedDB. It contains:

- Current canonical league snapshot.
- Resolved league-creation settings.
- Players, teams, owners, staff, contracts, draft assets, and financial state.
- Event history.
- Season archives and records.
- Final box scores and player game logs.
- Optional diagnostics and storytelling data.

Normal gameplay uses fresh randomness; explicit seed/replay mode is for labs and debugging. A saved completed result is authoritative and is not rerolled after it has been persisted.

## Explicit first-v2 non-goals

- Multiplayer, co-op, accounts, cloud saves, or live shared leagues.
- Server-side gameplay simulation.
- Real-time coaching or play calling.
- Play-by-play storage or presentation.
- Role promises, playing-time security, or morale systems.
- Advanced NBA aprons, sign-and-trades, complex exceptions, and multi-team trades.
- Year-round draft scouting reports, interviews, and workouts.
- Multi-year organizational AI.
- AI-generated narrative in the first playable release.
- Random team branding, logos, rivalries, or inherited history.

## Minimum viable playable loop

Create league settings → generate the complete league → choose a team → review owner/staff/goals → set rotation → simulate games and deadlines → manage injuries, trades, contracts, and staff → enter playoffs → process owner evaluation → run the three-stage offseason → draft and complete free agency → set new owner goals → begin the next season → export/import the league → inspect box scores, events, history, and player values.

## Readiness bar

The first v2 is ready for broader use only when it can run at least ten seasons with:

- Valid rosters and phase gates.
- Reconciled box scores and payroll.
- Stable game, player, development, injury, and salary distributions.
- No unexplained contract extremes in benchmark markets.
- Reliable JSON round-trip and migration behavior.
- Responsive simulation through a Web Worker.
- User-facing explanations for blocked actions and major outcomes.
