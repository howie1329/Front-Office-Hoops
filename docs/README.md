# Front Office Hoops — Documentation

Documentation for Front Office Hoops, a simulation-first basketball general-manager game.

## Quick links

| Document | Description |
| --- | --- |
| [Vision](./vision.md) | Product goals, principles, and boundaries |
| [Product Brief](./product-brief.md) | Product audience, promise, scope, current state, and readiness bar |
| [Architecture](./architecture.md) | Monorepo layout, package boundaries, routes, and data flow |
| [Simulation Engine](./simulation-engine.md) | Game, season, development, playoff, and offseason behavior |
| [Data Model](./data-model.md) | Domain types, save shape, and browser persistence |
| [Contract Offer Market](./contract-offer-market.md) | Player and staff negotiation behavior |
| [Development](./development.md) | Local setup, scripts, conventions, and tests |
| [Roadmap](./roadmap.md) | Current implementation status and remaining work |

## Project at a glance

- **Web-first and mobile-friendly** — a TanStack Start application with responsive league-office workflows.
- **Local-first** — simulation and league saves run in the browser using IndexedDB/Dexie.
- **Simulation-first** — pure, seeded TypeScript logic in `@workspace/sim` owns game and league outcomes.
- **Front-office depth** — rosters, contracts, cap/tax rules, trades, staff, scouting, draft, re-signing, free agency, development, and history are implemented across the engine and local UI.
- **Optional future services** — Convex cloud features and Vercel AI SDK narrative features remain planned, not integrated.

## Repository layout

```
Front-Office-Hoops/
├── apps/web/          # TanStack Start app and UI routes
├── packages/
│   ├── db/            # Dexie / IndexedDB persistence
│   ├── shared/        # Shared domain types and constants
│   ├── sim/           # Pure simulation engine and Vitest tests
│   └── ui/            # Shared shadcn/ui components
└── docs/              # Project documentation
```

## Current status

The app supports a full local league lifecycle: create a league, choose a team, simulate the regular season and playoffs, manage the roster and staff, navigate re-signing, draft, and free agency, evaluate trades, advance multiple seasons, and review history. The engine also includes seeded game simulation, player development, injuries, archetypes, scouting uncertainty, contracts, financial AI, draft classes, owner goals, staff lifecycle, and player value models.

See [Roadmap](./roadmap.md) for the shipped foundation, product-readiness work, and longer-term direction.
