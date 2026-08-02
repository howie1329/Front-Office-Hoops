---
name: Front Office Hoops V2
description: A calm, text-first front door to a serious basketball front-office simulation.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
typography:
  family: "'Inter Variable', sans-serif"
  bodySize: "1rem"
  bodyLineHeight: 1.5
  displayWeight: 600
  labelWeight: 600
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "32px"
  xl: "48px"
layout:
  maxWidth: "88rem"
  radius: "0"
---

# V2 Design System

## 1. Overview

**Creative North Star: “The League Office Brief.”**

V2 should feel like a clear, confident introduction to a serious basketball simulation. The landing page is deliberately sparse: white space, strong Inter typography, a small number of actions, and thin rules that make the page feel organized without turning it into a dashboard or marketing campaign.

The public shell and the operating product have different densities:

- The **landing page** orients the user and gets them to league creation quickly.
- **League screens** can become denser because the user is making decisions.
- **Developer Labs** expose controls and evidence for calibration, with no decorative product theater.

The visual language should remain continuous across all three: white-first surfaces, near-black command ink, muted gray supporting text, and the same Inter family.

## 2. Color

Use the semantic tokens in `src/styles.css`. Do not introduce route-level hex values or a second palette.

- **Background:** `--background`, white by default.
- **Foreground:** `--foreground`, near-black reading and command text.
- **Primary:** `--primary`, the only strong action color; use it for create/start actions and current intent.
- **Muted foreground:** `--muted-foreground`, supporting copy and quiet navigation.
- **Border:** `--border`, 1px rules that establish structure.
- **Ring:** `--ring`, visible keyboard focus.

Dark mode is reserved for a later, explicit product decision. The V2 landing page must start in the light theme and must not simulate dark mode through local classes.

### Color rules

- Keep the strategy restrained: white, near-black, muted gray, and one command color.
- Use opacity or semantic muted tokens for hierarchy, never new gray values in a route.
- Reserve destructive colors for errors and risky actions.
- Verify body and muted text contrast against white before shipping.

## 3. Typography

Inter Variable is the single type family for the product. It is familiar, fast, and legible in both the landing page and dense operational surfaces.

- **Display:** semibold, tight but readable tracking, used only for the landing-page statement or major product titles.
- **Body:** regular, at least `1rem` when used as explanatory copy, with a comfortable line height.
- **Labels and links:** semibold, direct, and never dependent on all-caps styling for hierarchy.
- **Data and controls:** use the same family with a tighter, fixed scale appropriate to the task.

The landing page uses a large but bounded heading. Do not add a display font, gradient text, outlined type, or long all-caps eyebrow system.

## 4. Layout and density

The landing page is a single viewport composition at common desktop sizes:

1. A compact header with the product mark, `Roadmap`, `The game`, and `Create league`.
2. One primary text block explaining the game and offering the primary CTA.
3. A linear V2 roadmap using headings, short descriptions, and horizontal rules.
4. A small footer for product context.

Use a centered container capped at `88rem`, with responsive side padding. At large widths, the game statement and roadmap sit in two columns. Below the large breakpoint, they stack in reading order. On phones, the page may scroll when necessary to keep text readable; do not shrink body copy or hide roadmap content just to force a desktop-like fit.

### Spacing rhythm

Use the existing 4/8/16/32/48px rhythm. Group related content tightly, then use larger gaps between the hero and roadmap. Prefer `gap` and section padding over arbitrary element margins.

### Structure over decoration

Rules, alignment, typography, and whitespace are the primary visual materials. Cards are not the default grouping mechanism. Use a bordered panel only when it gives a real task or state a clear boundary; the landing page does not need cards.

## 5. Components

### Header

- Keep the header compact and bordered on the bottom.
- Brand link returns to `/`.
- `Roadmap` and `The game` are quiet anchor links.
- `Create league` is the single filled primary action.
- Keep focus-visible outlines on every link.

### Primary action

Use a square-cornered, near-black `bg-primary` link with `text-primary-foreground`. The label must say what happens: `Create league` or `Create your league`. An arrow is allowed as a small text cue, not as the only affordance.

### Text links

Secondary destinations such as Developer Labs use foreground text with an underline or rule. They should be visibly lower priority than the primary CTA while remaining easy to find and keyboard accessible.

### Roadmap list

Use a semantic heading and a linear list of short rows. Separate rows with 1px `border-border` rules. Each row has a concise title and a plain-language explanation; avoid metric tiles, icons, badges, and repeated cards.

## 6. Motion and interaction

Motion is optional and subordinate to reading. Use short opacity or color transitions for hover and focus feedback. Do not orchestrate page-load reveals or animate the landing page into view. Any future motion must respect `prefers-reduced-motion: reduce`.

## 7. Do and don't

### Do

- Do make the page understandable in one glance.
- Do keep the primary action visible without scrolling on desktop.
- Do use the global CSS tokens for every color.
- Do keep copy specific to the front-office fantasy.
- Do preserve semantic headings, landmarks, and link destinations.
- Do let operational surfaces become denser when the user needs to compare data.

### Don't

- Don't add gradients, hero illustrations, background patterns, or decorative sports imagery.
- Don't bring back the long multi-section landing page.
- Don't use card grids, metric tiles, or SaaS-style feature packaging on the landing page.
- Don't start the V2 landing page in dark mode.
- Don't use sports-media hype, betting language, or fake stats.
- Don't hide the roadmap or primary action behind a menu on desktop.
