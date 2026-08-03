# Front Office Hoops V2 — Team & Roster Screen Brief

**Status:** First-version product brief  
**Scope:** User's team management and roster operations  
**Primary route:** Team  
**Related:** [V2 UI Information Architecture](./foh-v2-ui-information-architecture.md), [V2 Roadmap](../plans/foh-v2-roadmap.md)

## Product role

The Team & Roster screen is the operational home for the user's franchise. It
should be the place the user visits to understand who is on the team, who can
play, who should play, and which roster decisions need attention.

The screen should make the current state of the team legible before exposing
deeper management tools. It is a decision surface, not a general team news
feed or a complete league dashboard.

## User questions

The screen must answer these questions quickly:

1. Who is on my roster?
2. Which players are healthy and available?
3. Who is in the rotation and what role does each player have?
4. Is the roster legal and adequately covered by position?
5. Which contracts, injuries, or deadlines require attention?
6. What can I do next with a selected player?

## Page hierarchy

### 1. Team header

The header establishes context and exposes the most important team-level
actions.

Display:

- Team name and location.
- User team indicator.
- Current season, phase, and date.
- Record, conference/division standing, and recent form.
- Team overall or power rating.
- Payroll, cap space, and tax status.
- Roster count and legality status.

Primary actions:

- Set rotation.
- Make trade.
- View contracts.
- Advance or return to the next required action.

The header should retain the global lifecycle context used throughout the
management shell. A user should not need to return to the dashboard to know
whether an action is currently allowed.

### 2. Roster alerts

Show actionable warnings near the top of the page. Each warning should link to
the screen, tab, or player that resolves it.

Initial alert types:

- Roster is illegal or exceeds capacity.
- Required position coverage is missing.
- An injured player is currently assigned to the rotation.
- A rotation has not been set or has invalid minutes.
- A player has an expiring contract or upcoming option decision.
- Payroll, minimum salary, maximum salary, or tax rules are violated.
- A league deadline is approaching.

Alerts must distinguish between informational, cautionary, and blocking states.
Color must not be the only status indicator.

### 3. Main roster table

The roster table is the primary content area. It should support the first-v2
management workflow without requiring the user to open every player profile.

Recommended columns:

- Player identity.
- Primary and secondary position.
- Age.
- Team role.
- Overall.
- Recent production.
- Universal player value.
- Health and availability.
- Salary.
- Contract years remaining.
- Rotation status.

Recommended filters:

- Active, injured, inactive, or reserve.
- Starter, rotation, bench, or outside rotation.
- Position.
- Contract status.
- Age range.
- Salary range.
- Trade or transaction status.

The table should support sorting, filtering, visible-column selection, row
actions, and keyboard navigation. Identity columns should remain visible when
the table scrolls horizontally.

Each row should provide direct actions appropriate to the current phase:

- Open player profile.
- Assign or remove from rotation.
- Start contract action.
- Include in trade proposal.
- View contract.

Blocked actions must explain the specific rule that prevents them.

### 4. Rotation preview

The page should show a compact rotation preview above or beside the roster
table. This keeps the roster operational rather than purely informational.

Display:

- Starting five.
- Bench/depth order.
- Target minutes.
- Position coverage.
- Total assigned minutes.
- Injury, eligibility, or minute-normalization warnings.

The preview should link to the full Rotation screen. It should not duplicate
the complete rotation editor, but it should make an invalid or incomplete
rotation visible immediately.

### 5. Selected-player detail

Selecting a player should open a detail drawer or navigate to the Player Profile
screen. The first-v2 profile should expose:

- Ratings and skills.
- Overall, percentile, and rank where appropriate.
- Traits, positions, and archetypes.
- Recent production.
- Universal player value and its main factors.
- Development trajectory.
- Health and availability history.
- Contract terms and market context.
- Relevant events.

The profile should provide contextual actions such as rotation assignment,
extension, trade inclusion, and contract review. It should not expose hidden
exact ratings for players outside the user's permitted information view.

## Team navigation

The Team area should use a small set of related tabs rather than making every
management concern a top-level navigation item:

- **Roster:** default view and player operations.
- **Rotation:** starters, depth order, and target minutes.
- **Contracts:** cap sheet, payroll, guarantees, options, holds, and dead money.
- **Staff:** head coach, assistant coaches, scout, contracts, philosophies, and effects.
- **Owner Goals:** current goals, progress, strikes, and job-security explanation.

The Roster tab should remain the entry point. The header and alert strip should
provide links into the other tabs when a team issue requires attention.

## Required states

The screen must support these states explicitly:

- Loading a saved league or team snapshot.
- Normal legal roster.
- Incomplete or invalid roster.
- Injuries affecting the rotation.
- No rotation configured.
- Contract or cap violation.
- Empty filtered result.
- Worker or save failure after a command.
- Stale data after another team-management action.
- Restricted action during a phase where it is unavailable.

Every blocked state should explain what happened, why the action is blocked,
and what the user can do next.

## Responsive behavior

On desktop, use a primary roster table with a persistent or adjacent rotation
preview and compact team summary.

On smaller screens:

- Keep team identity, date, legality, and primary action visible.
- Convert the roster table into a priority-column list or horizontally scrollable table.
- Move rotation preview above the player list.
- Open player details in a full-screen drawer or stacked detail view.
- Keep row actions accessible without requiring precision clicking.

## First-version boundaries

The Team & Roster screen does not need to include:

- Full league standings or league-wide statistics.
- Trade proposal construction.
- Free-agent browsing.
- Draft scouting boards.
- Complete transaction history.
- Live game coaching or play-by-play.
- A separate player-comparison workflow.

Those systems may link from the page, but they should remain separate decision
surfaces. Player comparison can begin as a multi-select table action, and
contract detail can begin as a drawer or Contracts tab rather than a separate
top-level route.

## First-version acceptance criteria

The Team & Roster screen is ready for the first V2 release when a user can:

1. See the complete roster and its legal/illegal state.
2. Filter and sort players using the core management fields.
3. Identify injuries, expiring contracts, and rotation problems.
4. Open a player and understand their ability, production, value, health, and contract.
5. Set or open the full rotation workflow.
6. Navigate to contract, staff, owner-goal, and transaction actions.
7. Receive clear explanations when an action is unavailable.
8. Reload the league without losing the displayed roster state or completed decisions.

The screen should feel like the team's control panel: dense enough for a
front-office user, but organized around decisions rather than displaying every
available data field at once.
