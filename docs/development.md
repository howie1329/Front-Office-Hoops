# Development Guide

## Prerequisites

- **Node.js** ≥ 20
- **npm** 11+ (repo uses npm workspaces; `packageManager` is pinned in root `package.json`)

## Getting started

```bash
# Clone and install
git clone <repo-url>
cd Front-Office-Hoops
npm install

# Start dev server (all workspaces via Turborepo)
npm run dev
```

The web app runs at **http://localhost:3000** by default.

## Scripts

Run from the repository root:

| Script              | Description                           |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start development servers (Turborepo) |
| `npm run build`     | Production build all workspaces       |
| `npm run lint`      | ESLint across workspaces              |
| `npm run format`    | Prettier format                       |
| `npm run typecheck` | TypeScript check all packages         |
| `npm run test`      | Vitest in packages that define tests  |

### Workspace-specific commands

```bash
# Sim engine tests only
npm run test --workspace=@workspace/sim

# DB package tests
npm run test --workspace=@workspace/db

# Web app dev only
npm run dev --workspace=web
```

## Project structure

```
apps/web/                 # TanStack Start app
  src/
    routes/               # File-based routes
    components/           # Feature components (league, box-score)
    contexts/             # LeagueContext
    hooks/                # useLeague, useLeagueSaves
    lib/                  # activeLeague localStorage helper
packages/
  sim/src/                # Simulation engine modules
  sim/tests/              # Engine unit tests
  shared/src/             # Types and constants
  db/src/                 # Dexie database + repository
  ui/src/components/      # shadcn/ui primitives
```

## Conventions

### Imports

- Workspace packages: `@workspace/sim`, `@workspace/shared`, `@workspace/db`, `@workspace/ui`
- App-internal: `@/` alias → `apps/web/src/`

### Simulation logic

**Never put game logic in React components or hooks beyond orchestration.** New sim behavior belongs in `packages/sim` with tests.

### Persistence

**Never access IndexedDB directly from components.** Use `@workspace/db` repository functions, imported dynamically in hooks to avoid SSR issues:

```ts
const { saveLeague } = await import("@workspace/db")
```

### UI components

Add shadcn components via the CLI (places files in `packages/ui`):

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Import from `@workspace/ui/components/<name>`.

### Types

Define shared domain types in `packages/shared`. If both `sim` and `web` need a type, it goes in `shared` — not duplicated.

### Styling

Tailwind CSS v4 with the Vite plugin. Use existing shadcn/ui patterns and CSS variables for theming.

## Testing

### Sim engine (`packages/sim`)

Vitest with comprehensive unit tests. When changing simulation behavior:

1. Write or update tests first when fixing bugs
2. Run `npm run test --workspace=@workspace/sim`
3. Verify edge cases: ties, empty schedules, playoff advancement, stat allocation sums, rotations, injuries, contracts/financial AI, archetypes/value

### DB layer (`packages/db`)

Uses `fake-indexeddb` in test setup. Run:

```bash
npm run test --workspace=@workspace/db
```

### Web app

No automated browser tests yet. Manual verification paths:

1. Create league → pick team → simulate days
2. Complete regular season → begin playoffs → simulate postseason
3. Start next season → verify history
4. Multiple saves → switch active save

## Developer routes

| Route         | Purpose                                     |
| ------------- | ------------------------------------------- |
| `/sim-lab`    | Test single-game simulation                 |
| `/season-lab` | Test season-level simulation with UI tables |

Use these when iterating on engine changes before wiring into the main league flow.

## Adding a new league feature

Typical workflow:

1. **Types** — extend `packages/shared` if new data shapes are needed
2. **Engine** — implement logic in `packages/sim` with tests
3. **Persistence** — update `SAVE_VERSION` when the current save shape changes
4. **Hook** — expose new actions in `useLeague`
5. **Context** — derive any computed state in `LeagueContext`
6. **UI** — build route/component in `apps/web`

## IndexedDB notes

- Database is only available in the browser
- `getDb()` throws during SSR — always use dynamic imports for `@workspace/db` in code that may run on server
- There is no save migration layer — clear local saves after schema changes

## Environment variables

No required env vars for local development today. Future additions:

| Variable                              | Purpose               |
| ------------------------------------- | --------------------- |
| `CONVEX_URL`                          | Convex deployment URL |
| `AI_GATEWAY_API_KEY` or provider keys | Vercel AI SDK         |

## Troubleshooting

| Issue                            | Fix                                                      |
| -------------------------------- | -------------------------------------------------------- |
| IndexedDB errors in dev          | Ensure you're in browser context, not SSR                |
| Stale league state               | Clear site data or delete save from `/league/saves`      |
| Type errors after shared changes | Run `npm run typecheck` and rebuild                      |
| shadcn component not found       | Verify import path matches `packages/ui/src/components/` |
