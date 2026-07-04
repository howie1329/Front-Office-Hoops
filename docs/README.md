# Front Office Hoops — Documentation

Documentation for **Front Office Hoops**, a modern basketball GM simulation game inspired by Basketball GM / ZenGM — but not a direct clone.

## Quick links

| Document                                    | Description                                        |
| ------------------------------------------- | -------------------------------------------------- |
| [Vision](./vision.md)                       | Product goals, principles, and design philosophy   |
| [Architecture](./architecture.md)           | Monorepo layout, package boundaries, and data flow |
| [Simulation Engine](./simulation-engine.md) | How games, seasons, and playoffs are simulated     |
| [Data Model](./data-model.md)               | Domain types, save format, and local persistence   |
| [Development](./development.md)             | Local setup, scripts, conventions, and testing     |
| [Roadmap](./roadmap.md)                     | What's built today and what's planned next         |

## Project at a glance

- **Web-first, mobile-friendly, local-first** — runs in the browser with offline-capable saves
- **TanStack Start + Tailwind + shadcn/ui** — full-stack React app with a shared UI package
- **TypeScript simulation engine** — pure, testable logic in `@workspace/sim`
- **IndexedDB / Dexie** — local league saves via `@workspace/db`
- **Convex** _(planned)_ — optional cloud sync, accounts, realtime, and AI orchestration
- **Vercel AI SDK** _(planned)_ — AI-generated media, reports, rumors, press conferences

## Repository layout

```
Front-Office-Hoops/
├── apps/
│   └── web/              # TanStack Start web app
├── packages/
│   ├── db/               # Dexie / IndexedDB persistence
│   ├── shared/           # Shared TypeScript types and constants
│   ├── sim/              # Client-side simulation engine
│   └── ui/               # shadcn/ui component library
└── docs/                 # You are here
```

## Current status

The prototype has a working **league lifecycle**: create a league, pick a team, simulate days/weeks/seasons, view standings and stats, play through playoffs, archive seasons, and manage multiple local saves. The sim engine now includes aggregate box-score simulation, role-based rotations, player archetypes, injuries, development, contracts/cap, draft, re-signing, free agency, and financial AI. Developer **Sim Lab** and **Season Lab** routes exist for engine experimentation.

See [Roadmap](./roadmap.md) for the full feature matrix.
