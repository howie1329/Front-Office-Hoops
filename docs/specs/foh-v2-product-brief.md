# Front Office Hoops v2 Product Brief

## Product identity

Front Office Hoops is a fictional professional basketball universe in which the player runs a front office over many seasons. The game is about making coherent decisions with incomplete information: build a roster, develop players, manage contracts, trade assets, respond to injuries, and create a sustainable organization.

It is not a literal NBA CBA simulator, a fantasy sports dashboard, or a story generator that invents the league state.

## Target player

The target player enjoys Basketball GM-style long-term simulation but wants a more deliberate modern interface, clearer explanations, more believable market behavior, better scouting uncertainty, and future AI-assisted storytelling. The player should be able to understand why an outcome occurred without inspecting source code.

## Core fantasy

“I am responsible for the direction of a basketball organization, and my decisions create a history worth remembering.”

## Design principles

1. **Believable over literal.** Model the constraints that create recognizable basketball decisions; omit rules that add paperwork without strategic value.
2. **Facts before narrative.** Simulation state is authoritative. Narrative consumes structured facts and can be deleted or regenerated.
3. **Uncertainty is gameplay.** Scouting, development, health, and markets should expose ranges and confidence, not false precision.
4. **Every major outcome is explainable.** Contracts, trades, development, injuries, and awards should have structured reasons.
5. **Configuration is explicit.** Rules and calibration presets are typed, versioned, documented, and exportable.
6. **A season is a coherent workflow.** Actions, deadlines, automatic league activity, and resume behavior are visible.
7. **Information density is intentional.** Tables support comparison and decisions; mobile views preserve the decision rather than every column.
8. **Reproducibility is a feature.** Seeds, command history, diagnostics, and golden league files are part of development and support.

## Ratings philosophy

V2 should store skill and latent ability dimensions and derive evaluator-specific ratings. A universal stored overall should not be the simulation's canonical truth.

| Reference level | Visible rating band |
|---|---:|
| Replacement / fringe professional | 40–45 |
| Average professional | 48–53 |
| Rotation player | 54–59 |
| Good starter | 60–67 |
| All-Star | 68–76 |
| MVP-level | 77–84 |
| Generational | 85–90 |

The default universe should make ratings above 70 uncommon, above 80 rare, and above 90 exceptional. Public ratings are estimates with team-specific uncertainty. Role, scheme, lineup, age, health, and evaluator should change the displayed view without changing true ability.

## Realism and simplification philosophy

Use realistic distributions and causal relationships, not exhaustive rule transcription. The default Standard rules profile should include a soft cap, tax, minimum/max salaries, rookie scale, basic retention rights, extensions, options, selected exceptions, protected picks, and clear trade matching. Advanced apron and sign-and-trade behavior belongs in an optional rules preset.

## Narrative philosophy

The narrative layer is optional, cached, regenerable, and traceable. It receives a `StoryPacket` containing authoritative events and summaries. It must not mutate the league, create facts, or be required for a save to load.

## Default league rules

- Fictional 30-team league with optional smaller test leagues.
- Two conferences and configurable divisions in the default format.
- 82-game regular season and configurable playoff series length.
- Soft cap, tax line, minimum team salary, maximum/minimum player salaries.
- Rookie-scale contracts and basic Bird-style retention rights.
- Guaranteed contracts with team/player options and dead money.
- Selected exceptions and simple salary matching.
- Draft lottery and two-round draft by default.
- Roster limits, emergency minimum-player rule, and explicit injured-player eligibility.
- Configurable pace, scoring, development, injury, and market presets.

## Required v2 features

1. Multi-season playable league loop with explicit lifecycle and resume-safe commands.
2. Coherent player generation, scouting, development, aging, injury, and retirement.
3. Possession-based game simulation calibrated to benchmark distributions.
4. Distinct player evaluation concepts and explainable contract market.
5. Roster, rotation, cap sheet, trade, draft, free agency, staff, and team-strategy workflows.
6. Versioned JSON league document with full and partial exports/imports.
7. Structured event history, records, transactions, and optional story feed.
8. Seeded labs and batch calibration reports.
9. Desktop and mobile management screens with proper table infrastructure.
10. Optional AI narrative consumer using only structured simulation facts.

## Explicit non-goals for the first playable v2

- Exact reproduction of every NBA CBA clause.
- Play-by-play simulation as the default storage mode.
- Full social-media, owner, media, or press-conference systems before the core loop is calibrated.
- AI-generated narrative that can change game state.
- Permanent sharing of unstable v1 and v2 domain models.
- Exposing every internal constant as a user slider.

## Minimum viable playable loop

Create league → scout and draft players → set rotation and team plan → simulate games and season → manage injuries and trades → enter playoffs → process awards and history → handle options, staff, re-signing, draft, and free agency → start the next season → export/import the league → inspect history and explanations.

The loop is not complete until it survives at least ten seasons in batch tests with stable distributions, reconciled finances, valid rosters, and understandable market outcomes.
