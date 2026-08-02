# Front Office Hoops v2 Development Cohorts UI Plan

> Archived on August 1, 2026. The implemented route is now governed by the [Career Cohort Explorer UI Brief](../specs/foh-v2-career-cohort-explorer-ui-brief.md).

**Status:** Implemented UI preview
**Review date:** 2026-07-29
**Branch:** `codex/development-cohorts-ui`

## Purpose

Create a UI-first Development Cohorts workspace that makes the V2 career-cohort concept concrete without implementing a second development simulation engine. The workspace is entered from the Developer Labs hub through the existing `Development cohorts` card.

This slice is intentionally fixture-backed. It establishes the interaction model, visual hierarchy, report shape, and future integration seam for a real Career Cohort Harness.

## Scope

### Developer Labs hub

- Make `Development cohorts` a clickable hub card.
- Link the card to `/developer-labs/development-cohorts`.
- Label the destination as a `UI preview` and identify it as fixture-backed.
- Keep Player Generation and Team Assembly unchanged.
- Keep other planned labs visible as planned, without adding routes or simulation behavior.

### Development Cohorts workspace

The new workspace provides:

- Primary and comparison cohort selection.
- Deterministic seed input.
- Sample-size and career-length controls.
- Minutes-opportunity and coaching-context controls.
- Validation for missing seeds, invalid sample sizes, and identical cohort selections.
- A fixture-preview run action, reset action, and JSON export.
- Summary metrics for sample size, net change, availability, and forecast accuracy.
- A trajectory chart comparing average career shape.
- Cohort outcome comparison table.
- Year-by-year trajectory table.
- Developer-only diagnostic notes and failed-seed context.
- Explicit fixture labeling so representative values are not mistaken for authoritative gameplay results.

## Design constraints

- Follow the V2 product register: precise, trustworthy, experimental, and evidence-oriented.
- Keep controls next to the evidence they affect.
- Prefer dense tables and comparisons over decorative metric-card repetition.
- Preserve visible reproducibility through seed and resolved run inputs.
- Separate true trajectory, forecast, realized production, and developer diagnostics in the UI language.
- Reuse existing `@workspace/ui` components, Inter typography, semantic status colors, focus states, and responsive table behavior.
- Do not add a chart dependency for this UI preview.
- Keep keyboard navigation, readable contrast, and reduced-motion-safe behavior intact.

## Files

- `apps/web-v2/src/routes/developer-labs.tsx` — hub card and navigation.
- `apps/web-v2/src/routes/developer-labs.development-cohorts.tsx` — workspace UI.
- `apps/web-v2/src/lib/developmentCohortLab.ts` — typed fixture report, options, validation, and serialization helpers.
- `apps/web-v2/src/lib/developmentCohortLab.test.ts` — deterministic fixture, validation, and export tests.
- `apps/web-v2/src/routeTree.gen.ts` — generated TanStack route registration.

## Deliberate non-goals

- No changes to `packages/sim-v2`, `packages/domain-v2`, or `packages/league-schema`.
- No annual skill-transition, aging, injury, recovery, or retirement engine.
- No new Game, Production & Value, Market, Draft, or other lab surfaces.
- No authoritative league state or gameplay behavior derived from the fixture report.

## Future integration seam

The fixture report should be replaced by a typed result from the combined Career Cohort Harness when that production boundary is ready. The UI already expects the required categories:

- skill trajectories;
- realized development events;
- injuries and recovery;
- availability;
- aging;
- retirement outcomes;
- cohort summaries;
- failed seeds and developer diagnostics.

The eventual runner should preserve the current distinction between visual inspection and headless distributional calibration. The route should consume a report; it should not own simulation rules.

## Validation completed

From the `apps/web-v2` workspace:

- `npm run typecheck --workspace web-v2`
- `npm run lint --workspace web-v2`
- `npm run test --workspace web-v2` — 12 tests passed across 3 files.
- `npm run build --workspace web-v2`
- `git diff --check`
