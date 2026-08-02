# V2 game-simulation calibration baseline

## Purpose

This is the reproducible calibration baseline after the core-distribution and
ledger reconciliation pass. It characterizes the standard V2 matchup engine
without changing the public GameResult shape or user-facing slider contract.

The values below are a review baseline. Benchmark ranges are acceptance bands,
not a request to match one exact game.

## Run identity

- Starting commit: ee0621a
- Report schema: foh-matchup-calibration version 2
- Base seed: foh-v2-calibration-plan-005
- Batch size: 1,000 games
- Completed: 1,000
- Failed: 0
- Injury frequency: off
- In-game injuries: false
- Team metric observations: 2,000, two teams per completed game
- Game metric observations: 1,000, one observation per completed game
- Reliability metric observations: 1,000, one observation per attempted game
- Benchmark profile: modern-balanced-v1
- Benchmark result: all configured checks passed

The batch disables injuries so ordinary pace, scoring, and box-score
distributions are not mixed with the in-game injury path. Injury behavior
should continue to use a separate benchmark run.

## Fixture

The fixture is the deterministic standard calibration fixture in
`packages/calibration/tests/fixtures.ts`:

- two teams: home and away;
- eight players per team;
- five starters and three bench players;
- starter target minutes: 32;
- bench target minutes: 8;
- all players available;
- neutral coaching profiles at 50;
- standard simulation preset with injuries disabled.

## Metric definitions

- Percentages and rates are numerator divided by denominator multiplied by 100.
- A zero or non-finite denominator produces 0 rather than NaN or Infinity.
- Offensive efficiency is points per possession multiplied by 100.
- Team metrics aggregate one observation per team.
- Top-player points and opportunities aggregate one observation per game.
- Second-chance attempts are shots after an offensive-rebound continuation.
- Second-chance points are points scored on those continuation shots.
- Shooting and non-shooting foul metrics are internal ledger telemetry; they are
  not serialized into GameResult.
- Reconciliation pass is measured over completed, reconciled runs; failure rate
  is the fraction of attempted runs retained as failures.

## Results

The calibration runner reports count, mean, p10, median, and p90. Targets are
shown for metrics in `modern-balanced-v1`.

