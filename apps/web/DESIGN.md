---
name: Front Office Hoops
description: Simulation-first basketball GM product with a compact league-office interface.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  headline:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
  title:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
  body:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0"
  label:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  sm: "4.32px"
  md: "5.76px"
  lg: "7.2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 8px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 8px"
    typography: "{typography.label}"
  input-default:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "2px 8px"
    typography: "{typography.title}"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Front Office Hoops

## 1. Overview

**Creative North Star: "The League Office Console"**

Front Office Hoops should feel like a front-office operating surface for serious basketball simulation players: compact, direct, and trustworthy. The interface earns confidence through clear hierarchy, predictable controls, dense tables, and league-state visibility rather than sports-media decoration.

The current system is a restrained monochrome product UI built on Inter, OKLCH tokens, low-radius controls, tonal surfaces, and border/ring separation. It should stay fast and utilitarian: screens should make the next league decision obvious, keep actions near the data they affect, and preserve enough density for expert users to work quickly.

It explicitly rejects mobile game store UI, ESPN-style news pages, fantasy-sports betting dashboards, and over-marketed SaaS landing pages. The design should never feel promotional when the user is trying to manage a league.

**Key Characteristics:**
- Compact product density for simulation-first workflows.
- Monochrome operational palette with rare semantic color.
- Inter-only typography tuned for tables, cards, buttons, and labels.
- Flat surfaces separated by borders, rings, and muted state layers.
- Consistent control vocabulary across league navigation, forms, tables, and cards.

## 2. Colors

The palette is operational monochrome: white and near-black carry the product, muted gray layers separate state, and red is reserved for destructive or error conditions.

### Primary
- **Ink Command**: The primary action and active emphasis color. It should appear on decisive actions, current intent, and command surfaces only.

### Neutral
- **White Board**: The main background and card surface. It keeps league data readable and leaves room for dense tables.
- **Roster Sheet**: The muted surface layer for secondary buttons, quiet panels, hover rows, and supporting UI.
- **Ledger Line**: The border and input stroke color. It defines structure without adding visual noise.
- **Bench Note**: The muted text color. Use for secondary timestamps, descriptions, captions, and low-priority metadata.
- **Focus Ring**: The ring color for keyboard focus and validation feedback.

### Tertiary
- **Cut Deadline Red**: The destructive and error color. Use only for errors, invalid states, and risky actions.

### Named Rules

**The One Serious Accent Rule.** Primary color is command ink, not decoration. Do not introduce saturated team-color styling until a screen has a real semantic need for it.

**The Red Means Risk Rule.** Destructive red is reserved for errors, invalid states, and irreversible actions. Never use it as sports-energy accent.

## 3. Typography

**Display Font:** Inter Variable (with sans-serif fallback)
**Body Font:** Inter Variable (with sans-serif fallback)
**Label/Mono Font:** Inter Variable (with sans-serif fallback)

**Character:** One font family carries the whole product. The system should feel precise and familiar, with small, readable type optimized for controls, tables, and league state rather than expressive brand moments.

### Hierarchy
- **Display** (500, 1rem, 1.5): Use sparingly for app-level or page-level headings. Product UI does not use oversized display type.
- **Headline** (500, 1rem, 1.5): League names and top-level screen labels.
- **Title** (500, 0.875rem, 1.5): Card titles, panel headers, and compact section headings.
- **Body** (400, 0.875rem, 1.75): Standard prose and explanatory copy. Cap long prose at 65-75ch, but allow data tables to run wider when needed.
- **Label** (500, 0.75rem, 1.5): Buttons, captions, controls, table headers, and status labels.

### Named Rules

**The No Broadcast Type Rule.** Do not introduce sports headline fonts, display slabs, or decorative lettering. This is a management product, not a media package.

## 4. Elevation

The system is flat by default. Depth is conveyed through surface color, 1px borders, focus rings, and occasional overlay shadow for floating controls such as select menus. Cards should not combine decorative shadows with borders.

### Shadow Vocabulary
- **Overlay Shadow** (`shadow-md`): Use only for popovers, select menus, and floating UI that must sit above the document flow.
- **Surface Ring** (`ring-1 ring-foreground/10`): Default card separation and the preferred alternative to decorative elevation.

### Named Rules

**The Ledger Surface Rule.** Surfaces are structured like sheets and panels: border first, tonal layer second, shadow only for floating overlays.

## 5. Components

### Buttons
- **Shape:** Low-radius rectangle (5.76px radius) with compact height (24-32px depending on size).
- **Primary:** Ink Command background with near-white text. Use for the main action in a local context.
- **Hover / Focus:** Hover darkens or lightens the local surface; focus uses a visible 2px ring at 30% ring color.
- **Secondary / Outline / Ghost:** Secondary uses Roster Sheet; outline uses Ledger Line; ghost is reserved for low-emphasis actions.

### Cards / Containers
- **Corner Style:** Gently curved corners (7.2px radius).
- **Background:** White Board with foreground text.
- **Shadow Strategy:** No decorative shadows at rest; use Surface Ring for separation.
- **Border:** Ring at 10% foreground opacity.
- **Internal Padding:** Default card spacing is 16px; small cards use 12px.

### Inputs / Fields
- **Style:** 28px tall fields with Ledger Line border, subtle input fill, compact padding, and Inter text.
- **Focus:** Border shifts to Focus Ring and adds a 2px ring.
- **Error / Disabled:** Error uses Cut Deadline Red ring and border; disabled fields reduce opacity and remove pointer interaction.

### Navigation
- **Style:** League navigation is a compact row of small outline buttons under the league header.
- **State:** Active routes must be visibly distinct using the existing button vocabulary, not a new tab style.
- **Mobile Treatment:** Navigation may wrap into multiple rows. Keep targets compact but tappable; do not hide primary league sections behind ornamental navigation.

### Tables
- **Style:** Full-width, horizontally scrollable, 0.75rem text with compact 8px cell padding.
- **Headers:** Medium-weight foreground text, no loud uppercase treatment.
- **Rows:** 1px row dividers with muted hover state for scanning.
- **Behavior:** Tables should remain data-first. Do not replace sortable or comparable data with cards unless the mobile layout demands it.

### Select Menus
- **Style:** Compact trigger matching inputs and buttons, with Hugeicons line icons.
- **Overlay:** Rounded popover with Overlay Shadow and Surface Ring.
- **State:** Focus and selected states use existing accent and ring tokens.

## 6. Do's and Don'ts

### Do:
- **Do** keep league state scannable before adding visual flourish.
- **Do** use Inter across headings, labels, buttons, tables, and body copy.
- **Do** keep surfaces flat at rest and separate them with Ledger Line borders or Surface Rings.
- **Do** place actions near the league data they advance.
- **Do** preserve keyboard-visible focus states on every interactive control.
- **Do** use dense tables when comparison is the job.

### Don't:
- **Don't** make the app feel like a mobile game store UI.
- **Don't** make screens feel like an ESPN-style news site.
- **Don't** borrow fantasy-sports betting dashboard tropes.
- **Don't** turn product screens into an over-marketed SaaS landing page.
- **Don't** use decorative sports-media tropes, glossy game-shop energy, or news-feed-first hierarchy.
- **Don't** introduce display fonts in UI labels, buttons, or data.
- **Don't** use shadows as decoration on cards; shadow belongs to floating overlays.
