# Front Office Hoops v2 Documentation

This folder contains the product, architecture, research, specification, experiment, and migration documents for the v2 rewrite. The documents under `docs/` outside this folder describe the existing v1 application unless explicitly linked otherwise.

## Current status

V2 document/schema/repository foundations and the player-generation and roster-assembly groundwork are complete. Distributional player-generation calibration acceptance remains pending. The current player-universe groundwork includes structured identities and league statuses, population presets, 450 rostered players, 100 free agents, 90 draft prospects, and deterministic 30-team roster assembly.

The next work is calibration rather than the full league shell:

1. Game simulation calibration.
2. Production composite and visible universal player value.
3. Initial league shell and complete league-creation flow.

V1 remains runnable during this work. See the [V2 roadmap](./plans/foh-v2-roadmap.md) for the authoritative sequence and replacement gate.

## Start here

- [Product Brief](./specs/foh-v2-product-brief.md)
- [Roadmap](./plans/foh-v2-roadmap.md)
- [Simulation Architecture](./specs/foh-v2-simulation-architecture.md)
- [Data and Export Design](./specs/foh-v2-data-and-export-design.md)
- [UI Information Architecture](./specs/foh-v2-ui-information-architecture.md)

## Plans and research

- [Migration Plan](./plans/foh-v2-migration-plan.md)
- [Experiment Backlog](./plans/foh-v2-experiment-backlog.md)
- [Production & Value Lab Implementation Plan](./plans/foh-v2-production-value-lab-implementation-plan.md)
- [Contract Market & Negotiation Plan](./plans/foh-v2-contract-market-and-negotiation-plan.md)
- [Game & Matchup Lab Implementation Plan](./plans/foh-v2-game-matchup-lab-implementation-plan.md)
- [Current-State Audit](./audits/foh-current-state-audit.md)
- [Basketball Simulation Reference Study](./research/basketball-sim-reference-study.md)
