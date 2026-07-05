# Roadmap

Current implementation status and planned work. This reflects the codebase as of the initial documentation pass.

## Legend

- ✅ Implemented
- 🟡 Partial / prototype
- ⬜ Planned
- 🚫 Explicitly out of scope (for now)

---

## Platform and infrastructure

| Feature                     | Status | Notes                                      |
| --------------------------- | ------ | ------------------------------------------ |
| TanStack Start web app      | ✅     | `apps/web` with file-based routing         |
| Tailwind CSS v4             | ✅     | Vite plugin integration                    |
| shadcn/ui component library | ✅     | `packages/ui` shared package               |
| Turborepo monorepo          | ✅     | npm workspaces                             |
| TypeScript throughout       | ✅     | All packages                               |
| IndexedDB / Dexie saves     | ✅     | `packages/db`, multi-save support          |
| Convex integration          | ⬜     | Not started                                |
| Vercel AI SDK               | ⬜     | Not started                                |
| PWA / offline shell         | ⬜     | `manifest.json` exists; service worker TBD |
| Cloud save sync             | ⬜     | Depends on Convex                          |
| User accounts               | ⬜     | Depends on Convex                          |

---

## Simulation engine

| Feature                      | Status | Notes                                                                                                       |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Seeded RNG                   | ✅     | Reproducible games                                                                                          |
| Team strength model          | ✅     | Component-based offense/defense, pace, home court                                                           |
| Game simulation              | ✅     | Aggregate component sim: possessions, attempts, shooting, rebounds, turnovers, scores, quarters, box scores |
| Player stat allocation       | ✅     | Allocates attempts/makes/free throws/rebounds/etc. from usage, skills, and minutes                          |
| Rotation planning            | ✅     | Role-based auto rotations, target minutes, stamina adjustment, future user-minute contract                  |
| Schedule generation          | ✅     | 6-team mini and 30-team full                                                                                |
| Day / week simulation        | ✅     | `simulateDay`, `simulateWeek`                                                                               |
| Full season simulation       | ✅     | `simulateSeason`                                                                                            |
| Standings derivation         | ✅     | W-L, streak, point differential                                                                             |
| Player season stats          | ✅     | Aggregated from game logs                                                                                   |
| Playoffs — bracket           | ✅     | 6-team and 30-team formats                                                                                  |
| Playoffs — series sim        | ✅     | Best-of-3 and best-of-7                                                                                     |
| Season archive + history     | ✅     | `archiveSeason`, history table                                                                              |
| Multi-season progression     | ✅     | `startNextSeason`                                                                                           |
| Player development / aging   | ✅     | Offseason progression with peak age, role/minutes history, per-skill growth/regression                      |
| Player archetypes            | ✅     | Position-valid archetypes shape generated ratings, usage, and value                                         |
| Player value / asset value   | ✅     | Archetype-aware player value plus contract surplus/liability breakdowns                                     |
| Draft + rookie generation    | ✅     | 2-round draft, archetyped rookie class, rookie-scale contracts, undrafted FA conversion                     |
| Injuries                     | ✅     | Age/stamina/minutes risk, severity/duration, daily recovery, rotation exclusion                             |
| Fatigue / minutes management | 🟡     | Stamina affects rotation targets and injury risk; no in-game fatigue substitutions                          |
| Trades                       | 🟡     | Engine validation/execution, AI acceptance, salary matching, picks, history/logs; UI pending                |
| Free agency                  | ✅     | Re-signing phase, FA pool, user/AI signing validation, cap exceptions                                       |
| Draft                        | ✅     | Draft board/order/picks/selections and rookie conversion                                                    |
| Coaching / tactics           | ⬜     | —                                                                                                           |
| Financials / salary cap      | ✅     | Contracts, cap/tax, Bird rights, MLE/minimum/rookie scale, team strategy, cap cuts                          |

---

## League UI (player-facing)

