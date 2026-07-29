# Front Office Hoops — Product Brief

> This document describes the existing v1 product. The approved rewrite direction is in the [FOH v2 Product Brief](./specs/foh-v2-product-brief.md), with delivery sequencing in the [FOH v2 Roadmap](./plans/foh-v2-roadmap.md).

**Status:** Working product brief<br>
**Product stage:** Early local-first prototype<br>
**Last updated:** July 26, 2026

## Product in one sentence

Front Office Hoops is a browser-based basketball general-manager simulation where users build a franchise, make credible roster and financial decisions, simulate seasons, and watch league history accumulate over time.

## Why this product should exist

Basketball management sims are compelling when every move creates a consequence: a contract changes future flexibility, a draft pick changes the next window, staff changes development, and a season produces stories worth revisiting. The product should make those consequences legible without turning the experience into a spreadsheet exercise or a sports-news feed.

The product’s central promise is trustworthy agency: the user makes front-office decisions, the simulation produces coherent outcomes, and the interface makes the reasoning and consequences easy to inspect.

## Who it is for

### Primary user

A serious basketball and sports-management-sim player who enjoys roster construction, salary-cap decisions, prospect evaluation, transactions, standings, and multi-season team building. They are comfortable with dense information and want to move quickly between decision, simulation, and review.

### Secondary users

- Basketball fans who want a lighter, self-contained way to run a fictional league.
- Simulation designers and developers who want a deterministic engine and lab surfaces for testing league behavior.

## Core user loop

1. Create a fictional six-team or 30-team league and choose a franchise.
2. Inspect the roster, staff, contracts, cap position, schedule, and league context.
3. Make front-office decisions: assess franchise direction, manage the roster, negotiate, trade, draft, sign free agents, and manage staff.
4. Simulate the next day, week, season, or playoff round.
5. Review standings, box scores, injuries, player development, financial outcomes, and league events.
6. Enter the offseason, make the next set of decisions, and carry the franchise history forward.

The loop should remain fast enough for experimentation and deep enough that a multi-season save develops a distinct identity.

## Product pillars

### Simulation credibility

League outcomes come from a deterministic, seeded TypeScript engine rather than UI-side rules or opaque random behavior. The engine is the authority for games, player development, contracts, trades, finances, and season transitions.

### Front-office consequence

Roster construction, player value, contracts, cap pressure, staff quality, scouting information, injuries, aging, draft choices, and team direction should interact. Decisions should have understandable short- and long-term costs.

### Fast league-office workflows

The interface should make league state scannable, keep actions close to the decision they advance, and support dense tables where comparison is the job. The product should feel like a compact league office, not a promotional sports site.

### Local-first ownership

The current product works without an account or server connection. A user can create multiple local saves and run the simulation in the browser. Cloud sync, accounts, and AI services are optional future layers, not prerequisites for the core game.

### Emergent history

The long-term product is not just a season simulator. It is a record of franchises, players, trades, staff careers, champions, development arcs, and the decisions that produced them. Future narrative features should explain that history without changing simulation truth.

## Current product state

The local gameplay loop is substantially implemented. Today a user can create a league, choose a team, simulate regular seasons and playoffs, manage rosters and staff, navigate re-signing, draft, and free agency, execute trades, manage cap and contract systems, review player and league history, and advance across seasons. The simulation also includes seeded game outcomes, player archetypes and value models, scouting uncertainty, development and aging, injuries, retirement, draft classes, financial AI, staff lifecycle, and owner-goal data.

The product is not production-ready yet. It remains an early prototype with local-only persistence, no save migration layer, no export/import flow, limited browser-level automated testing, and unfinished responsive and workflow polish. The current package version is `0.0.1`; the persisted league schema marker is `18`.

## Product boundary

### In scope for the core product

- Fictional leagues and teams; no licensed NBA assets are required.
- A complete single-player, multi-season GM loop.
- Roster, contract, salary-cap, tax, trade, draft, free-agency, staff, scouting, development, injury, and history systems.
- Multiple local saves that can be created, resumed, switched, and deleted.
- Responsive browser workflows, with mobile usability treated as a product requirement.

### Not part of the first product milestone

- Real NBA teams, logos, or licensed data.
- Real-time head-to-head multiplayer.
- Server-authoritative simulation.
- AI-generated text that can alter stats, outcomes, contracts, or league state.
- Full parity with Basketball GM or any other existing game.

## Definition of a credible first product

Before expanding into cloud or AI features, the local-first product should meet this bar:

- A new player can understand the first decision path and complete a first season without manual intervention.
- Every major phase has clear eligibility, completion, and recovery states.
- Local saves are portable through export/import and resilient across schema changes.
- The core league loop has browser-level coverage for creation, simulation, offseason, transactions, and save management.
- The UI is usable on desktop and mobile with reliable keyboard, focus, status, and error behavior.
- Simulation behavior is explainable enough that players can distinguish scouting uncertainty from actual league truth.

## Success signals

These are product signals to instrument once a hosted or testable product surface exists:

- New users create a league and reach their first simulated game.
- Players complete a first season and enter the offseason.
- Players return to the same save and continue into a second season.
- Users inspect a player, make a transaction, and review the resulting outcome.
- Saves survive reloads, browser restarts, and export/import without data loss.
- Simulation and UI errors are rare, actionable, and reproducible from a save or seed.

## Strategic sequence

1. Stabilize and explain the local-first league loop.
2. Make saves portable and the main workflows production-quality.
3. Add owner pressure, event structure, and stronger long-term franchise identity.
4. Add optional narrative and cloud capabilities only where they reinforce the simulation rather than distract from it.

The [roadmap](./roadmap.md) turns this sequence into staged work. The [vision](./vision.md) describes the longer-term direction; this brief defines the product boundary and near-term bar.
