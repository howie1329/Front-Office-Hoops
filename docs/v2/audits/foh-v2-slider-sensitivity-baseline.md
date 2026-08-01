# V2 slider sensitivity baseline

## Run metadata

- Git HEAD: 98d59a5
- Implementation commit: cc46c8d
- Implementation tree: dirty; diff SHA-256 (excluding this metadata file): fda02ac487ea8ff2ac09f62186b786bb644fa1f518ebeb3b9581d40943f1fbb6
- Run date: 2026-07-31
- Report schema: foh-slider-sensitivity version 1
- Standard base seed: foh-v2-slider-baseline
- Coaching base seed: foh-v2-slider-coaching-baseline
- Matched-fixture base seed: foh-v2-slider-matched-baseline
- Arm count: 50 games per arm
- Arm values: descriptor minimum, 25th percentile, effective baseline, 75th percentile, descriptor maximum
- Reproduction runner: packages/calibration/tests/sensitivityBaseline.ts

The report is generated from the Plan 002 implementation at the listed
implementation commit. The repository baseline commit identifies the source
baseline used for comparison.

## Fixture scenarios

The standard scenario uses eight players per team, five starters, three bench
players, neutral coach profiles, standard settings, injuries off, and the
same target-minute shape used by the calibration tests.

The matched scenarios add only the context required to observe a setting:

- matched-coaches gives home and away coaches materially different pace,
  offensive, defensive, and shot-selection profiles;
- talent makes the home team materially stronger than the away team;
- rotation uses non-default manual target minutes;
- injuries enables frequent in-game events with enough bench depth.

All paired arms completed their requested 50 games during this run. No fixture
validation or reconciliation failures were observed.

## Effective standard configuration

The standard baseline used the following effective config:

- Environment: pace 50, scoring environment 50, game variance 35, talent
  separation 65, home court 55.
- Offense: three-point rate 55, rim rate 50, mid-range rate 35,
  shot-selection discipline 60, star usage 60, ball movement 55, isolation
  rate 35, transition rate 50, offensive rebounding 45.
- Defense: pressure 50, help defense 55, switching 45, double-team rate 25,
  turnover pressure 50, foul discipline 55.
- Rotation: adherence 70, bench usage 45, starter workload 55, fatigue impact 40.
- Coaching: overall influence 50, pace influence 45, shot-selection influence
  45, defensive influence 45.
- Injuries: frequency off, minor severity, maximum games out 6, in-game
  injuries disabled.
- Overtime: enabled, five-minute segments, six-segment soft limit.

## Classification summary

Delta is the high-arm signal minus the low-arm signal for the primary metric.
For spread and distance metrics, it uses the declared spread or distance
signal rather than the raw mean. A standard no-op for a coaching or injury
setting is expected when the required fixture context is neutral or disabled.

