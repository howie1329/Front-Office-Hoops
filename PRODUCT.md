# Product

## Register

product

## Users

Front Office Hoops has two connected audiences:

- **Players** who want to run a fictional basketball organization, make consequential front-office decisions, and see those choices compound across seasons.
- **Developers/operators** who calibrate the simulation through bounded, reproducible labs before systems become gameplay.

## Product Purpose

Front Office Hoops is a browser-hosted, local-first basketball front-office simulation. The V2 landing page is the public entry point: it explains the game plainly, points to the product roadmap, and gives the user one clear next step—create a league.

The playable product lets a user build and operate a fictional franchise through roster construction, contracts, player development, games, drafts, free agency, and league history. The Developer Labs area remains a separate, inspectable workspace for calibrating simulation models without requiring a complete playable league.

## Brand Personality

Precise, calm, trustworthy, and quietly ambitious. The product should feel like a serious league office with enough restraint that the simulation—not the presentation—carries the excitement.

## Anti-references

Avoid sports-media presentation, fantasy-sports betting dashboards, game-store decoration, promotional SaaS layouts, and opaque black-box controls. The landing page should not look like an ad campaign, and the labs should not feel like a player-card collector or hide model assumptions behind polished visuals.

## Design Principles

- **State the game plainly.** Use direct language about the front-office fantasy instead of hype, sports clichés, or feature inventories.
- **Give the user one obvious next step.** The public shell should make creating a league the primary action and keep roadmap/lab links secondary.
- **Let density carry hierarchy.** Prefer a linear flow of text, spacing, and rules over cards, illustrations, gradients, or decorative panels.
- **Make the simulation credible.** Every generated result should be reproducible from visible inputs, and important outcomes should be explainable.
- **Keep controls near their evidence.** Put model controls next to the results they affect in labs and keep the public landing page focused on orientation.
- **Separate invitation from operation.** The landing page is sparse and welcoming; league screens and labs can become denser when the task requires it.

## Accessibility & Inclusion

Use semantic landmarks, visible keyboard focus, readable contrast, generous action targets, and links that describe their destination. Do not rely on color alone for state. Support reduced motion and allow the layout to scroll naturally on small screens when preserving readable text requires it.

## Source of Truth

This file defines the product and brand direction. The V2 simulation mechanics remain documented in [`docs/v2/specs/foh-v2-product-brief.md`](docs/v2/specs/foh-v2-product-brief.md), and the V2 landing-page visual system is documented in [`apps/web-v2/DESIGN.md`](apps/web-v2/DESIGN.md).
