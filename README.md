# Front Office Hoops

Front Office Hoops is a browser-based basketball general-manager simulation.
The repository currently contains the playable V1 application and the V2
rewrite/calibration build.

## Current project position

V2 is the primary development direction. It currently provides a foundation
worker/schema/repository round trip and six developer-lab routes across five
active calibration surfaces. It does not yet provide the complete playable
league loop.

V1 remains runnable and contains the existing local multi-season league
experience. V1 and V2 use isolated simulation and save contracts.

Read the [V2 current state](./docs/v2/current-state.md) for the authoritative
implementation matrix and [V2 documentation index](./docs/v2/README.md) for
the ordered rewrite documentation.

## Run the applications

Prerequisites: Node.js 20 or newer and npm 11 or newer.

```bash
npm install
npm run dev
```

The V1 application runs at [http://localhost:3000](http://localhost:3000).
The V2 application runs at [http://localhost:3001](http://localhost:3001).

To run only one application:

```bash
npm run dev --workspace=web
npm run dev --workspace=web-v2
```

In V2, the home page demonstrates the foundation document round trip. Open
Developer Labs to inspect the current simulation workbenches.

## V2 implementation surfaces

- Population & Roster — player generation and deterministic team assembly.
- Game & Matchup — seeded possession simulation, rotations, availability, and reconciliation.
- Production & Value — season fixtures, production aggregation, and universal player value.
- Career Cohort — development, decline, availability, retirement, and matched cohorts.
- Market & Rules — economy, contract demand, offer utility, free agency, target boards, and roster cleanup.

Draft & Decision, the authoritative league shell, lifecycle commands, and the
multi-season League Loop remain planned.

## V1 application

The V1 app remains the current playable local-first experience. It supports
league creation, team selection, regular seasons, playoffs, contracts, trades,
staff, draft, free agency, local saves, and history. V1 details live in the
[V1 documentation index](./docs/README.md) and its [V1 roadmap](./docs/roadmap.md).

## Stack

| Layer | Technology |
| --- | --- |
| Web apps | TanStack Start + React 19 |
| Routing | TanStack Router file-based routes |
| Styling | Tailwind CSS 4 + shadcn/ui |
| V1 simulation | Pure TypeScript in `packages/sim` |
| V2 simulation | Pure TypeScript in `packages/sim-v2` |
| V2 domain/schema | `packages/domain-v2` + `packages/league-schema` |
| Calibration | `packages/calibration` |
| Local persistence | Dexie/IndexedDB in `packages/db` and `packages/db-v2` |
| Workspace | npm workspaces + Turborepo |

## Documentation

See the [documentation index](./docs/README.md) for the complete V1/V2 map.

Useful V2 links:

- [Current State](./docs/v2/current-state.md)
- [V2 Roadmap](./docs/v2/plans/foh-v2-roadmap.md)
- [V2 Lab Strategy](./docs/v2/plans/foh-v2-lab-strategy.md)
- [V2 Product Brief](./docs/v2/specs/foh-v2-product-brief.md)
- [V2 Simulation Architecture](./docs/v2/specs/foh-v2-simulation-architecture.md)

## Scripts

```bash
npm run dev        # Start both web apps through Turborepo
npm run build      # Build all workspaces
npm run test       # Run package tests
npm run typecheck  # TypeScript checks across workspaces
npm run lint       # ESLint across workspaces
npm run format     # Format workspace source files
```

Useful focused commands:

```bash
npm test --workspace=@workspace/sim-v2
npm test --workspace=@workspace/calibration
npm run typecheck --workspace=web-v2
npm run dev --workspace=web-v2
```

## License

TBD