| Setting                         | Primary signal               | Direction         | Classification | Evidence                                                                                              |
| ------------------------------- | ---------------------------- | ----------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| environment.pace                | teamPossessions              | Increase          | Wired          | Standard delta +10.92; 50/50 paired games changed.                                                    |
| environment.scoringEnvironment  | teamPoints                   | Increase          | Wired          | Standard delta +14.09; 50/50 changed.                                                                 |
| environment.gameVariance        | totalScore spread            | Spread increase   | Wired          | Standard spread delta +6.00.                                                                          |
| environment.talentSeparation    | strongTeamPointDiff          | Increase          | Conditional    | Standard delta -0.44; talent fixture delta +15.24; contextual effect is strongest with talent spread. |
| environment.homeCourtAdvantage  | homeCourtPointDiff           | Increase          | Wired          | Standard delta +10.02; 50/50 changed.                                                                 |
| offense.threePointRate          | threePointAttemptRate        | Increase          | Wired          | Standard delta +13.50.                                                                                |
| offense.rimRate                 | rimAttemptRate               | Increase          | Wired          | Standard delta +10.32.                                                                                |
| offense.midrangeRate            | midrangeAttemptRate          | Increase          | Wired          | Standard delta +10.03.                                                                                |
| offense.shotSelectionDiscipline | fieldGoalPercentage          | Increase          | Wired          | Standard delta +1.07; 46/50 changed.                                                                  |
| offense.starUsage               | topPlayerOpportunityShare    | Increase          | Wired          | Standard delta +1.17; 50/50 changed.                                                                  |
| offense.ballMovement            | assists                      | Increase          | Wired          | Standard delta +7.95.                                                                                 |
| offense.isolationRate           | assists                      | Decrease          | Wired          | Standard delta -5.05.                                                                                 |
| offense.transitionRate          | transitionAttemptProxy       | Increase          | Wired          | Standard delta +7.34.                                                                                 |
| offense.offensiveRebounding     | offensiveRebounds            | Increase          | Wired          | Standard delta +4.74.                                                                                 |
| defense.pressure                | turnovers                    | Increase          | Wired          | Standard delta +2.00.                                                                                 |
| defense.helpDefense             | blocks                       | Increase          | Wired          | Standard delta +1.22.                                                                                 |
| defense.turnoverPressure        | turnovers                    | Increase          | Wired          | Standard delta +3.38.                                                                                 |
| defense.switching               | observation only             | Observe           | Unknown        | Exact no-op: 0/50 paired games changed.                                                               |
| defense.doubleTeamRate          | creatorTurnovers             | Increase          | Wired          | Standard delta +0.64; 34/50 changed.                                                                  |
| defense.foulDiscipline          | fouls                        | Decrease          | Wired          | Standard delta -1.14.                                                                                 |
| rotation.adherence              | rotationTargetError          | Distance decrease | Wired          | Standard delta -55.70.                                                                                |
| rotation.benchUsage             | benchPointsShare             | Increase          | Wired          | Standard delta +2.75.                                                                                 |
| rotation.starterWorkload        | starterMinutes               | Increase          | Wired          | Standard delta +9.52.                                                                                 |
| rotation.fatigueImpact          | lateEfficiencyDelta          | Decrease          | Unknown        | Standard delta -3.56, but adjacent arms remained noisy.                                               |
| coaching.influence              | coachPaceAlignedPossessions  | Increase          | Conditional    | Neutral coaches no-op; matched-coach delta +5.30.                                                     |
| coaching.paceInfluence          | coachPaceAlignedPossessions  | Increase          | Conditional    | Neutral coaches no-op; matched-coach delta +5.88.                                                     |
| coaching.shotSelectionInfluence | coachShotSelectionAlignedMix | Increase          | Conditional    | Neutral coaches no-op; matched-coach delta +2.03.                                                     |
| coaching.defensiveInfluence     | coachDefenseAlignedTurnovers | Increase          | Conditional    | Neutral coaches no-op; matched-coach delta +1.86.                                                     |
| injuries.maxGamesOut            | injuryDuration               | Increase          | Saturated      | Injuries-off scenarios no-op; injury scenario changed 11/50 but the max-duration signal was flat.     |

## Changes made from the sensitivity evidence

- Added a shared typed numeric-setting path and clone/update helper. The lab
  now uses the same mutation semantics as calibration, preserves custom preset
  state, and keeps all existing slider labels and bounds.
- Added the five-arm paired sensitivity runner, derived diagnostic metrics,
  scenario classification, deterministic serialization, and strict schema
  validation.
- Added rotation adherence by blending manual targets with the neutral
  depth-based allocation before normalization.
- Replaced the common-canceled star and bench weights with relative
  opportunity effects.
- Made fatigue impact affect late-period shot conversion rather than only
  multiplying every player-choice weight.
- Added bounded shot-selection discipline, transition shot-profile behavior,
  double-team creator pressure, and the home-court efficiency edge.
- Routed overall, pace, shot-selection, and defensive coaching influence
  through effective coach profiles centered on neutral 50.

## Explicitly deferred

Defense switching remains visible and editable but is not assigned a placeholder
multiplier. The current possession model selects a defender by general skill and
does not retain an assignment or mismatch state. A credible switching effect
requires a small defender-assignment model and should be a separate plan.

Game variance remains an unknown calibration signal, not a slider-wiring
failure. Its output changes, but this report does not yet establish a stable
monotonic spread under the current sample and metric definition.

Maximum games out is already read by the injury-duration branch. The
injury-enabled sweep changed event outcomes but reached a saturated duration
signal in this sample; it should not be reworked until injury event frequency
and duration are calibrated together.

## Reproduction

Run the full 50-game sensitivity baseline summary:

    npm run sensitivity-baseline --workspace=@workspace/calibration

Run the focused unit and schema coverage:

    npm test --workspace=@workspace/calibration
    npm test --workspace=@workspace/sim-v2
    npm test --workspace=@workspace/league-schema

The runner prints machine-readable summaries using the same
runSliderSensitivity and serializeSliderSensitivityReport APIs used by the
tests. It does not expose random draws or private formula coefficients.
