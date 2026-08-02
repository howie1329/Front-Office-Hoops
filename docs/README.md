# Front Office Hoops — Documentation

The repository contains two applications. V2 is the active rewrite and
calibration build; V1 is the existing playable local league application.

## Start with V2

| Document | Description |
| --- | --- |
| [V2 Current State](./v2/current-state.md) | Implementation matrix, route inventory, package boundaries, and validation snapshot |
| [V2 Documentation](./v2/README.md) | Ordered V2 documentation navigator |
| [V2 Roadmap](./v2/plans/foh-v2-roadmap.md) | Delivery sequence and replacement gate |
| [V2 Lab Strategy](./v2/plans/foh-v2-lab-strategy.md) | Permanent calibration surfaces and promotion rules |
| [V2 Product Brief](./v2/specs/foh-v2-product-brief.md) | Approved product direction and first-v2 target |
| [V2 Simulation Architecture](./v2/specs/foh-v2-simulation-architecture.md) | Worker, domain, simulation, persistence, and randomness boundaries |
| [V2 Data and Export Design](./v2/specs/foh-v2-data-and-export-design.md) | Canonical document, events, validation, and portability |
| [V2 UI Information Architecture](./v2/specs/foh-v2-ui-information-architecture.md) | Target league shell, management screens, and lab structure |

## V1 reference documentation

These documents describe the existing playable application and its V1 package
contracts. They are not V2 implementation guidance.

| Document | Description |
| --- | --- |
| [Vision](./vision.md) | Product goals and long-term principles |
| [Product Brief](./product-brief.md) | V1 audience, promise, scope, and readiness bar |
| [Architecture](./architecture.md) | V1 monorepo boundaries and data flow |
| [Simulation Engine](./simulation-engine.md) | V1 game, season, development, and offseason behavior |
| [Data Model](./data-model.md) | V1 domain types and persistence shape |
| [Contract Offer Market](./contract-offer-market.md) | V1 player and staff offer resolution |
| [Development](./development.md) | Setup, conventions, scripts, and tests |
| [Roadmap](./roadmap.md) | V1 shipped functionality and remaining work |
| [V1 Current-State Audit](./audits/foh-v1-current-state-audit.md) | Historical V1 repository audit |

## Repository layout

```text
Front-Office-Hoops/
├── apps/web/          # Existing playable V1 application
├── apps/web-v2/       # V2 foundation and developer-lab application
├── packages/
│   ├── domain-v2/     # V2 entities and report types
│   ├── league-schema/ # V2 schemas, validation, serialization, migrations
│   ├── sim-v2/        # V2 simulation modules
│   ├── calibration/   # V2 seeded labs and benchmark reports
│   ├── db-v2/         # V2 Dexie/IndexedDB repository
│   ├── shared/        # V1 shared domain types and constants
│   ├── sim/           # V1 simulation engine
│   └── ui/            # Shared UI primitives
└── docs/              # V1 reference and V2 rewrite documentation
```

Use [V2 Current State](./v2/current-state.md) before relying on any status
claim elsewhere in the repository.
