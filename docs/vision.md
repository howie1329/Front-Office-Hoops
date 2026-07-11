# Vision

## What we're building

**Front Office Hoops** is a basketball general-manager simulation game. You run a franchise: build a roster, navigate a season schedule, compete in the playoffs, and carry history forward year after year.

The game is **inspired by** Basketball GM and ZenGM — the genre-defining browser-based GM sims — but is **not a clone**. We aim for a distinct identity in presentation, pacing, AI-assisted narrative, and long-term feature depth while honoring what makes the genre compelling: emergent stories, roster construction, and the satisfaction of watching a dynasty (or disaster) unfold.

## Core principles

### Web-first

The game runs in a modern browser. No native install required. Deploy to the edge, share a link, play anywhere.

### Mobile-friendly

Layouts and interactions are designed for touch and small screens from the start — not retrofitted later. League management should be usable on a phone during a commute.

### Local-first

**The simulation engine and save data live on the client.** You can create leagues, simulate seasons, and manage saves without an account or network connection. Cloud features are additive, not required.

### Simulation-first

Gameplay truth comes from a **deterministic, testable TypeScript engine** (`@workspace/sim`). The UI is a lens on league state; it does not own game logic. This keeps the sim fast, portable, and easy to unit test.

### Optional cloud

**Convex** (planned) will provide accounts, cloud save sync, realtime multiplayer or spectator modes, and a backend surface for AI features — without blocking offline play.

### AI as flavor, not fakery

**Vercel AI SDK** (planned) will generate narrative content — game reports, trade rumors, press conferences, scouting blurbs, generated media — that enriches the world without replacing the underlying simulation. Stats and outcomes remain engine-driven.

## Player experience goals

| Phase              | Experience                                                   |
| ------------------ | ------------------------------------------------------------ |
| **Onboard**        | Create a league, pick your team, understand the dashboard    |
| **Regular season** | Simulate days or weeks, track standings, review box scores   |
| **Playoffs**       | Bracket progression, series results, champion crowned        |
| **Offseason**      | Staff, re-signing, draft, free agency, roster moves, and trades |
| **Multi-season**   | Season history, legacy tracking, evolving narratives         |

## Non-goals (for now)

- Real NBA teams, logos, or licensed assets
- Real-time multiplayer head-to-head gameplay
- Server-authoritative simulation (sim stays client-side)
- Pixel-perfect parity with Basketball GM feature set

## Inspiration vs. differentiation

| Inspired by                 | Our direction                                                             |
| --------------------------- | ------------------------------------------------------------------------- |
| Browser-based GM sim loop   | Same accessibility; modern React stack                                    |
| Multi-season franchise mode | Season history, offseason loop, development, local saves                  |
| Deep roster/stat tracking   | Player archetypes, ratings, injuries, contracts, box scores, season stats |
| Text-forward presentation   | shadcn/ui + Tailwind for a polished, responsive UI                        |
| —                           | AI-generated narrative layer (planned)                                    |
| —                           | Optional cloud sync and accounts (planned)                                |
| —                           | Mobile-first interaction patterns                                         |
