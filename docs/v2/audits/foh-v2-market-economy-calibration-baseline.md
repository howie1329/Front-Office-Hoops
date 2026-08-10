# Front Office Hoops v2 — Multi-Season Economy Baseline

**Seed:** `foh-v2-market-economy-baseline`  
**Horizon:** 30 seasons  
**Result:** PASS

## Scenario arms

| Arm                   | Final cap multiple | Tax/cap drift | Max/cap drift | Result |
| --------------------- | -----------------: | ------------: | ------------: | ------ |
| Stable 2% growth      |              1.78× |         0.01% |         0.01% | Pass   |
| Standard 4% growth    |              3.12× |         0.01% |         0.01% | Pass   |
| High 7% growth stress |              7.11× |         0.01% |         0.00% | Pass   |
| Low tax pressure      |              3.12× |         0.01% |         0.01% | Pass   |
| High tax pressure     |              3.12× |         0.01% |         0.01% | Pass   |

## Comparison checks

- stableGrowthBelowStandard: Pass
- highGrowthAboveStandard: Pass
- lowTaxPressureAboveStandard: Pass
- highTaxPressureBelowStandard: Pass

This report validates deterministic line growth and sensitivity. Payroll turnover, development, retirement, draft inflow, and tax incidence remain League Loop integration evidence.
