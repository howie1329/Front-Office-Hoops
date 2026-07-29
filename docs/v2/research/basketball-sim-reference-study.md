# Basketball Simulation Reference Study

**Purpose:** external reference for FOH v2 architecture and calibration. FOH is a fictional professional league, not an NBA rules clone.

## Sources

- [Basketball GM customization manual](https://basketball-gm.com/manual/customization/)
- [Basketball GM game attributes](https://basketball-gm.com/manual/customization/game-attributes/)
- [Basketball GM JSON schema guidance](https://basketball-gm.com/manual/customization/json-schema/)
- [ZenGM repository](https://github.com/zengm-games/zengm)
- [Official NBPA CBA page](https://nbpa.com/cba)
- [2023 NBA-NBPA CBA PDF](https://imgix.cosmicjs.com/25da5eb0-15eb-11ee-b5b3-fbd321202bdf-Final-2023-NBA-Collective-Bargaining-Agreement-6-28-23.pdf)
- [NBA 2025-26 salary-cap announcement](https://pr.nba.com/nba-salary-cap-2025-26-season/)
- [NBA 2023-24 statistical survey](https://www.nba.com/news/2023-24-nba-stats-survey-league-scoring-averages)
- [Basketball-Reference league averages](https://www.basketball-reference.com/leagues/NBA_stats_per_game.html)

## 1. Basketball GM / ZenGM findings

### Ideas FOH should adopt

1. **League files are a user-facing contract.** Basketball GM documents JSON export/import, partial exports, selectable sections, and optional game data. FOH should make the league document a first-class product artifact rather than a Dexie implementation detail.
2. **Schema validation and domain validation are separate.** The Basketball GM manual notes that a JSON schema can catch structural errors but not all logical relationships. FOH should validate JSON shape first, then validate cross-entity invariants such as contract ownership, pick ownership, phase reachability, and standings consistency.
3. **Large data is optional.** Basketball GM identifies games and box scores as potentially large sections. FOH should support full, operational, career, and storytelling exports with games and play-by-play independently selectable.
4. **Game attributes are configurable.** Phase, schedule, playoff length, conferences/divisions, starting season, and other settings are modeled as explicit attributes. FOH should use typed rules and simulation presets rather than scattered constants.
5. **Historical data and events are native concepts.** FOH should adopt structured events and immutable season archives as a foundation for history, debugging, and storytelling.
6. **Developer tooling is part of a serious sim.** Import/export, league inspection, and reproducible tools should be designed alongside the game loop.

### Ideas FOH should intentionally avoid

- Do not reproduce ZenGM's source structure or copy implementation. The public repository's README states that the project is not open source and points to its license and contributor agreement. Use the documented behavior and architecture ideas only.
- Do not make a huge settings surface the default user experience. Expose product-safe sliders and rule presets; keep calibration constants in developer configuration.
- Do not treat a single overall rating as the only explanation for player value. FOH can differentiate through role-specific fit, production résumé, reputation, and explainable market behavior.
- Do not make raw JSON editing the normal user path. Export/import should be discoverable, validated, and recoverable while the UI remains the primary management surface.

### Where FOH can differentiate

- A fictional league with internally consistent rules rather than an NBA legality simulator.
- Better distinction between true ability, public scouting, production, reputation, and market value.
- Explainable contract and trade outcomes.
- StoryPackets that let AI create narrative from authoritative events without owning facts.
- Screen-level information architecture designed for comparison, saved views, and mobile management.
- Calibration labs that report distributions instead of only simulating one season.

## 2. NBA/NBPA rules: what matters for a fictional league

The current CBA was ratified in 2023, applies from July 1, 2023 through 2029-30 with an opt-out mechanism, and contains detailed articles for salary cap, tax and aprons, exceptions, extensions, trades, rookie scale, restricted free agency, and roster limitations. The NBA's 2025-26 announcement illustrates the operational complexity: a $154.647M cap, $187.895M tax line, $195.945M first apron, and $207.824M second apron, plus multiple MLE values.

FOH should classify rules by game value, not realism prestige:

| Rule | Default profile | Advanced profile | Rationale |
|---|---|---|---|
| Soft cap, minimum team salary, max/min salaries | Essential | Keep | Creates the basic resource problem |
| Luxury tax and escalating penalties | Essential | Keep | Makes spending a strategic choice |
| Rookie-scale contracts | Essential | Keep | Makes drafting and rebuilding meaningful |
| Basic Bird/retention rights | Essential | Keep | Preserves continuity and rewards drafting |
| Contract options and guarantees | Valuable | Keep | Creates flexibility and risk |
| Extensions | Valuable | Keep | Creates timing decisions |
| Simple trade matching | Essential | Keep | Prevents arbitrary cap bypasses |
| Exceptions | Valuable | Expand | MLE-like tools are understandable; many exceptions are not |
| Restricted free agency | Optional | Add | Adds strategic depth but increases market complexity |
| Sign-and-trades | Optional | Add | Useful only after the core market is stable |
| First/second apron restrictions | Optional | Add | High implementation and comprehension cost |
| Detailed tax brackets/repeater rules | Valuable | Expand | Good for advanced financial play, not the first default |
| Complex draft-pick protections | Valuable | Add | Important for trade depth but needs a robust asset model |
| Two-way/roster minutiae | Optional | Add selectively | Use only when they affect strategic decisions |

## 3. Recommended rule profiles

### Simple

Soft cap, minimum salary, maximum salary, luxury tax, rookie scale, minimum roster, maximum roster, basic Bird retention, one mid-level-like exception, simple salary matching, guaranteed contracts, and dead money. No aprons, RFA, sign-and-trades, or complex pick protections.

### Standard

Simple rules plus selected exceptions, team/player options, extensions, cap holds, restricted free agency, protected picks, and stronger tax penalties. This is the recommended v2 default after calibration because it creates meaningful offseason and trade decisions without reproducing every NBA edge case.

### Advanced NBA-inspired

Standard plus first/second apron restrictions, multiple exception types, sign-and-trades, complex trade matching, detailed RFA rules, and richer pick protections. This should be an optional rules preset, not a dependency of the core simulation.

## 4. Statistical benchmark profiles

The NBA's 2023-24 reference profile was approximately 114.2 points per team per game, 99.2 possessions per game, 114.5 offensive rating, 47.4% FG, 36.6% 3P, 78.4% FT, 39.5% of field-goal attempts from three, 24.4% FTA/FGA, and 13.6% turnover rate. Basketball-Reference reports a similar team profile including 43.5 rebounds, 26.7 assists, 7.5 steals, 5.1 blocks, 13.6 turnovers, and 18.7 fouls per team game.

These are benchmark anchors, not architecture constants. V2 should define profiles such as:

| Profile | Pace | Offense | 3PA share | Use |
|---|---:|---:|---:|---|
| Modern balanced | 98–101 | 112–116 | 36–41% | Default |
| High offense | 100–104 | 116–121 | 38–44% | Product preset |
| Defense-heavy | 94–99 | 104–111 | 32–38% | Product preset |
| Fast pace | 103–108 | 108–116 | 34–41% | Product preset |
| Historic-style | 88–94 | 98–108 | 20–30% | Optional fiction |

Player-level distributions need separate benchmark bands for stars, starters, rotation players, bench players, usage, minutes, efficiency, rebounding, playmaking, availability, career length, and salary. The calibration suite should compare percentiles and correlations, not just means.

## 5. Lessons from the Basketball GM contract-volatility experiment

The reported outcomes—productive stars taking unexplained pay cuts, ordinary starters receiving near-max salaries, and one-year deals collapsing in the next market—are symptoms of a market that lacks continuity and clearing logic. FOH's current implementation has related risk: `getPlayerContractMarketValue` is a rating-derived expectation, `buildExternalFaOffer` applies team-mode/tolerance multipliers, and `evaluatePlayerContractOffer` compares the offer to that expectation. Prior salary, comparable contracts, bidder count, cap-room depletion, and alternatives are not first-class inputs.

V2 should allow volatility only when a structured explanation exists: injury, age transition, role loss, cap-room exhaustion, market oversupply, contender discount, retention rights, or a bidding war. Store these factors on the contract event so unusual outcomes are inspectable.

## 6. Licensing and attribution

The ZenGM repository is a conceptual reference only. FOH must not copy Basketball GM source code, schemas wholesale, assets, text, or implementation-specific logic. External rules and statistical sources are cited for research and benchmark purposes. FOH v2 should maintain its own schema, algorithms, constants, tests, and fictional league identity.

## 7. Research conclusions

- Adopt: portable league files, explicit settings, schema-plus-invariant validation, optional large data, event history, and developer tooling.
- Avoid: a giant uncurated settings surface, source-level imitation, and rating-only value.
- Simplify: cap rules into three profiles and make Standard the eventual default.
- Calibrate: modern balanced basketball first, then expose profile deltas as presets.
- Differentiate: explainability, scouting uncertainty, multi-year AI organizations, and fact-separated narrative generation.
