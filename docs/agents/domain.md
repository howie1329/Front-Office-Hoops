# Domain Docs

This repository uses a single-context domain documentation layout centered on Front Office Hoops V2.

V1 is legacy and transitional. It is expected to be deleted after V2 replacement work is complete. Do not create a separate durable domain context for V1, and do not change V1 surfaces unless the user explicitly requests it or a necessary cross-cutting change requires it.

## Before exploring, read these

- `CONTEXT.md` at the repository root
- Relevant architecture decisions under `docs/adr/`
- `docs/v2/plans/foh-v2-roadmap.md` for the authoritative V2 implementation sequence
- Relevant material under `docs/v2/` for the feature or system being changed

If `CONTEXT.md` or `docs/adr/` does not exist, proceed silently. Do not flag its absence or suggest creating it upfront. The domain-modeling workflow creates these files lazily when terminology or architectural decisions are resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   └── v2/
├── apps/
│   └── web-v2/
└── packages/
    ├── calibration/
    ├── db-v2/
    ├── domain-v2/
    ├── league-schema/
    └── sim-v2/
```

`CONTEXT.md` defines shared product and basketball-management terminology across V2. System-specific implementation details remain in the relevant package documentation and V2 plans rather than creating independent domain contexts.

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`. Do not drift to synonyms that the glossary explicitly avoids.

If a needed concept is absent, reconsider whether the language belongs to the project. If it represents a genuine gap, note it for the domain-modeling workflow.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.
