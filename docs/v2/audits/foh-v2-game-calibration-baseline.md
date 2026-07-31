# V2 game-simulation calibration baseline

## Purpose

This is the first reproducible characterization report for the V2 matchup engine. It records what the current engine produces before any formula or slider-wiring changes.

The values below are diagnostic baseline values, not acceptance targets. A later calibration change should compare against this report and explain both intentional improvements and regressions.

## Run identity

- Repository commit at implementation start: 718d9f7
- Report schema: foh-matchup-calibration version 2
- Base seed: foh-v2-calibration-baseline
- Batch size: 100 games
- Completed: 100
- Failed: 0
- Injury frequency: off
- In-game injuries: false
- Team metric observations: 200, two teams per completed game
- Game metric observations: 100, one observation per completed game
- Reliability metric observations: 100, one observation per attempted game
- Benchmark profile: modern-balanced-v1
- Benchmark result: failed diagnostically; 5 of 17 checks passed

The core batch disables injuries so ordinary pace, scoring, and box-score distributions are not mixed with the known in-game injury reconciliation path. Injury behavior needs a separate benchmark run.

## Fixture

The fixture is the deterministic manual fixture factory in packages/calibration/tests/index.test.ts:

- two teams: home and away;
- eight players per team;
- five starters and three bench players;
- starter target minutes: 32;
- bench target minutes: 8;
- all players available;
- neutral coaching profiles at 50;
- standard simulation preset with injuries disabled.

## Effective configuration

| Section     | Setting                 |    Value |
| ----------- | ----------------------- | -------: |
| root        | version                 |        1 |
| root        | presetId                | standard |
| environment | pace                    |       50 |
| environment | scoringEnvironment      |       50 |
| environment | gameVariance            |       35 |
| environment | talentSeparation        |       65 |
| environment | homeCourtAdvantage      |       55 |
| offense     | threePointRate          |       55 |
| offense     | rimRate                 |       50 |
| offense     | midrangeRate            |       35 |
| offense     | shotSelectionDiscipline |       60 |
| offense     | starUsage               |       60 |
| offense     | ballMovement            |       55 |
| offense     | isolationRate           |       35 |
| offense     | transitionRate          |       50 |
| offense     | offensiveRebounding     |       45 |
| defense     | pressure                |       50 |
| defense     | helpDefense             |       55 |
| defense     | switching               |       45 |
| defense     | doubleTeamRate          |       25 |
| defense     | turnoverPressure        |       50 |
| defense     | foulDiscipline          |       55 |
| rotation    | adherence               |       70 |
| rotation    | benchUsage              |       45 |
| rotation    | starterWorkload         |       55 |
| rotation    | fatigueImpact           |       40 |
| coaching    | influence               |       50 |
| coaching    | paceInfluence           |       45 |
| coaching    | shotSelectionInfluence  |       45 |
| coaching    | defensiveInfluence      |       45 |
| injuries    | frequency               |      off |
| injuries    | severity                |    minor |
| injuries    | maxGamesOut             |        6 |
| injuries    | inGameInjuries          |    false |
| overtime    | enabled                 |     true |
| overtime    | segmentMinutes          |        5 |
| overtime    | maxSegments             |        6 |

## Metric definitions

- Percentages and rates are numerator divided by denominator multiplied by 100.
- A zero or non-finite denominator produces 0 rather than NaN or Infinity.
- Offensive efficiency is points per possession multiplied by 100.
- Team metrics aggregate one observation per team.
- Top-player points and top-player opportunities aggregate one observation per game.
- Top-player opportunity share is the highest player opportunity total on a team divided by that team’s possessions.
- Bench points share is non-starter points divided by team points.
- Starter and bench minutes are summed from player box scores.
- Reconciliation pass is measured over completed, reconciled runs; failure rate is the fraction of attempted runs that were retained as failures.

## Results

The mean, min-max, p10, median, and p90 values are reported exactly as produced by the calibration runner. A target is shown only for metrics in modern-balanced-v1.

