# Contract Offer Market

## Summary

The contract market replaces automatic acceptance with an offer evaluation layer
shared by player re-signing, player free agency, and staff week.

The system separates three concerns:

- Market value: what a candidate expects to earn.
- Offer evaluation: whether a specific offer is strong enough.
- Period rules: how re-signing, staff week, and free agency resolve offers.

## Data Model

`LeagueRecord.contractOffers` stores pending and resolved player/staff offers.
Each offer records candidate type, candidate id, team id, phase, years,
first-year salary, status, created day, and optional resolution metadata.

`LeagueRecord.reSigningNegotiations` tracks three-attempt negotiations for
re-signing. A failed re-signing negotiation does not remove the player from the
free-agent pool; it only prevents more re-signing attempts by that team during
the re-signing period.

## Phase Rules

### Re-signing

- Only the current/prior team can negotiate.
- Offers resolve immediately.
- Accepted offers sign the player through the existing signing path.
- Declined offers increment attempts used.
- Three declined offers mark the negotiation as failed.

### Staff Week

- AI staff offers are generated when staff week opens and after each market day.
- User staff offers are pending offers, not immediate hires.
- Advancing a staff market day resolves active offers.
- Accepted staff are hired through the existing staff hiring path.
- Losing offers expire when a candidate accepts another offer.

### Free Agency

- AI free-agent offers are generated when free agency opens and after each
  market day.
- User free-agent offers are pending offers.
- Advancing a free-agency market day resolves active offers.
- Accepted players sign through the existing free-agent signing path.

## Evaluation Inputs

The v1 evaluator intentionally stays simple:

- First-year salary versus expected market salary.
- Contract length.
- Current-team loyalty for player re-signing.
- Market timing so candidates can wait on decent offers.

Strong offers can be accepted immediately. Competitive but not overwhelming
open-market offers can remain pending. Weak offers are declined or beaten by
better offers.

## UI Requirements

The UI should show enough information for the user to make a real decision:

- Expected salary range.
- Best active offer.
- Offer form with cap/budget validation.
- Re-signing attempts remaining.
- Market-day advance action for staff week and free agency.

## Testing Expectations

Simulation tests should cover:

- Re-signing acceptance.
- Re-signing declined attempts and three-attempt lockout.
- Staff/free-agent market-day acceptance.
- Candidate waiting on acceptable open-market offers.
- Existing cap, roster, role, and staff budget validation.
