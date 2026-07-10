# Implementation Plans

Generated 2026-07-10. Execute in the order below. Each executor must read the
entire plan before starting, honor its STOP conditions, and update the status
row when finished.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Replace trade evaluation with projected player, contract, and team utility layers | P1 | L | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED | REJECTED.

## Dependency notes

- Plan 001 intentionally preserves trade legality and transaction execution. It replaces the valuation and acceptance layer first; counteroffers, league-wide AI trades, and trade UI explanations follow after the new evaluator has been tuned against its scenario suite.

## Findings considered and rejected

- Retuning only the existing age and acceptance constants: rejected. The current model double-counts contract incentives and cannot evaluate the receiving team's post-trade roster, so tuning would only hide the underlying defect.
