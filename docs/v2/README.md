# Front Office Hoops v2 Documentation

V2 is the active rewrite and calibration build. V1 remains the existing
playable application and is intentionally kept runnable beside it.

## Current state

V2 currently provides the foundation worker/schema/repository round trip, the
first authoritative league-creation slice, and five active developer-lab
surfaces: Population & Roster, Game & Matchup, Production & Value, Career
Cohort, and Market & Rules. The start flow can generate a league, select a
team, save it locally, reload it, and delete it.

The authoritative league document now supports a thin generated preseason
slice and team selection. In-season lifecycle commands, the full management
shell, Draft & Decision promotion, and the League Loop remain future work.
Market & Rules is the latest active calibration area, with acceptance and
broader league integration still pending.

Read the [V2 current state](./current-state.md) for the implementation matrix,
route inventory, package boundaries, and validation snapshot. Read the
[V2 roadmap](./plans/foh-v2-roadmap.md) for delivery order and replacement
gates.

## Read in this order

### 1. Current state and delivery sequence

- [Current State](./current-state.md) — what exists, what is pending, and what is not built
- [Roadmap](./plans/foh-v2-roadmap.md) — phase sequence and replacement gate
- [Lab Strategy](./plans/foh-v2-lab-strategy.md) — permanent lab boundaries and calibration order

### 2. Product and technical contracts

- [Product Brief](./specs/foh-v2-product-brief.md) — approved product direction and first-v2 target
- [Calendar and Season Lifecycle](./specs/foh-v2-calendar-and-season-lifecycle.md) — agreed calendar, phase, development-report, and simulation-control contract
- [Simulation Architecture](./specs/foh-v2-simulation-architecture.md) — workers, packages, randomness, and simulation boundaries
- [Data and Export Design](./specs/foh-v2-data-and-export-design.md) — canonical document, persistence, events, and portability
- [UI Information Architecture](./specs/foh-v2-ui-information-architecture.md) — target management shell and developer-lab structure
- [Career Cohort Explorer UI Brief](./specs/foh-v2-career-cohort-explorer-ui-brief.md) — current career-lab interaction contract

### 3. Active implementation and calibration plans

- [Game & Matchup Lab](./plans/foh-v2-game-matchup-lab-implementation-plan.md)
- [Production & Value Lab](./plans/foh-v2-production-value-lab-implementation-plan.md)
- [Career Cohort Calibration](./plans/foh-v2-career-cohort-calibration-plan.md)
- [Market & Rules](./plans/foh-v2-contract-market-and-negotiation-plan.md)
- [Draft & Decision Lab](./plans/foh-v2-draft-decision-lab-implementation-plan.md)
- [Draft Board Decision Calibration](./plans/foh-v2-draft-board-decision-calibration-plan.md)
- [Migration and Coexistence](./plans/foh-v2-migration-plan.md)

### 4. Evidence and research

- [Game Calibration Baseline](./audits/foh-v2-game-calibration-baseline.md)
- [Slider Sensitivity Baseline](./audits/foh-v2-slider-sensitivity-baseline.md)
- [Basketball Simulation Reference Study](./research/basketball-sim-reference-study.md)

### 5. Archive

[Archived V2 documents](./archive/README.md) preserve superseded plans and
experiments. They are historical context, not active contracts.
