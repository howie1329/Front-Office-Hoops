# Contract Offer Market

## Summary

The contract market replaces automatic acceptance with an offer evaluation layer
shared by player re-signing, player free agency, player extensions, and staff
week.

The system separates three concerns:

- Market value: what a candidate expects to earn.
- Offer evaluation: whether a specific offer is strong enough.
- Period rules: how re-signing, staff week, free agency, and extensions resolve
  offers.

## Data Model

`LeagueRecord.contractOffers` stores pending and resolved player/staff offers.
Each offer records candidate type, candidate id, team id, phase, years,
first-year salary, status, created day, and optional resolution metadata.

`LeagueRecord.reSigningNegotiations` tracks three-attempt player negotiations
by phase. A failed negotiation acts as the cooldown for that player/team/phase.
Re-signing and extension offers resolve immediately. Free-agent offers resolve
on market-day advancement.

## Phase Rules

### Re-signing

- Only the current/prior team can negotiate.
- Offers resolve immediately.
- Accepted offers sign the player through the existing signing path.
- Declined offers increment attempts used.
- Three declined offers mark the negotiation as failed.

### Extensions

- Extension offers use the same player evaluation model.
- Offers validate against existing extension eligibility and salary bounds.
- Accepted offers extend the contract through the existing extension commit path.
- Three declined offers block extension talks until the offseason reset.

### Staff Week

- Staff contracts are reconciled against `currentCapSeason` when staff week opens. Expired coaches return to the market and their team assignments, effects, and payroll are cleared.
- AI staff offers are generated when staff week opens and after each market day.
- User staff offers are pending offers, not immediate hires.
- Advancing a staff market day resolves active offers.
- Accepted staff are hired through the existing staff hiring path.
- Losing offers expire when a candidate accepts another offer.
- Staff budgets limit current-season payroll, not total contract value.
- The user cannot leave staff week with a vacant role. Remaining AI vacancies receive deterministic one-year emergency hires, which may exceed an AI team's budget so the offseason cannot deadlock.

### Free Agency

- AI free-agent offers are generated when free agency opens and after each
  market day.
- User free-agent offers are pending offers.
- Advancing a free-agency market day resolves active offers.
- Accepted players sign through the existing free-agent signing path.
- Declined user offers increment attempts.
- Three declined offers block that player/team free-agent negotiation until the
  next free-agency market reset.
- The legacy auction pass is removed. End-of-phase AI roster cleanup may still
  commit signings directly, but it is not a bidding system.

## Evaluation Inputs

The player evaluator returns a score plus a breakdown for debugging and future
UI explanation:

- salary: first-year salary versus mood-adjusted market expectation.
- years: contract length security.
- loyalty: current-team preference for re-signing and extensions.
- winning: team quality, standings, and contender/seller strategy.
- market: market tier preference for fame-driven players.
- role: projected roster rank and role opportunity.
- timing: market-day patience and immediate negotiation timing.

Strong offers can be accepted immediately. Competitive but not overwhelming
open-market offers can remain pending. Weak offers are declined or beaten by
better offers.

`PlayerMood` is the negotiation personality source. Money-focused players put
more pressure on salary. Winning-focused players favor contenders. Loyal players
are easier to retain. Fame-focused players prefer larger markets and stronger
roles.

## UI Requirements

The UI should show enough information for the user to make a real decision:

- Expected salary range.
- Best active offer.
- Offer form with cap/budget validation.
- Re-signing attempts remaining.
- Free-agency and extension attempts/cooldown state.
- Market-day advance action for staff week and free agency.

## Legacy Cleanup

User-facing screens should submit offers. They should not directly call instant
signing, hiring, or extension commands. Low-level commit functions remain in the
simulation engine only so accepted offers can safely update rosters, contracts,
staff assignments, financials, and logs.

## Testing Expectations

Simulation tests should cover:

- Re-signing acceptance.
- Re-signing declined attempts and three-attempt lockout.
- Extension acceptance and three-attempt cooldown.
- Free-agency declined attempts and three-attempt cooldown.
- Staff/free-agent market-day acceptance.
- Candidate waiting on acceptable open-market offers.
- Existing cap, roster, role, and staff budget validation.