| Feature                  | Status | Notes                                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------------- |
| Home / continue league   | ✅     | Active save detection                                                     |
| Create league            | ✅     | Name + generated teams                                                    |
| Pick team                | ✅     | User team selection                                                       |
| Save management          | ✅     | List, switch, delete saves                                                |
| League dashboard         | ✅     | Phase-aware overview                                                      |
| Standings                | ✅     | Sortable table                                                            |
| Schedule + sim controls  | ✅     | Day/week/season buttons                                                   |
| Team roster view         | ✅     | User team players                                                         |
| Player season stats      | ✅     | League-wide stats table                                                   |
| Box scores               | ✅     | Game detail with quarter lines                                            |
| Playoff bracket          | ✅     | Series progress                                                           |
| Season history           | ✅     | Past champions and records                                                |
| Mobile-responsive layout | 🟡     | Functional; polish ongoing                                                |
| Trade UI                 | ⬜     | —                                                                         |
| Draft UI                 | 🟡     | Basic draft route exists; polish and richer prospect presentation pending |
| Free agency UI           | 🟡     | Panel exists; richer negotiation/market UX pending                        |
| Settings / preferences   | ⬜     | —                                                                         |

---

## Developer tools

| Feature                | Status | Notes                 |
| ---------------------- | ------ | --------------------- |
| Sim Lab                | ✅     | `/sim-lab`            |
| Season Lab             | ✅     | `/season-lab`         |
| Engine unit tests      | ✅     | `packages/sim/tests/` |
| DB unit tests          | ✅     | `packages/db/tests/`  |
| E2E browser tests      | ⬜     | —                     |
| Sim benchmarking tools | ⬜     | —                     |

---

## AI and narrative (planned)

Powered by **Vercel AI SDK** with optional **Convex** backend for API key security.

| Feature                | Status | Notes                               |
| ---------------------- | ------ | ----------------------------------- |
| Post-game recaps       | ⬜     | Generated from box score context    |
| Trade rumors           | ⬜     | Based on team needs / cap situation |
| Press conferences      | ⬜     | Interactive or scripted Q&A         |
| Scouting reports       | ⬜     | Prospect and opponent previews      |
| Beat reporter columns  | ⬜     | Periodic league news                |
| Generated media assets | ⬜     | Images, headlines, social posts     |

**Principle:** AI generates narrative; the engine owns stats and outcomes.

---

## Cloud features (planned)

Powered by **Convex**.

| Feature                  | Status | Notes                          |
| ------------------------ | ------ | ------------------------------ |
| Authentication           | ⬜     | Account creation and login     |
| Cloud save backup        | ⬜     | Sync `LeagueRecord` to cloud   |
| Cross-device play        | ⬜     | Load cloud save on any browser |
| Realtime league rooms    | ⬜     | Spectate or co-manage          |
| Leaderboards             | ⬜     | Cross-player comparisons       |
| AI orchestration backend | ⬜     | Server-side AI calls           |

---

## Suggested build order

A pragmatic sequence for future work:

1. **Core UI polish pass** — roster, player detail, cap sheet, injuries, draft/free agency surfaces
2. **Season role/minutes profile** — MPG, starts, usage, role, missed games for future development logic
3. **Development modifiers from role/minutes** — young-player opportunity, veteran mentorship refinement, injury impact
4. **Scouting uncertainty** — displayed vs true potential and prospect scouting reports
5. **Trades** — asset-value driven player movement with salary matching
6. **Export/import saves** — JSON download/upload (no cloud dependency)
7. **Convex auth + cloud sync** — optional account layer
8. **AI narrative MVP** — post-game recaps via Vercel AI SDK
9. **PWA polish** — offline shell, install prompt, mobile UX pass
10. **E2E tests** — Playwright or similar for critical flows

---

## Versioning

- **App version:** `0.0.1` (early prototype)
- **Save version:** `7` (`SAVE_VERSION` in shared types)

Increment `SAVE_VERSION` and add normalization logic whenever persisted shape changes.
