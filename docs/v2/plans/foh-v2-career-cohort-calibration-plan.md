# Front Office Hoops v2 Career Cohort Calibration

**Status:** Implemented harness; calibration and League Loop promotion pending  
**Date:** August 1, 2026  
**Roadmap position:** Phase 2 calibration; future Phase 6 lifecycle integration  
**Companion:** [Career Cohort Explorer UI Brief](../specs/foh-v2-career-cohort-explorer-ui-brief.md)

## Purpose

This is the active plan for V2 career development, aging, availability, and
retirement calibration. It consolidates the earlier career-harness,
curve/explorer, settings-pipeline, growth-calibration, and development-cohorts
UI plans.

The Career Cohort Harness is developer-facing calibration infrastructure. It
uses the same player-generation and annual transition functions intended for
the future League Loop, but its reports are evidence rather than authoritative
league state.

## Current implementation

The current harness supports:

- Deterministic individual traces, cohorts, and matched comparisons.
- Growth, plateau, decline, availability, injury context, and retirement outputs.
- Persisted growth and decline curve traits on generated players.
- Typed development settings with validation, defaults, resolution, worker transport, and report persistence.
- Worker progress, cancellation, stale-result handling, event evidence, and JSON report export.
- A cohort explorer with player selection, timeline inspection, distributions, and comparison evidence.

The current UI surface is `/developer-labs/development-cohorts`.

## Calibration work remaining

Acceptance work must establish stable ranges for:

1. Standard growth from young and draft populations.
2. Separation between curve tiers without deterministic outcomes.
3. Controlled breakouts, variance, and late development.
4. Potential forecasts versus realized peaks.
5. Injury and availability effects on development and career length.
6. Retirement age and career-survival distributions.

Each accepted result must retain the seed, resolved settings, fixture, report,
benchmark interpretation, and failed outliers.

## Promotion boundary

Career outputs may enter authoritative league simulation only after:

- The standard settings have accepted distribution bands.
- The same annual transition contract is callable from the League Loop.
- Development, injury, availability, and retirement events can be persisted in the league document.
- Reload, export/import, and multi-season invariants preserve the resulting facts.

The League Loop must not reimplement career transitions inside UI code or a
separate league-only module.

## Verification

Run the focused career tests, schema tests, V2 typechecks, and the worker-backed
web tests. Keep the explorer UI aligned with the companion brief and update
this plan when a calibration gate changes from pending to accepted.