| Metric                                |     n |    Mean |     P10 |  Median |     P90 |  Target | Result |
| ------------------------------------- | ----: | ------: | ------: | ------: | ------: | ------: | ------ |
| homeScore                             | 1,000 | 106.498 |      91 |     106 |     122 |       — | —      |
| awayScore                             | 1,000 | 105.703 |      90 |     106 |     121 |       — | —      |
| totalScore                            | 1,000 | 212.201 |     189 |     212 |     235 |       — | —      |
| homePossessions                       | 1,000 | 100.448 |      96 |     100 |     105 |       — | —      |
| awayPossessions                       | 1,000 | 100.003 |      95 |     100 |     105 |       — | —      |
| reconciliationPass                    | 1,000 |   1.000 |       1 |       1 |       1 |     1–1 | PASS   |
| overtimePeriods                       | 1,000 |   0.019 |       0 |       0 |       0 |       — | —      |
| injuryEvents                          | 1,000 |   0.000 |       0 |       0 |       0 |       — | —      |
| failureRate                           | 1,000 |   0.000 |       0 |       0 |       0 |  0–0.05 | PASS   |
| topPlayerPoints                       | 1,000 |  36.931 |      28 |      36 |      47 |       — | —      |
| topPlayerOpportunities                | 1,000 |  29.379 |      24 |      29 |      35 |       — | —      |
| teamPoints                            | 2,000 | 106.100 |      91 |     106 |     122 | 105–123 | PASS   |
| teamPossessions                       | 2,000 | 100.225 |      95 |     100 |     105 |  95–103 | PASS   |
| offensiveEfficiency                   | 2,000 | 105.849 |  91.489 | 105.660 | 120.388 | 105–123 | PASS   |
| fieldGoalsMade                        | 2,000 |  39.847 |      33 |      40 |      47 |   35–43 | PASS   |
| fieldGoalsAttempted                   | 2,000 |  82.099 |      73 |      82 |      90 |   72–90 | PASS   |
| threePointersMade                     | 2,000 |  11.468 |       8 |      11 |      16 |   10–16 | PASS   |
| threePointersAttempted                | 2,000 |  29.883 |      23 |      30 |      37 |   27–40 | PASS   |
| freeThrowsMade                        | 2,000 |  14.938 |       9 |      15 |      22 |   14–21 | PASS   |
| freeThrowsAttempted                   | 2,000 |  19.398 |      12 |      19 |      28 |   18–30 | PASS   |
| fieldGoalPercentage                   | 2,000 |  48.598 |  41.489 |  48.684 |  55.556 |   44–50 | PASS   |
| threePointPercentage                  | 2,000 |  38.406 |  27.273 |  38.235 |  50.000 |   33–40 | PASS   |
| freeThrowPercentage                   | 2,000 |  77.037 |  63.636 |  77.778 |  89.286 |   75–82 | PASS   |
| threePointAttemptRate                 | 2,000 |  36.395 |  29.487 |  36.145 |  43.210 |   36–42 | PASS   |
| freeThrowAttemptRate                  | 2,000 |  24.008 |  13.636 |  22.892 |  35.484 |   20–28 | PASS   |
| rimAttemptRate                        | 2,000 |  41.160 |  34.146 |  41.250 |  48.193 |       — | —      |
| midrangeAttemptRate                   | 2,000 |  22.445 |  16.438 |  22.340 |  28.571 |       — | —      |
| assists                               | 2,000 |  28.456 |      22 |      28 |      34 |   23–30 | PASS   |
| assistRate                            | 2,000 |  71.430 |  61.765 |  71.739 |  80.488 |   55–78 | PASS   |
| turnovers                             | 2,000 |  12.109 |       8 |      12 |      16 |       — | —      |
| turnoverRate                          | 2,000 |  12.082 |   8.081 |  11.881 |  16.327 |   12–15 | PASS   |
| rebounds                              | 2,000 |  42.252 |      35 |      42 |      49 |   39–48 | PASS   |
| offensiveRebounds                     | 2,000 |   9.017 |       5 |       9 |      13 |    9–13 | PASS   |
| defensiveRebounds                     | 2,000 |  33.234 |      27 |      33 |      40 |       — | —      |
| offensiveReboundRate                  | 2,000 |  21.180 |  14.286 |  21.154 |  28.261 |   17–28 | PASS   |
| steals                                | 2,000 |   8.719 |       5 |       9 |      13 |     6–9 | PASS   |
| blocks                                | 2,000 |   3.248 |       1 |       3 |       6 |     3–7 | PASS   |
| blockRate                             | 2,000 |   3.946 |   1.250 |   3.704 |   6.849 |     3–8 | PASS   |
| fouls                                 | 2,000 |  15.035 |      11 |      15 |      20 |   15–22 | PASS   |
| shootingFouls                         | 2,000 |   9.153 |       5 |       9 |      13 |    7–13 | PASS   |
| nonShootingFouls                      | 2,000 |   5.882 |       3 |       6 |       9 |     4–9 | PASS   |
| shootingFoulRate                      | 2,000 |   9.146 |   5.357 |   8.911 |  13.084 |    7–13 | PASS   |
| nonShootingFoulRate                   | 2,000 |   5.878 |   3.000 |   5.825 |   9.000 |     4–9 | PASS   |
| secondChanceAttempts                  | 2,000 |   9.017 |       5 |       9 |      13 |    7–13 | PASS   |
| secondChancePoints                    | 2,000 |   9.951 |       4 |       9 |      16 |    6–16 | PASS   |
| secondChanceAttemptRate               | 2,000 |  10.876 |   7.042 |  10.811 |  14.773 |    8–15 | PASS   |
| secondChancePointsPerOffensiveRebound | 2,000 | 110.397 |  61.538 | 110.000 | 162.500 |  80–140 | PASS   |
| topPlayerOpportunityShare             | 2,000 |  26.888 |  22.000 |  26.214 |  32.653 |       — | —      |
| benchPointsShare                      | 2,000 |  10.032 |   4.444 |   9.783 |  15.842 |       — | —      |
| starterMinutes                        | 2,000 | 192.902 | 185.600 | 192.900 | 199.600 |       — | —      |
| benchMinutes                          | 2,000 |  47.574 |  41.800 |  47.100 |  54.500 |       — | —      |

## Interpretation

The batch is deterministic, fully reconciled, and now lands inside the modern
balanced acceptance bands for pace, scoring, shooting, free throws, assists,
turnovers, rebounds, steals, blocks, fouls, and second-chance scoring.

The engine now records each team possession once in an internal ledger. Missed
shots carry exactly one rebound outcome, offensive rebounds can create one
bounded continuation without adding a possession, and shooting fouls are the
only foul type that creates free throws. Reconciliation recomputes expected
totals from that ledger and compares them with the projected player/team box
scores.

## Reproduction

Run the focused suites:

- `npm test --workspace=@workspace/sim-v2`
- `npm test --workspace=@workspace/calibration`
- `npm test --workspace=@workspace/league-schema`
- `npm run typecheck --workspace=@workspace/sim-v2`
- `npm run typecheck --workspace=@workspace/calibration`
- `npm run typecheck --workspace=@workspace/league-schema`
- `npm test --workspace=web-v2`
- `npm run typecheck --workspace=web-v2`

The report is generated with `runMatchupBatch`, base seed
`foh-v2-calibration-plan-005`, count `1,000`, the standard calibration fixture,
and `MODERN_BALANCED_BENCHMARK_PROFILE`.

## Maintenance

Future formula or slider-wiring changes should:

1. rerun this same seed and fixture;
2. compare the full metric table, not only total points;
3. update characterization expectations only for intentional behavior changes;
4. explain benchmark improvements and newly introduced regressions;
5. run a separate injury-enabled batch before changing injury reconciliation.
