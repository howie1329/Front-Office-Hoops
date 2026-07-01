# Front Office Hoops

A modern basketball GM simulation game inspired by [Basketball GM](https://basketball-gm.com/) / [ZenGM](https://zengm.com/) — but not a direct clone.

**Web-first. Mobile-friendly. Local-first.**

## Stack

| Layer | Technology |
|-------|------------|
| Web app | [TanStack Start](https://tanstack.com/start) + React 19 |
| Styling | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) |
| Simulation | TypeScript engine (`packages/sim`) |
| Local saves | IndexedDB via [Dexie](https://dexie.org/) |
| Cloud *(planned)* | [Convex](https://convex.dev/) — accounts, sync, realtime, AI backend |
| AI *(planned)* | [Vercel AI SDK](https://sdk.vercel.ai/) — reports, rumors, press conferences |

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create a league, pick your team, and start simulating.

## What's working

- Create and manage multiple local league saves
- Full regular season → playoffs → champion flow
- Standings, schedules, box scores, player stats
- Multi-season history and progression
- Developer Sim Lab and Season Lab

## Documentation

Full project docs live in [`docs/`](./docs/README.md):

- [Vision](./docs/vision.md) — goals and design principles
- [Architecture](./docs/architecture.md) — monorepo structure and data flow
- [Simulation Engine](./docs/simulation-engine.md) — how games and seasons work
- [Data Model](./docs/data-model.md) — types and persistence
- [Development](./docs/development.md) — setup, conventions, testing
- [Roadmap](./docs/roadmap.md) — current status and planned features

## Monorepo structure

```
apps/web/          TanStack Start web app
packages/sim/      Client-side simulation engine
packages/shared/   Shared TypeScript types
packages/db/       IndexedDB persistence (Dexie)
packages/ui/       shadcn/ui components
docs/              Project documentation
```

## Scripts

```bash
npm run dev        # Start development
npm run build      # Production build
npm run test       # Run tests
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

## Adding UI components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Components are placed in `packages/ui/src/components/` and imported as:

```tsx
import { Button } from "@workspace/ui/components/button"
```

## License

TBD