| Metric                    |   n |   Mean |       Min-max |    P10 | Median |    P90 |  Target | Result |
| ------------------------- | --: | -----: | ------------: | -----: | -----: | -----: | ------: | ------ |
| homeScore                 | 100 |  63.55 |         38-87 |     48 |     63 |     79 |       — | —      |
| awayScore                 | 100 |  63.54 |         37-91 |     49 |     64 |     78 |       — | —      |
| totalScore                | 100 | 127.09 |        89-162 |    106 |    127 |    146 |       — | —      |
| homePossessions           | 100 | 100.23 |        90-110 |     94 |    100 |    106 |       — | —      |
| awayPossessions           | 100 | 100.41 |        90-111 |     95 |    100 |    105 |       — | —      |
| reconciliationPass        | 100 |      1 |           1-1 |      1 |      1 |      1 |     1-1 | PASS   |
| overtimePeriods           | 100 |   0.04 |           0-1 |      0 |      0 |      0 |       — | —      |
| injuryEvents              | 100 |      0 |           0-0 |      0 |      0 |      0 |       — | —      |
| failureRate               | 100 |      0 |           0-0 |      0 |      0 |      0 |  0-0.05 | PASS   |
| topPlayerPoints           | 100 |  19.83 |         11-29 |     15 |     19 |     25 |       — | —      |
| topPlayerOpportunities    | 100 |  24.03 |         19-31 |     21 |     24 |     27 |       — | —      |
| teamPoints                | 200 | 63.545 |         37-91 |     49 |     63 |     78 | 105-123 | FAIL   |
| teamPossessions           | 200 | 100.32 |        90-111 |     95 |    100 |    105 |  95-103 | PASS   |
| offensiveEfficiency       | 200 | 63.314 | 37.624-92.857 | 49.462 | 63.462 | 76.471 | 105-123 | FAIL   |
| fieldGoalPercentage       | 200 | 29.870 | 16.867-42.222 | 23.171 | 30.120 | 36.364 |   44-50 | FAIL   |
| threePointPercentage      | 200 | 21.132 |  3.125-44.828 | 11.111 | 21.212 |  31.25 |   33-40 | FAIL   |
| freeThrowPercentage       | 200 | 76.563 |         0-100 |     50 | 78.571 |    100 |   75-82 | PASS   |
| threePointAttemptRate     | 200 | 34.877 |         20-50 | 29.545 | 35.165 | 40.217 |   36-42 | FAIL   |
| freeThrowAttemptRate      | 200 |  9.896 |      0-25.926 |  2.532 |  9.195 | 17.045 |   20-28 | FAIL   |
| rimAttemptRate            | 200 | 41.412 |  26.25-55.556 | 35.294 | 41.379 | 48.052 |       — | —      |
| midrangeAttemptRate       | 200 | 23.711 | 12.048-32.927 | 18.390 | 23.457 | 28.916 |       — | —      |
| assists                   | 200 |   9.54 |          2-18 |      6 |      9 |     14 |   23-30 | FAIL   |
| turnovers                 | 200 | 11.245 |          4-21 |      7 |     11 |     15 |       — | —      |
| turnoverRate              | 200 | 11.202 |  3.960-21.505 |  7.071 |     11 | 15.385 |   12-15 | FAIL   |
| rebounds                  | 200 |   59.7 |         43-76 |     52 |     60 |     67 |   39-48 | FAIL   |
| offensiveRebounds         | 200 |  13.29 |          5-23 |      9 |     13 |     18 |    9-13 | FAIL   |
| defensiveRebounds         | 200 |  46.41 |         31-60 |     40 |     46 |     53 |       — | —      |
| steals                    | 200 |  8.205 |          2-17 |      5 |      8 |     12 |     6-9 | PASS   |
| blocks                    | 200 |   2.43 |           0-7 |      1 |      2 |      4 |     3-7 | FAIL   |
| fouls                     | 200 |  3.915 |           0-9 |      1 |      4 |      7 |   15-22 | FAIL   |
| topPlayerOpportunityShare | 200 | 22.558 | 17.647-31.313 | 19.626 | 22.222 |     26 |       — | —      |
| benchPointsShare          | 200 | 12.122 |      0-26.471 |  4.688 | 11.475 | 21.127 |       — | —      |
| starterMinutes            | 200 | 206.34 |   205.5-226.5 |  205.5 |  205.5 |  205.5 |       — | —      |
| benchMinutes              | 200 | 34.944 |     34.8-38.4 |   34.8 |   34.8 |   34.8 |       — | —      |

## Interpretation

The batch is deterministic and internally reconciled, and its possession volume is close to the initial modern-balanced envelope. The dominant quality failures are not random-run reliability failures: scoring, efficiency, shooting percentages, free-throw attempt rate, assists, blocks, and fouls are materially below the diagnostic envelope, while team rebounds are high. This supports treating the next work as engine calibration rather than merely adjusting the report or hiding user sliders.

The report also makes the distinction between output problems and configuration problems explicit. The effective config is preserved in the export, and benchmark targets live in calibration code rather than in the user-facing simulation settings.

## Reproduction

Run the focused suites:

- npm test --workspace=@workspace/sim-v2
- npm test --workspace=@workspace/calibration
- npm test --workspace=@workspace/league-schema
- npm run typecheck --workspace=@workspace/sim-v2
- npm run typecheck --workspace=@workspace/calibration
- npm run typecheck --workspace=@workspace/league-schema
- npm test --workspace=web-v2
- npm run typecheck --workspace=web-v2

The baseline report is generated with runMatchupBatch using baseSeed foh-v2-calibration-baseline, count 100, the fixture described above, and MODERN_BALANCED_BENCHMARK_PROFILE. serializeMatchupBatchReport validates the result against matchupBatchReportSchema before export.

## Maintenance

Future formula or slider-wiring changes should:

1. rerun this same seed and fixture;
2. compare the full metric table, not only total score;
3. update characterization expectations only for intentional behavior changes;
4. explain benchmark improvements and newly introduced regressions;
5. run a separate injury-enabled batch before changing injury reconciliation behavior.
