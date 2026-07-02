# Roadmap

Current implementation status and planned work. This reflects the codebase as of the initial documentation pass.

## Legend

- ✅ Implemented
- 🟡 Partial / prototype
- ⬜ Planned
- 🚫 Explicitly out of scope (for now)

---

## Platform and infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| TanStack Start web app | ✅ | `apps/web` with file-based routing |
| Tailwind CSS v4 | ✅ | Vite plugin integration |
| shadcn/ui component library | ✅ | `packages/ui` shared package |
| Turborepo monorepo | ✅ | npm workspaces |
| TypeScript throughout | ✅ | All packages |
| IndexedDB / Dexie saves | ✅ | `packages/db`, multi-save support |
| Convex integration | ⬜ | Not started |
| Vercel AI SDK | ⬜ | Not started |
| PWA / offline shell | ⬜ | `manifest.json` exists; service worker TBD |
| Cloud save sync | ⬜ | Depends on Convex |
| User accounts | ⬜ | Depends on Convex |

---

## Simulation engine

| Feature | Status | Notes |
|---------|--------|-------|
| Seeded RNG | ✅ | Reproducible games |
| Team strength model | ✅ | Off/def factors, pace, home court |
| Game simulation | ✅ | Scores, quarters, box scores |
| Player stat allocation | ✅ | Usage-weighted distribution |
| Schedule generation | ✅ | 6-team mini and 30-team full |
| Day / week simulation | ✅ | `simulateDay`, `simulateWeek` |
| Full season simulation | ✅ | `simulateSeason` |
| Standings derivation | ✅ | W-L, streak, point differential |
| Player season stats | ✅ | Aggregated from game logs |
| Playoffs — bracket | ✅ | 6-team and 30-team formats |
| Playoffs — series sim | ✅ | Best-of-3 and best-of-7 |
| Season archive + history | ✅ | `archiveSeason`, history table |
| Multi-season progression | ✅ | `startNextSeason` |
| Player development / aging | ✅ | Offseason progression with peak age, per-skill growth/regression |
| Draft + rookie generation | ✅ | 2-round snake draft, rookie class, free agent pool |
| Injuries | ⬜ | `injury` field reserved |
| Fatigue / minutes management | ⬜ | Rotation exists; no fatigue model |
| Trades | ⬜ | — |
| Free agency | ⬜ | — |
| Draft | ⬜ | `draftInfo` field reserved |
| Coaching / tactics | ⬜ | — |
| Financials / salary cap | ⬜ | — |

---

## League UI (player-facing)

| Feature | Status | Notes |
|---------|--------|-------|
| Home / continue league | ✅ | Active save detection |
| Create league | ✅ | Name + generated teams |
| Pick team | ✅ | User team selection |
| Save management | ✅ | List, switch, delete saves |
| League dashboard | ✅ | Phase-aware overview |
| Standings | ✅ | Sortable table |
| Schedule + sim controls | ✅ | Day/week/season buttons |
| Team roster view | ✅ | User team players |
| Player season stats | ✅ | League-wide stats table |
| Box scores | ✅ | Game detail with quarter lines |
| Playoff bracket | ✅ | Series progress |
| Season history | ✅ | Past champions and records |
| Mobile-responsive layout | 🟡 | Functional; polish ongoing |
| Trade UI | ⬜ | — |
| Draft UI | ⬜ | — |
| Free agency UI | ⬜ | — |
| Settings / preferences | ⬜ | — |

---

## Developer tools

| Feature | Status | Notes |
|---------|--------|-------|
| Sim Lab | ✅ | `/sim-lab` |
| Season Lab | ✅ | `/season-lab` |
| Engine unit tests | ✅ | `packages/sim/tests/` |
| DB unit tests | ✅ | `packages/db/tests/` |
| E2E browser tests | ⬜ | — |
| Sim benchmarking tools | ⬜ | — |

---

## AI and narrative (planned)

Powered by **Vercel AI SDK** with optional **Convex** backend for API key security.

| Feature | Status | Notes |
|---------|--------|-------|
| Post-game recaps | ⬜ | Generated from box score context |
| Trade rumors | ⬜ | Based on team needs / cap situation |
| Press conferences | ⬜ | Interactive or scripted Q&A |
| Scouting reports | ⬜ | Prospect and opponent previews |
| Beat reporter columns | ⬜ | Periodic league news |
| Generated media assets | ⬜ | Images, headlines, social posts |

**Principle:** AI generates narrative; the engine owns stats and outcomes.

---

## Cloud features (planned)

Powered by **Convex**.

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ⬜ | Account creation and login |
| Cloud save backup | ⬜ | Sync `LeagueRecord` to cloud |
| Cross-device play | ⬜ | Load cloud save on any browser |
| Realtime league rooms | ⬜ | Spectate or co-manage |
| Leaderboards | ⬜ | Cross-player comparisons |
| AI orchestration backend | ⬜ | Server-side AI calls |

---

## Suggested build order

A pragmatic sequence for future work:

1. **Export/import saves** — JSON download/upload (no cloud dependency)
2. **Player development** — aging, potential, offseason progression
3. **Draft + rookie generation** — populate `draftInfo`, annual draft event
4. **Free agency + trades** — roster movement core loop
5. **Convex auth + cloud sync** — optional account layer
6. **AI narrative MVP** — post-game recaps via Vercel AI SDK
7. **Injuries + fatigue** — deepen simulation realism
8. **Financials** — cap, contracts, team budget
9. **PWA polish** — offline shell, install prompt, mobile UX pass
10. **E2E tests** — Playwright or similar for critical flows

---

## Versioning

- **App version:** `0.0.1` (early prototype)
- **Save version:** `4` (`SAVE_VERSION` in shared types)

Increment `SAVE_VERSION` and add normalization logic whenever persisted shape changes.
