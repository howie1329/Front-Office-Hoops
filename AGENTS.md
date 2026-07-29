# Repository Agent Defaults

Unless the user explicitly says otherwise, work on the Front Office Hoops v2 rewrite.

- Prefer `apps/web-v2`, `packages/domain-v2`, `packages/league-schema`, `packages/sim-v2`, `packages/db-v2`, and `docs/v2`.
- Treat `docs/v2/plans/foh-v2-roadmap.md` as the authoritative V2 sequence.
- Keep V1 runnable and avoid changing `apps/web`, `packages/sim`, or other V1 surfaces unless the user explicitly requests V1 work or a cross-cutting change requires it.
- Current V2 priority is calibration: game simulation first, then production and universal player value, then the authoritative league shell.
- Preserve deterministic seeds, schema contracts, validation, and focused tests when extending V2.
