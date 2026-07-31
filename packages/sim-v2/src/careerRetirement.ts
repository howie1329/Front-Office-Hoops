import type {
  CareerRetirementContext,
  PlayerEntity,
  RetirementEvaluation,
  RetirementFactor,
} from "@workspace/domain-v2"

import type { RandomSource } from "./randomness"

export type CareerRetirementInput = {
  player: PlayerEntity
  context: CareerRetirementContext
  random: RandomSource
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function currentAbility(player: PlayerEntity): number {
  return average(Object.values(player.profile.skills))
}

function roleOpportunity(player: PlayerEntity): number {
  const role = player.profile.role.primaryArchetype
  if (
    role === "utility_wing" ||
    role === "utility_big" ||
    role === "defensive_guard"
  ) {
    return 46
  }
  if (
    role === "lead_guard" ||
    role === "scoring_guard" ||
    role === "point_forward"
  ) {
    return 64
  }
  return 55
}

function validateContext(context: CareerRetirementContext): void {
  if (!Number.isInteger(context.season) || context.season < 0) {
    throw new RangeError("Retirement seasons must be non-negative integers.")
  }
  if (
    context.gamesPlayed !== undefined &&
    (!Number.isInteger(context.gamesPlayed) || context.gamesPlayed < 0)
  ) {
    throw new RangeError("Retirement games played must be non-negative.")
  }
  if (
    context.gamesScheduled !== undefined &&
    (!Number.isInteger(context.gamesScheduled) || context.gamesScheduled < 1)
  ) {
    throw new RangeError("Retirement scheduled games must be positive.")
  }
  if (
    context.gamesPlayed !== undefined &&
    context.gamesScheduled !== undefined &&
    context.gamesPlayed > context.gamesScheduled
  ) {
    throw new RangeError(
      "Retirement games played cannot exceed scheduled games."
    )
  }
}

function factor(
  key: RetirementFactor["key"],
  label: string,
  contribution: number,
  explanation: string
): RetirementFactor {
  return { key, label, contribution, explanation }
}

export function evaluatePlayerRetirement(
  input: CareerRetirementInput
): RetirementEvaluation {
  const { player, context, random } = input
  validateContext(context)
  if (player.leagueStatus.kind === "retired") {
    return {
      eligible: true,
      retired: true,
      probability: 1,
      factors: [factor("age", "Already retired", 1, "Retirement is final.")],
    }
  }

  const ability = currentAbility(player)
  const health = context.health ?? player.profile.injuryResistance
  const injuryHistory = context.injuryHistory ?? 0
  const opportunity = context.opportunity ?? roleOpportunity(player)
  const contractOpportunity = context.contractOpportunity ?? opportunity
  const agePressure = Math.max(0, player.age - 33) / 12
  const healthPressure = (100 - clamp(health, 0, 100)) / 100
  const injuryPressure = clamp(injuryHistory, 0, 1)
  const abilityPressure = Math.max(0, 62 - ability) / 62
  const opportunityPressure = (100 - clamp(opportunity, 0, 100)) / 100
  const contractPressure = (100 - clamp(contractOpportunity, 0, 100)) / 100
  const availability =
    context.gamesScheduled && context.gamesPlayed !== undefined
      ? context.gamesPlayed / context.gamesScheduled
      : 1
  const availabilityPressure = 1 - clamp(availability, 0, 1)

  const factors = [
    factor(
      "age",
      "Age",
      agePressure * 0.22,
      `Age ${player.age} contributes ${Math.round(agePressure * 100)}% of the age hazard scale.`
    ),
    factor(
      "health",
      "Health",
      healthPressure * 0.08,
      `Health rating ${Math.round(health)} contributes to the hazard.`
    ),
    factor(
      "injury-history",
      "Injury history",
      injuryPressure * 0.08 + availabilityPressure * 0.06,
      `Injury history and availability contribute ${Math.round((injuryPressure * 0.08 + availabilityPressure * 0.06) * 100)} percentage points.`
    ),
    factor(
      "current-ability",
      "Current ability",
      abilityPressure * 0.08,
      `Current ability ${Math.round(ability)} changes the opportunity hazard.`
    ),
    factor(
      "role",
      "Role",
      roleOpportunity(player) < 50 ? 0.025 : 0,
      `The ${player.profile.role.primaryArchetype.replaceAll("_", " ")} role has a bounded opportunity effect.`
    ),
    factor(
      "opportunity",
      "Roster opportunity",
      opportunityPressure * 0.06,
      `Roster opportunity ${Math.round(opportunity)} changes the retirement hazard.`
    ),
    factor(
      "contract-opportunity",
      "Contract opportunity",
      contractPressure * 0.05,
      `Contract opportunity ${Math.round(contractOpportunity)} changes the retirement hazard.`
    ),
  ]
  const baseline = player.age < 34 ? 0 : 0.004
  const probability = clamp(
    baseline + factors.reduce((sum, current) => sum + current.contribution, 0),
    0,
    0.95
  )
  const eligible = player.age >= 34
  const retired =
    eligible &&
    random
      .fork("career")
      .fork(player.id)
      .fork(String(context.season))
      .fork("retirement")
      .next() < probability

  return { eligible, retired, probability, factors }
}
