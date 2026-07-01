# Front Office Hoops

Simulation-first basketball GM prototype. Create a league, pick your team, sim through the regular season and playoffs, and carry saves across multiple seasons — all in the browser with local IndexedDB persistence.

## Tech stack

- **Monorepo:** npm workspaces + [Turborepo](https://turbo.build/)
- **Web app:** [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + Vite + React 19
- **UI:** [shadcn/ui](https://ui.shadcn.com/) (`packages/ui`)
- **Persistence:** Dexie (IndexedDB) in `packages/db`
- **Simulation engine:** Pure TypeScript in `packages/sim`

## Requirements

- Node.js **20+** (see `engines` in `package.json`)
- npm 11+ (repo uses `packageManager: npm@11.11.0`)

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server (web app on http://localhost:3000)
npm run dev
```

## Scripts

Run from the repo root. Turborepo fans out to each package.

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the web dev server |
| `npm run build` | Production build (`apps/web`) |
| `npm run test` | Run Vitest suites (`packages/sim`, `packages/db`) |
| `npm run typecheck` | TypeScript check across all packages |
| `npm run lint` | ESLint (`apps/web`, `packages/ui`) |
| `npm run format` | Prettier format |

## Repository layout

```
apps/web/           Product UI — league management, box scores, saves
packages/sim/       Simulation engine — games, seasons, playoffs, stats
packages/db/        Local persistence — IndexedDB league saves
packages/shared/    Shared domain types and constants
packages/ui/        shadcn/ui component library
```

### Package roles

| Package | Purpose |
|---------|---------|
| `@workspace/sim` | Schedule generation, game simulation, standings/stats derivation, playoff bracket logic, multi-season transitions |
| `@workspace/db` | CRUD for league saves in IndexedDB; debounced auto-save from the web app |
| `@workspace/shared` | `SeasonState`, `Player`, `LeagueRecord`, and league constants (30-team NBA-style config) |
| `web` | Routes, league context, and product screens |

## League flow

The product path is a 30-team league stored locally in the browser.

1. **Home** (`/`) — continue an existing save, create a league, or manage saves
2. **Create league** (`/league/create`) — name + optional seed → 30 procedurally generated teams
3. **Pick team** (`/league/pick-team`) — choose the team you manage
4. **Dashboard** (`/league`) — sim by day, week, or full season; advance through season phases
5. **Standings / Schedule / Stats** — follow the regular season
6. **Playoffs** (`/league/playoffs`) — bracket view and playoff simulation
7. **History** (`/league/history`) — archived seasons after starting the next year
8. **Saves** (`/league/saves`) — switch or delete local saves

Season phases: `regular` → `playoffs` → `complete`. When the season is complete, start the next season to archive results and roll rosters forward.

### Developer tools

| Route | Purpose |
|-------|---------|
| `/sim-lab` | Single-game matchup tester with sample rosters and sim metadata |
| `/season-lab` | 6-team season sandbox for quick engine validation |

## Adding UI components

To add shadcn components to the web app:

```bash
npx shadcn@latest add button -c apps/web
```

Components are placed in `packages/ui/src/components`. Import them from the workspace package:

```tsx
import { Button } from "@workspace/ui/components/button"
```

## CI

GitHub Actions runs on pushes and pull requests to `master`:

- `npm run typecheck`
- `npm run test`
- `npm run build`

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Testing

Engine and persistence tests live in:

- `packages/sim/tests/` — matchup sim, scheduling, standings, playoffs, season loop
- `packages/db/tests/` — IndexedDB repository round-trips

The web app does not have automated UI tests yet.
