# Front Office Hoops v2 — Market Calibration Baseline

**Seed:** `foh-v2-market-baseline`  
**Runs:** 100/100 completed; 0 failed  
**Benchmark:** PASS

## Benchmark checks

| Check                 |  Actual |     Range | Result |
| --------------------- | ------: | --------: | ------ |
| reconciliation        |  1.0000 |    1 to — | Pass   |
| legality              |  0.0000 |    — to 0 | Pass   |
| hardCap               |  0.0000 |    — to 0 | Pass   |
| rosterCapacity        |  0.0000 |    — to 0 | Pass   |
| explanations          |  1.0000 |    1 to — | Pass   |
| valueToSalary         |  0.9003 |  0.6 to — | Pass   |
| salaryTierOrdering    |  1.0000 |    1 to — | Pass   |
| signedPool            |  0.8600 |  0.5 to 1 | Pass   |
| starAvailability      |  0.0000 |  — to 0.1 | Pass   |
| meaningfulUserTargets | 13.0000 |    1 to — | Pass   |
| demandContinuityLow   |  0.9490 | 0.75 to — | Pass   |
| demandContinuityHigh  |  0.9683 | — to 1.25 | Pass   |
| bidderCoverage        |  1.5700 |  0.5 to 6 | Pass   |
| taxPressure           |  0.0000 | — to 0.75 | Pass   |

## Market summary

- Median signed rate: 86.0%
- Median value/salary correlation: 0.900
- Median actionable user targets: 13.0
- Median tax-team rate: 0.0%
- Maximum illegal-decision rate: 0.0%
- Maximum roster-capacity violation rate: 0.0%

## Salary by quality tier

| Tier     | Count | Median cap share |   P10 |   P90 |
| -------- | ----: | ---------------: | ----: | ----: |
| depth    |  7284 |             0.7% |  0.7% |  6.6% |
| rotation |  1061 |            12.4% |  9.8% | 16.9% |
| starter  |   174 |            24.3% | 20.3% | 29.0% |
| star     |    73 |            32.9% | 30.2% | 34.7% |

## Retained outliers

- None.

The JSON companion report contains every per-seed summary, effective settings, failures, and reproducible outlier seeds.
Tax frequency is observational in this external-free-agent arm; re-signing and integrated economy scenarios own the minimum tax-pressure gate.
