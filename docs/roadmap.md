# Roadmap

Current implementation status and planned work. This reflects the codebase as of July 2026.

## Legend

- ✅ Implemented
- 🟡 Partial / prototype
- ⬜ Planned
- 🚫 Explicitly out of scope for now

## Platform and infrastructure

| Feature | Status | Notes |
| --- | --- | --- |
| TanStack Start web app | ✅ | `apps/web` with file-based routing |
| Tailwind CSS v4 | ✅ | Vite plugin integration |
| shadcn/ui component library | ✅ | Shared `packages/ui` package |
| Turborepo monorepo | ✅ | npm workspaces |
| TypeScript throughout | ✅ | All packages |
| IndexedDB / Dexie saves | ✅ | Multiple local league saves |
| PWA manifest | 🟡 | Manifest exists; service worker and install flow remain |
| Convex integration | ⬜ | Cloud backend not started |
| Cloud save sync | ⬜ | Depends on Convex |
| User accounts | ⬜ | Depends on Convex |
| Vercel AI SDK | ⬜ | Narrative layer not started |

## Simulation engine

| Feature | Status | Notes |
| --- | --- | --- |
| Seeded RNG | ✅ | Reproducible games and league events |
| Team strength model | ✅ | Offense, defense, pace, home court, and staff effects |
| Game simulation | ✅ | Segments, overtime, synergy, momentum, blowouts, and philosophy |
| Player stat allocation | ✅ | Attempts, makes, free throws, rebounds, assists, and defensive stats |
| Rotation planning | ✅ | Roles, target minutes, stamina, and injury risk |
| Schedule and calendar | ✅ | 6-team mini and 30-team full formats |
| Day / week / season simulation | ✅ | Regular season and playoff advancement |
| Standings and season stats | ✅ | Derived from completed games |
| Playoffs | ✅ | Brackets with best-of-3 mini and best-of-7 full-league series |
| Season archive and history | ✅ | Champions, records, and player history |
| Player development and aging | ✅ | Potential, role/minutes, mentorship, staff, culture, injuries, and retirement |
| Player archetypes and value | ✅ | Generation, simulation usage, contracts, trades, and AI decisions |
| Injuries | ✅ | Risk, severity, recovery, and rotation exclusion |
| Contracts and salary cap | ✅ | Cap/tax, dead cap, exceptions, options, Bird rights, and strategy |
| Trades | ✅ | Validation, execution, player/pick value, TPE, and AI market offers |
| Staff management | ✅ | Staff week, hiring, firing, extensions, budgets, and philosophy |
| Re-signing | ✅ | Offer market, negotiation attempts, and team rights |
| Draft | ✅ | Draft classes, order, picks, prospects, and rookie contracts |
| Free agency | ✅ | Offer market, player mood, cap exceptions, and roster filling |
| In-game fatigue substitutions | ⬜ | Stamina affects planning and risk, but not live substitution decisions |
| Coaching and tactical controls | 🟡 | Staff philosophy affects the sim; user tactical controls remain future work |

## Player-facing league UI

| Feature | Status | Notes |
| --- | --- | --- |
| Home / continue league | ✅ | Active save detection |
| Create league and pick team | ✅ | Full and mini league setup |
| Save management | ✅ | List, switch, and delete local saves |
| League dashboard | ✅ | Phase-aware status, actions, and alerts |
| Calendar and schedule | ✅ | Team calendar, game log, and simulation controls |
| Standings | ✅ | Sortable standings table |
| Team roster and player detail | ✅ | Contracts, ratings, value, injuries, and extensions |
| Player season stats | ✅ | League-wide sortable table |
| Box scores | ✅ | Game detail, quarter lines, and player stats |
| Playoff bracket | ✅ | Series progress and results |
| Season history | ✅ | Past champions, records, trades, and logs |
| Staff UI | ✅ | Roster, hiring pool, budget, offers, firing, and extensions |
| Trade UI | ✅ | Trade workspace, value breakdown, AI acceptance, and offer inbox |
| Re-signing UI | ✅ | Negotiation panel and offer state |
| Draft UI | 🟡 | Functional; richer prospect presentation remains |
| Free-agency UI | 🟡 | Functional; negotiation and market polish remains |
| Mobile-responsive layout | 🟡 | Functional; ongoing polish |
| Settings / preferences | ⬜ | Not started |

## Developer tools and quality

| Feature | Status | Notes |
| --- | --- | --- |
| Sim Lab | ✅ | `/sim-lab` single-game playground |
| Season Lab | ✅ | `/season-lab` season simulation playground |
| Simulation unit tests | ✅ | `packages/sim/tests/` |
| Database unit tests | ✅ | `packages/db/tests/` with fake IndexedDB |
| Browser E2E tests | ⬜ | Not started |
| Simulation benchmarking | ⬜ | Not started |

## Next priorities

1. Polish roster, player detail, cap sheet, staff, draft, and free-agency workflows.
2. Improve scouting uncertainty and prospect presentation.
3. Add export/import for local `LeagueRecord` saves.
4. Add browser E2E coverage for league creation, simulation, offseason, trades, and save management.
5. Add PWA/offline-shell polish.
6. Revisit cloud sync and accounts once the local-first loop is stable.
7. Add AI-generated narrative only after the engine event and data contracts are stable.

## Planned narrative and cloud features

These are intentionally not part of the current local gameplay loop:

- AI post-game recaps, trade rumors, scouting reports, press conferences, and beat reporting.
- Convex authentication, cloud backups, cross-device saves, realtime rooms, leaderboards, and server-side AI orchestration.

The engine remains authoritative for stats, outcomes, contracts, and league state. Future AI output should add narrative without changing simulation truth.

## Versioning

- **App version:** `0.0.1` (early prototype)
- **Save version:** `16` (`SAVE_VERSION` in `packages/shared/src/leagueTypes.ts`)

There is currently no save migration layer. Bump `SAVE_VERSION` when the persisted schema changes and clear local IndexedDB saves during development after breaking changes.
