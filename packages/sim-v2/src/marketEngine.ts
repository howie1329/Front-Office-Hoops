import type {
  ContractDemandBreakdown,
  ContractDemandResult,
  ContractLegalityResult,
  ContractMarketFixture,
  ContractOffer,
  ContractOfferDecision,
  ContractPhase,
  NegotiationState,
  OfferUtilityBreakdown,
  PlayerEntity,
} from "@workspace/domain-v2"

import { getPlayerCurrentAbility } from "./playerGeneration"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function roundMoney(value: number): number {
  return Math.round(value / 10_000) * 10_000
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function getPlayer(fixture: ContractMarketFixture, playerId: string): PlayerEntity {
  const player = fixture.players[playerId]
  if (!player) throw new Error(`Market fixture is missing player ${playerId}.`)
  return player
}

function getPlayerContract(fixture: ContractMarketFixture, playerId: string) {
  return Object.values(fixture.contracts).find(
    (contract) => contract.playerId === playerId
  )
}

function getTier(
  fixture: ContractMarketFixture,
  playerId: string
): ContractDemandResult["comparableTier"] {
  const value = fixture.values[playerId]
  const player = getPlayer(fixture, playerId)
  const ability = getPlayerCurrentAbility(player)
  if (value && (value.rawValue >= 820 || ability >= 86)) return "star"
  if (value && (value.rawValue >= 700 || ability >= 75)) return "starter"
  if (value && (value.rawValue >= 570 || ability >= 64)) return "rotation"
  return "depth"
}

function getScarcityMultiplier(
  fixture: ContractMarketFixture,
  player: PlayerEntity
): number {
  const position = player.profile.role.primaryPosition
  const supply = fixture.projectedFreeAgency.supplyByPosition[position] ?? 0
  const total = fixture.projectedFreeAgency.entries.length
  const expectedSupply = Math.max(5, total / 5)
  const pressure = clamp((expectedSupply - supply) / expectedSupply, -1, 1)
  return 1 + clamp(
    pressure * fixture.config.maxScarcityAdjustment,
    -fixture.config.maxScarcityAdjustment,
    fixture.config.maxScarcityAdjustment
  )
}

function addBreakdown(
  breakdown: ContractDemandBreakdown[],
  label: string,
  amount: number,
  reason: string
) {
  breakdown.push({
    label,
    amount: roundMoney(amount),
    direction: amount > 1 ? "positive" : amount < -1 ? "negative" : "neutral",
    reason,
  })
}

export function calculateContractDemand(
  fixture: ContractMarketFixture,
  playerId: string,
  phase: ContractPhase = "free-agency"
): ContractDemandResult {
  const player = getPlayer(fixture, playerId)
  const value = fixture.values[playerId]
  if (!value) throw new Error(`Market fixture is missing value for ${playerId}.`)

  const economy = fixture.economy
  const breakdown: ContractDemandBreakdown[] = []
  const normalizedValue = clamp((value.rawValue - 450) / 450, 0, 1)
  const upvBaseline =
    economy.minimumSalary +
    normalizedValue * (economy.maximumSalary - economy.minimumSalary)
  const potentialGap = Math.max(
    0,
    player.profile.development.potential -
      player.profile.development.rating
  )
  const projectedGrowth =
    upvBaseline * (potentialGap / 100) * fixture.config.projectedGrowthWeight
  const existingContract = getPlayerContract(fixture, playerId)
  const previousSalary = existingContract?.annualSalary.at(-1) ?? 0
  const previousAnchor =
    previousSalary > economy.minimumSalary * 2
      ? (previousSalary - upvBaseline) * fixture.config.previousSalaryAnchor
      : 0
  const scarcityMultiplier = getScarcityMultiplier(fixture, player)
  const scarcityAdjustment = upvBaseline * (scarcityMultiplier - 1)
  const projectedAnnualValue = clamp(
    upvBaseline + projectedGrowth + previousAnchor + scarcityAdjustment,
    economy.minimumSalary,
    economy.maximumSalary
  )

  addBreakdown(
    breakdown,
    "UPV baseline",
    upvBaseline,
    "Talent and projected contribution are supplied by Universal Player Value."
  )
  addBreakdown(
    breakdown,
    "Projected growth",
    projectedGrowth,
    "Career trajectory adds contract-specific future value without duplicating UPV."
  )
  addBreakdown(
    breakdown,
    "Previous salary anchor",
    previousAnchor,
    previousSalary
      ? "Prior compensation provides continuity for established contracts."
      : "A rookie-scale or missing prior salary does not suppress market value."
  )
  addBreakdown(
    breakdown,
    "Position scarcity",
    scarcityAdjustment,
    "Projected free-agent supply bounds the scarcity adjustment."
  )

  const preferredYears =
    player.age <= 30
      ? 4
      : player.age <= 33
        ? 3
        : (player.marketPreferences?.securityPriority ?? 50) >= 60
          ? 2
          : 1

  return {
    playerId,
    phase,
    baselineAnnualValue: roundMoney(upvBaseline),
    lowAnnualValue: roundMoney(
      Math.max(economy.minimumSalary, projectedAnnualValue * 0.9)
    ),
    highAnnualValue: roundMoney(
      Math.min(economy.maximumSalary, projectedAnnualValue * 1.1)
    ),
    preferredYears,
    projectedAnnualValue: roundMoney(projectedAnnualValue),
    scarcityMultiplier: round(scarcityMultiplier, 3),
    comparableTier: getTier(fixture, playerId),
    breakdown,
  }
}

function getRightsMechanism(
  fixture: ContractMarketFixture,
  offer: ContractOffer
): ContractLegalityResult["mechanism"] {
  const contract = getPlayerContract(fixture, offer.playerId)
  if (!contract || contract.teamId !== offer.teamId) return "none"
  return contract.rights.level === "bird" ? "bird" : contract.rights.level
}

export function validateContractOffer(
  fixture: ContractMarketFixture,
  offer: ContractOffer
): ContractLegalityResult {
  const economy = fixture.economy
  const team = fixture.teamContexts[offer.teamId]
  const reasons: string[] = []
  const firstYearSalary = offer.annualSalary[0] ?? 0
  const projectedPayroll = (team?.payroll ?? 0) + (team?.reservedSalary ?? 0) + firstYearSalary
  const mechanism = getRightsMechanism(fixture, offer)
  const previousContract = getPlayerContract(fixture, offer.playerId)
  const previousSalary = previousContract?.annualSalary.at(-1) ?? economy.minimumSalary

  if (!team) reasons.push("Team is not present in the market fixture.")
  if (!fixture.players[offer.playerId]) reasons.push("Player is not present in the market fixture.")
  if (offer.years < 1 || offer.years > 4 || offer.annualSalary.length !== offer.years) {
    reasons.push("Contracts must contain one to four fully guaranteed seasons.")
  }
  if (offer.annualSalary.some((salary) => !Number.isFinite(salary) || salary < economy.minimumSalary)) {
    reasons.push("Every annual salary must meet the league minimum.")
  }
  if (firstYearSalary > economy.maximumSalary) {
    reasons.push("The offer exceeds the maximum annual salary.")
  }

  if (reasons.length === 0) {
    if (mechanism === "bird") {
      // Full Bird rights can use the maximum salary in this first rules slice.
    } else if (mechanism === "early-bird") {
      const limit = Math.min(
        economy.maximumSalary,
        Math.max(economy.minimumSalary, previousSalary * fixture.config.earlyBirdSalaryMultiplier)
      )
      if (firstYearSalary > limit) {
        reasons.push("Early Bird rights do not support this first-year salary.")
      }
    } else if (mechanism === "non-bird") {
      const limit = Math.min(
        economy.maximumSalary,
        Math.max(economy.minimumSalary, previousSalary * fixture.config.nonBirdSalaryMultiplier)
      )
      if (firstYearSalary > limit) {
        reasons.push("Non-Bird rights do not support this first-year salary.")
      }
    } else if (projectedPayroll <= economy.softCap) {
      // Cap room is the only external spending mechanism in the initial model.
    } else if (firstYearSalary <= economy.minimumSalary) {
      // Minimum contracts remain available above the soft cap.
    } else {
      reasons.push("Team is above the soft cap without usable Bird rights or cap room.")
    }
  }

  if (economy.hardCapTriggered && projectedPayroll > economy.hardCapLine) {
    reasons.push("Offer would exceed the active hard cap.")
  }

  return {
    valid: reasons.length === 0,
    mechanism:
      reasons.length > 0
        ? "none"
        : mechanism !== "none"
          ? mechanism
          : projectedPayroll <= economy.softCap
            ? "cap-room"
            : firstYearSalary <= economy.minimumSalary
              ? "minimum"
              : "none",
    reasons,
    projectedPayroll: roundMoney(projectedPayroll),
    capRoomAfterOffer: roundMoney(economy.softCap - projectedPayroll),
    hardCapRoomAfterOffer: roundMoney(economy.hardCapLine - projectedPayroll),
  }
}

export function calculateOfferUtility(
  fixture: ContractMarketFixture,
  offer: ContractOffer,
  demand = calculateContractDemand(fixture, offer.playerId, offer.phase)
): OfferUtilityBreakdown {
  const player = getPlayer(fixture, offer.playerId)
  const team = fixture.teamContexts[offer.teamId]
  const profile = player.marketPreferences ?? {
    salaryPriority: 58,
    securityPriority: 52,
    winningPriority: 50,
    rolePriority: 50,
    playingTimePriority: 50,
    marketSizePriority: 45,
    loyalty: 50,
    patience: 50,
    negotiationBaseline: 72,
  }
  const salaryRatio = (offer.annualSalary[0] ?? 0) / Math.max(1, demand.projectedAnnualValue)
  const salary = clamp(salaryRatio * 100, 0, 120)
  const security = clamp((offer.years / 4) * 100, 0, 100)
  const winning = team?.teamQuality ?? 0
  const role = team?.roleOpportunity ?? 0
  const playingTime = team?.playingTimeProjection ?? 0
  const marketSize = team?.marketSize ?? 0
  const currentTeam = getPlayerContract(fixture, offer.playerId)?.teamId
  const loyalty = currentTeam === offer.teamId
    ? clamp(50 + profile.loyalty / 2, 0, 100)
    : clamp(50 - profile.loyalty / 4, 0, 100)
  const weights = fixture.config.preferenceWeights
  const total = clamp(
    salary * weights.salary +
      security * weights.security +
      winning * weights.winning +
      role * weights.role +
      playingTime * weights.playingTime +
      marketSize * weights.marketSize +
      loyalty * weights.loyalty,
    0,
    120
  )

  return {
    salary: round(salary),
    security: round(security),
    winning: round(winning),
    role: round(role),
    playingTime: round(playingTime),
    marketSize: round(marketSize),
    loyalty: round(loyalty),
    total: round(total),
  }
}

function negotiationKey(offer: ContractOffer): string {
  return `${offer.playerId}:${offer.teamId}:${offer.season}:${offer.phase}`
}

function initialNegotiationState(
  fixture: ContractMarketFixture,
  offer: ContractOffer
): NegotiationState {
  const player = getPlayer(fixture, offer.playerId)
  return {
    playerId: offer.playerId,
    teamId: offer.teamId,
    periodKey: negotiationKey(offer),
    willingness: player.marketPreferences?.negotiationBaseline ?? 72,
    status: "active",
    offersSubmitted: 0,
    lastOfferId: null,
    reasonCodes: [],
  }
}

export function evaluateContractOffer(
  fixture: ContractMarketFixture,
  offer: ContractOffer
): ContractOfferDecision {
  const demand = calculateContractDemand(fixture, offer.playerId, offer.phase)
  const legal = validateContractOffer(fixture, offer)
  const utility = calculateOfferUtility(fixture, offer, demand)
  const key = negotiationKey(offer)
  const state = fixture.negotiationStates[key] ?? initialNegotiationState(fixture, offer)
  const firstYearSalary = offer.annualSalary[0] ?? 0
  const offerRatio = firstYearSalary / Math.max(1, demand.projectedAnnualValue)
  const reasons: string[] = []
  let willingnessAfter = state.willingness

  if (!legal.valid) {
    reasons.push("offer-illegal")
  } else if (offerRatio < 0.78) {
    willingnessAfter -= fixture.config.willingness.lowballPenalty * clamp((0.78 - offerRatio) / 0.4, 0.5, 1.5)
    reasons.push("salary-below-expectations")
  } else if (offerRatio >= 0.95) {
    willingnessAfter += fixture.config.willingness.closeOfferRecovery
    reasons.push("offer-near-market")
  }

  if (utility.total >= 70 && state.willingness >= 60) {
    willingnessAfter += fixture.config.willingness.strongPreferenceRecovery
    reasons.push("team-context-supports-offer")
  }

  willingnessAfter = clamp(willingnessAfter, 0, 100)
  const lockedOut = state.status === "locked-out" ||
    willingnessAfter < fixture.config.willingness.lockoutThreshold

  let decision: ContractOfferDecision["decision"]
  if (lockedOut) {
    decision = "refuse-further-negotiation"
    reasons.push("negotiation-willingness-exhausted")
  } else if (!legal.valid || utility.total < fixture.config.minimumAcceptableUtility) {
    decision = "decline"
    if (!legal.valid) reasons.push("league-legality-failed")
    else reasons.push("offer-below-acceptance-floor")
  } else if (
    offer.round >= fixture.config.freeAgencyRounds ||
    utility.total >= fixture.config.minimumAcceptableUtility + fixture.config.waitUtilityMargin ||
    (getPlayer(fixture, offer.playerId).marketPreferences?.patience ?? 50) < 35
  ) {
    decision = "accept"
    reasons.push("offer-clears-player-utility-threshold")
  } else {
    decision = "wait"
    reasons.push("player-is-willing-to-wait-for-a-better-fit")
  }

  const summary =
    decision === "accept"
      ? "Offer qualifies as the player’s current best available fit."
      : decision === "wait"
        ? "Offer is competitive, but the player is preserving market optionality."
        : decision === "refuse-further-negotiation"
          ? "The player will not continue this negotiation during the current period."
          : legal.valid
            ? "Offer does not meet the player’s current utility threshold."
            : "Offer is not legal for the team under the current cap and rights state."

  return {
    offerId: offer.id,
    playerId: offer.playerId,
    teamId: offer.teamId,
    decision,
    legal,
    utility,
    willingnessBefore: round(state.willingness),
    willingnessAfter: round(willingnessAfter),
    reasonCodes: [...new Set(reasons)],
    summary,
  }
}

export function applyContractOfferDecision(
  fixture: ContractMarketFixture,
  offer: ContractOffer,
  decision: ContractOfferDecision
): ContractMarketFixture {
  const next = structuredClone(fixture)
  const key = negotiationKey(offer)
  next.offers[offer.id] = structuredClone(offer)
  next.negotiationStates[key] = {
    playerId: offer.playerId,
    teamId: offer.teamId,
    periodKey: key,
    willingness: decision.willingnessAfter,
    status:
      decision.decision === "refuse-further-negotiation"
        ? "locked-out"
        : "active",
    offersSubmitted: (fixture.negotiationStates[key]?.offersSubmitted ?? 0) + 1,
    lastOfferId: offer.id,
    reasonCodes: decision.reasonCodes,
  }
  return next
}

export function evaluateCompetitiveOffers(
  fixture: ContractMarketFixture,
  offers: ContractOffer[]
): ContractOfferDecision[] {
  const evaluations = offers.map((offer) => evaluateContractOffer(fixture, offer))
  const grouped = new Map<string, ContractOfferDecision[]>()
  for (const evaluation of evaluations) {
    const group = grouped.get(evaluation.playerId) ?? []
    group.push(evaluation)
    grouped.set(evaluation.playerId, group)
  }

  for (const group of grouped.values()) {
    const legal = group
      .filter((evaluation) => evaluation.legal.valid && evaluation.decision !== "refuse-further-negotiation")
      .sort((left, right) => right.utility.total - left.utility.total)
    const winner = legal[0]
    if (!winner || winner.decision === "decline") continue
    for (const evaluation of group) {
      if (evaluation.offerId === winner.offerId) continue
      if (evaluation.decision === "accept") {
        evaluation.decision = "wait"
        evaluation.reasonCodes = ["outbid-by-competing-offer"]
        evaluation.summary = "Another legal offer currently provides higher player utility."
      }
    }
  }

  return evaluations
}
