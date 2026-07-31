import type {
  CareerAnnualContext,
  CareerAvailabilitySummary,
  CareerCurveRules,
  CareerDeclineCurve,
  CareerDevelopmentEvent,
  CareerPhase,
  CareerTransitionResult,
  CareerGrowthCurve,
  PlayerEntity,
  PlayerGenerationConfig,
  PlayerSkillKey,
  PlayerSkills,
} from "@workspace/domain-v2"
import { STANDARD_PLAYER_GENERATION_CONFIG } from "@workspace/domain-v2"

import { derivePlayerRole } from "./playerRole"
import type { RandomSource } from "./randomness"

export type CareerDevelopmentInput = {
  player: PlayerEntity
  context: CareerAnnualContext
  random: RandomSource
  config?: PlayerGenerationConfig
  rules?: CareerCurveRules
}

export const STANDARD_CAREER_CURVE_RULES: CareerCurveRules = {
  growthMultipliers: {
    slow: 0.7,
    standard: 1,
    fast: 1.3,
    elite: 1.6,
  },
  declineMultipliers: {
    durable: 0.7,
    standard: 1,
    early: 1.25,
    steep: 1.6,
  },
  growthTransitionChance: 0.01,
  declineTransitionChance: 0.01,
}

const skillKeys: PlayerSkillKey[] = [
  "shooting",
  "finishing",
  "passing",
  "handling",
  "rebounding",
  "defense",
  "basketballIQ",
  "stamina",
]

