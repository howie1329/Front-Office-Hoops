# Front Office Hoops

Front Office Hoops is a browser-based basketball general-manager simulation. Build a franchise, manage its roster and staff, navigate the salary cap, simulate seasons, and carry the league’s history forward.

The product is web-first, mobile-friendly, and local-first. The simulation and saves run in the browser without requiring an account or a server connection.

## Current experience

- Create 6-team mini leagues or full 30-team leagues and choose a franchise.
- Simulate regular-season days, weeks, playoffs, and complete seasons.
- Review calendars, standings, schedules, box scores, player stats, injuries, and season history.
- Manage rosters, contracts, cap space, tax, dead money, exceptions, Bird rights, and team strategy.
- Run offseason staff, re-signing, draft, and free-agency phases.
- Hire, fire, and extend staff; staff quality influences team philosophy and development.
- Evaluate and execute trades with player values, draft picks, salary rules, trade exceptions, and AI offers.
- Track player archetypes, development, aging, injuries, retirement, and career history.
- Maintain multiple local league saves and experiment in Sim Lab or Season Lab.

## Stack

| Layer | Technology |
|-------|------------|
| Web app | [TanStack Start](https://tanstack.com/start) + React 19 |
| Routing | TanStack Router file-based routes |
| Styling | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) |
| Simulation | Pure TypeScript engine in `packages/sim` |
| Shared domain | TypeScript types and constants in `packages/shared` |
| Local saves | IndexedDB via [Dexie](https://dexie.org/) in `packages/db` |
| Workspace | npm workspaces + Turborepo |
| Cloud and AI | Planned; Convex and Vercel AI SDK are not integrated yet |

## Quick start

Prerequisites: Node.js 20 or newer and npm 11 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a league, pick a team, and start simulating.

## Documentation

The current project docs live in [`docs/`](./docs/README.md):

- [Vision](./docs/vision.md) — product goals and design principles
- [Architecture](./docs/architecture.md) — monorepo boundaries and data flow
- [Simulation Engine](./docs/simulation-engine.md) — games, seasons, development, and offseason phases
- [Data Model](./docs/data-model.md) — domain types, save shape, and persistence
- [Contract Offer Market](./docs/contract-offer-market.md) — player and staff offer resolution
- [Development](./docs/development.md) — setup, conventions, and testing
- [Roadmap](./docs/roadmap.md) — shipped functionality and remaining work
- [Product](./apps/web/PRODUCT.md) — audience, product vocabulary, and UX principles
- [Design](./apps/web/DESIGN.md) — visual system and accessibility guidance

## Repository structure

```
apps/web/          TanStack Start application and player-facing UI
packages/sim/      Pure client-side simulation engine
packages/shared/   Shared domain types, constants, and save schema
packages/db/       Dexie / IndexedDB persistence and save repository
packages/ui/       Shared shadcn/ui components and styles
docs/              Product, architecture, engine, and development docs
```

## Scripts

```bash
npm run dev        # Start the web app through Turborepo
npm run build      # Build all workspaces
npm run test       # Run package tests
npm run typecheck  # TypeScript checks across workspaces
npm run lint       # ESLint across workspaces
npm run format     # Format workspace source files
```

Useful focused commands:

```bash
npm run test --workspace=@workspace/sim
npm run test --workspace=@workspace/db
npm run dev --workspace=web
```

## License

TBD