const skillResponse: Record<PlayerSkillKey, number> = {
  shooting: 1,
  finishing: 1.03,
  passing: 0.98,
  handling: 1.02,
  rebounding: 0.97,
  defense: 0.99,
  basketballIQ: 0.94,
  stamina: 1.06,
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function validateContext(context: CareerAnnualContext): void {
  if (!Number.isInteger(context.season) || context.season < 0) {
    throw new RangeError("Career seasons must be non-negative integers.")
  }
  if (!Number.isFinite(context.minutes) || context.minutes < 0) {
    throw new RangeError("Career minutes must be non-negative.")
  }
  if (
    !Number.isInteger(context.gamesPlayed) ||
    context.gamesPlayed < 0 ||
    !Number.isInteger(context.gamesScheduled) ||
    context.gamesScheduled < 1 ||
    context.gamesPlayed > context.gamesScheduled
  ) {
    throw new RangeError(
      "Career game counts must be ordered non-negative integers."
    )
  }
  if (
    !Number.isFinite(context.injuryDevelopmentPenalty) ||
    context.injuryDevelopmentPenalty < 0 ||
    context.injuryDevelopmentPenalty > 1
  ) {
    throw new RangeError("Career injury penalties must be between 0 and 1.")
  }
  if (
    !Number.isFinite(context.coachingDevelopmentEmphasis) ||
    context.coachingDevelopmentEmphasis < 0 ||
    context.coachingDevelopmentEmphasis > 100
  ) {
    throw new RangeError("Career coaching emphasis must be between 0 and 100.")
  }
}

export function getCareerPhase(
  age: number,
  peakAge: number,
  declineStartAge: number
): CareerPhase {
  if (age < peakAge) return "growth"
  if (age < declineStartAge) return "plateau"
  return "decline"
}

function opportunityModifier(context: CareerAnnualContext): number {
  const minutesPerGame =
    context.gamesPlayed > 0
      ? context.minutes / context.gamesPlayed
      : context.minutes / context.gamesScheduled
  const boundedMinutes = clamp(minutesPerGame, 0, 48)

  // The first minutes matter most, while a full workload remains bounded.
  return 0.72 + 0.48 * (1 - Math.exp(-boundedMinutes / 18))
}

function phaseMean(
  player: PlayerEntity,
  phase: CareerPhase,
  rules: CareerCurveRules
): number {
  const { potential, rating } = player.profile.development
  const currentAbility =
    Object.values(player.profile.skills).reduce(
      (sum, value) => sum + value,
      0
    ) / skillKeys.length
  const potentialGap = potential - currentAbility
  if (phase === "growth") {
    const forecastSignal = clamp(0.35 + potentialGap / 100, 0.15, 0.85)
    const developmentSignal = clamp(0.65 + (rating - 50) / 160, 0.35, 1.15)
    return (
      (0.32 + forecastSignal * 0.58) *
      developmentSignal *
      rules.growthMultipliers[player.profile.development.growthCurve]
    )
  }

  if (phase === "decline") {
    const agePastDecline = Math.max(
      0,
      player.age - player.profile.development.declineStartAge
    )
    return -(
      (0.24 + agePastDecline * 0.075) *
      rules.declineMultipliers[player.profile.development.declineCurve]
    )
  }

  return 0
}

function adjacentCurve<T extends string>(
  curve: T,
  curves: readonly T[],
  direction: number
): T {
  const index = curves.indexOf(curve)
  const nextIndex = clamp(index + direction, 0, curves.length - 1)
  return curves[nextIndex]!
}

function applyTrajectoryChange(
  player: PlayerEntity,
  phase: CareerPhase,
  random: RandomSource,
  context: CareerAnnualContext,
  rules: CareerCurveRules,
  events: CareerDevelopmentEvent[]
): PlayerEntity {
  const transitionRandom = random.fork("trajectory-change")
  const growthCurves: CareerGrowthCurve[] = [
    "slow",
    "standard",
    "fast",
    "elite",
  ]
  const declineCurves: CareerDeclineCurve[] = [
    "durable",
    "standard",
    "early",
    "steep",
  ]
  let nextDevelopment = player.profile.development

  if (
    phase === "growth" &&
    transitionRandom.fork("growth").next() < rules.growthTransitionChance
  ) {
    const direction =
      transitionRandom.fork("growth-direction").next() < 0.5 ? -1 : 1
    const nextCurve = adjacentCurve(
      nextDevelopment.growthCurve,
      growthCurves,
      direction
    )
    if (nextCurve !== nextDevelopment.growthCurve) {
      events.push({
        id: `career:${player.id}:${context.season}:growth-curve`,
        type: "trajectory-change",
        season: context.season,
        playerId: player.id,
        phase,
        skill: null,
        delta: 0,
        summary: `Growth curve changed from ${nextDevelopment.growthCurve} to ${nextCurve}.`,
        curveDimension: "growth",
        fromCurve: nextDevelopment.growthCurve,
        toCurve: nextCurve,
        reason: "calibration",
      })
      nextDevelopment = { ...nextDevelopment, growthCurve: nextCurve }
    }
  }

  if (
    phase === "decline" &&
    transitionRandom.fork("decline").next() < rules.declineTransitionChance
  ) {
    const direction =
      transitionRandom.fork("decline-direction").next() < 0.5 ? -1 : 1
    const nextCurve = adjacentCurve(
      nextDevelopment.declineCurve,
      declineCurves,
      direction
    )
    if (nextCurve !== nextDevelopment.declineCurve) {
      events.push({
        id: `career:${player.id}:${context.season}:decline-curve`,
        type: "trajectory-change",
        season: context.season,
        playerId: player.id,
        phase,
        skill: null,
        delta: 0,
        summary: `Decline curve changed from ${nextDevelopment.declineCurve} to ${nextCurve}.`,
        curveDimension: "decline",
        fromCurve: nextDevelopment.declineCurve,
        toCurve: nextCurve,
        reason: "calibration",
      })
      nextDevelopment = { ...nextDevelopment, declineCurve: nextCurve }
    }
  }

  if (nextDevelopment === player.profile.development) return player

  return {
    ...player,
    profile: {
      ...player.profile,
      development: nextDevelopment,
    },
  }
}

function createAvailability(
  context: CareerAnnualContext
): CareerAvailabilitySummary {
  return {
    gamesScheduled: context.gamesScheduled,
    gamesPlayed: context.gamesPlayed,
    minutes: context.minutes,
    availabilityRate: context.gamesPlayed / context.gamesScheduled,
    injuryDevelopmentPenalty: context.injuryDevelopmentPenalty,
    injuryAffected: context.injuryDevelopmentPenalty > 0,
  }
}

function createEvent(
  player: PlayerEntity,
  context: CareerAnnualContext,
  phase: CareerPhase,
  type: CareerDevelopmentEvent["type"],
  skill: PlayerSkillKey | null,
  delta: number,
  summary: string,
  suffix: string
): CareerDevelopmentEvent {
  return {
    id: `career:${player.id}:${context.season}:${suffix}`,
    type,
    season: context.season,
    playerId: player.id,
    phase,
    skill,
    delta,
    summary,
  }
}

export function advancePlayerCareerYear(
  input: CareerDevelopmentInput
): CareerTransitionResult {
  const config = input.config ?? STANDARD_PLAYER_GENERATION_CONFIG
  const rules = input.rules ?? STANDARD_CAREER_CURVE_RULES
  const { player, context, random } = input

  validateContext(context)
  if (player.leagueStatus.kind === "retired") {
    throw new Error("Retired players cannot receive career development.")
  }

  const phase = getCareerPhase(
    player.age,
    player.profile.development.peakAge,
    player.profile.development.declineStartAge
  )
  const opportunity = opportunityModifier(context)
  const coaching = 1 + ((context.coachingDevelopmentEmphasis - 50) / 100) * 0.12
  const injury = 1 - context.injuryDevelopmentPenalty * 0.65
  const nextSkills: PlayerSkills = { ...player.profile.skills }
  const skillDeltas = {} as Record<PlayerSkillKey, number>
  const events: CareerDevelopmentEvent[] = [
    createEvent(
      player,
      context,
      phase,
      "phase-change",
      null,
      0,
      `Career phase: ${phase}.`,
      "phase"
    ),
  ]
  const seasonRandom = random
    .fork("career")
    .fork(player.id)
    .fork(String(context.season))
  const activePlayer = applyTrajectoryChange(
    player,
    phase,
    seasonRandom,
    context,
    rules,
    events
  )

  for (const skill of skillKeys) {
    const skillRandom = seasonRandom.fork(skill)
    const baseline = phaseMean(activePlayer, phase, rules)
    const currentAbility =
      Object.values(player.profile.skills).reduce(
        (sum, value) => sum + value,
        0
      ) / skillKeys.length
    const developmentModifier =
      phase === "growth"
        ? 1 +
          clamp(
            (activePlayer.profile.development.potential - currentAbility) / 400,
            -0.05,
            0.2
          )
        : 1
    const plateauNoise =
      phase === "plateau"
        ? seasonRandom
            .fork("plateau-noise")
            .fork(skill)
            .normal(
              0,
              0.18 + (activePlayer.profile.development.volatility / 100) * 0.68
            )
        : 0
    const randomNoise = skillRandom.normal(
      0,
      (activePlayer.profile.development.volatility / 100) * 0.2
    )
    const delta = round(
      (baseline * opportunity * coaching * injury * developmentModifier +
        plateauNoise +
        randomNoise) *
        skillResponse[skill]
    )
    const nextValue = round(
      clamp(activePlayer.profile.skills[skill] + delta, 0, 100)
    )
    skillDeltas[skill] = round(nextValue - activePlayer.profile.skills[skill])
    nextSkills[skill] = nextValue

    if (skillDeltas[skill] !== 0) {
      events.push(
        createEvent(
          player,
          context,
          phase,
          phase === "plateau" ? "plateau-noise" : "skill-development",
          skill,
          skillDeltas[skill],
          `${skill} ${skillDeltas[skill] >= 0 ? "increased" : "decreased"} by ${Math.abs(skillDeltas[skill]).toFixed(1)}.`,
          skill
        )
      )
    }
  }

  if (context.injuryDevelopmentPenalty > 0) {
    events.push(
      createEvent(
        player,
        context,
        phase,
        "injury-effect",
        null,
        0,
        `Injury penalty reduced development by ${Math.round(context.injuryDevelopmentPenalty * 100)}%.`,
        "injury"
      )
    )
  }
  events.push(
    createEvent(
      player,
      context,
      phase,
      "availability",
      null,
      0,
      `Available for ${context.gamesPlayed} of ${context.gamesScheduled} games.`,
      "availability"
    )
  )

  const role = derivePlayerRole(
    { physical: player.profile.physical, skills: nextSkills },
    config
  )
  const nextPlayer: PlayerEntity = {
    ...activePlayer,
    age: player.age + 1,
    profile: {
      ...player.profile,
      physical: { ...activePlayer.profile.physical },
      skills: nextSkills,
      role: role.role,
      development: { ...activePlayer.profile.development },
      traits: [...activePlayer.profile.traits],
    },
  }

  return {
    player: nextPlayer,
    phase,
    skillDeltas,
    events,
    availability: createAvailability(context),
  }
}
