import type {
  NumericRange,
  PlayerArchetype,
  PlayerGenerationConfig,
  PlayerPosition,
  PlayerProfile,
  PlayerRoleProfile,
} from "@workspace/domain-v2"

export type PlayerRoleDiagnostics = {
  positionFits: Record<PlayerPosition, number>
  archetypeFits: Record<PlayerArchetype, number>
  positionConfidence: number
  archetypeConfidence: number
  specialistGateFailures: PlayerArchetype[]
}

export type PlayerRoleResult = {
  role: PlayerRoleProfile
  diagnostics: PlayerRoleDiagnostics
}

const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

const archetypes: PlayerArchetype[] = [
  "lead_guard",
  "scoring_guard",
  "defensive_guard",
  "combo_guard",
  "shooting_wing",
  "three_and_d_wing",
  "slashing_wing",
  "point_forward",
  "utility_wing",
  "stretch_big",
  "interior_scorer",
  "rim_protector",
  "rebounding_big",
  "utility_big",
]

const fallbackArchetypes = new Set<PlayerArchetype>([
  "combo_guard",
  "utility_wing",
  "utility_big",
])

const archetypesByPosition: Record<PlayerPosition, PlayerArchetype[]> = {
  PG: ["lead_guard", "scoring_guard", "defensive_guard", "combo_guard"],
  SG: [
    "lead_guard",
    "scoring_guard",
    "defensive_guard",
    "combo_guard",
    "shooting_wing",
    "three_and_d_wing",
    "slashing_wing",
    "utility_wing",
  ],
  SF: [
    "shooting_wing",
    "three_and_d_wing",
    "slashing_wing",
    "point_forward",
    "utility_wing",
  ],
  PF: [
    "slashing_wing",
    "point_forward",
    "utility_wing",
    "stretch_big",
    "interior_scorer",
    "rim_protector",
    "rebounding_big",
    "utility_big",
  ],
  C: [
    "stretch_big",
    "interior_scorer",
    "rim_protector",
    "rebounding_big",
    "utility_big",
  ],
}

const positionTargets: Record<
  PlayerPosition,
  { height: number; weight: number; wingspan: number }
> = {
  PG: { height: 74, weight: 190, wingspan: 76 },
  SG: { height: 77, weight: 205, wingspan: 80 },
  SF: { height: 80, weight: 225, wingspan: 83 },
  PF: { height: 82, weight: 245, wingspan: 86 },
  C: { height: 84, weight: 265, wingspan: 89 },
}

function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)))
}

function normalize(value: number, range: NumericRange): number {
  if (range.max === range.min) return 50
  return roundScore(((value - range.min) / (range.max - range.min)) * 100)
}

function fitToTarget(value: number, target: number, tolerance: number): number {
  return roundScore(100 - (Math.abs(value - target) / tolerance) * 100)
}

function sizeFit(
  profile: Pick<PlayerProfile, "physical" | "skills">,
  position: PlayerPosition
): number {
  const target = positionTargets[position]
  return average([
    fitToTarget(profile.physical.heightInches, target.height, 6),
    fitToTarget(profile.physical.weightPounds, target.weight, 50),
    fitToTarget(profile.physical.wingspanInches, target.wingspan, 8),
  ])
}

function positionFit(
  profile: Pick<PlayerProfile, "physical" | "skills">,
  position: PlayerPosition,
  config: PlayerGenerationConfig
): number {
  const skills = profile.skills
  const physical = profile.physical
  const target = positionTargets[position]
  const height = fitToTarget(physical.heightInches, target.height, 6)
  const weight = fitToTarget(physical.weightPounds, target.weight, 50)
  const wingspan = fitToTarget(physical.wingspanInches, target.wingspan, 8)
  const speed = physical.speed
  const strength = physical.strength

  const scores: Record<PlayerPosition, number> = {
    PG: average([
      height,
      height,
      weight,
      wingspan,
      speed,
      skills.handling,
      skills.handling,
      skills.passing,
      skills.basketballIQ,
      skills.shooting,
    ]),
    SG: average([
      height,
      height,
      weight,
      wingspan,
      speed,
      skills.shooting,
      skills.shooting,
      skills.finishing,
      skills.handling,
      skills.defense,
    ]),
    SF: average([
      height,
      weight,
      wingspan,
      speed,
      strength,
      skills.shooting,
      skills.finishing,
      skills.defense,
      skills.rebounding,
      skills.basketballIQ,
    ]),
    PF: average([
      height,
      weight,
      wingspan,
      strength,
      strength,
      skills.finishing,
      skills.rebounding,
      skills.defense,
      skills.defense,
      skills.shooting,
    ]),
    C: average([
      height,
      height,
      weight,
      wingspan,
      wingspan,
      strength,
      skills.rebounding,
      skills.rebounding,
      skills.defense,
      skills.finishing,
    ]),
  }

  // Keep the parameter in the signature so the classifier remains coupled to
  // the same generation contract used by callers and future calibration work.
  void config
  return scores[position]
}

function archetypeFit(
  profile: Pick<PlayerProfile, "physical" | "skills">,
  archetype: PlayerArchetype,
  primaryPosition: PlayerPosition,
  config: PlayerGenerationConfig
): number {
  const skills = profile.skills
  const physical = profile.physical
  const size = sizeFit(profile, primaryPosition)
  const wingspan = normalize(
    physical.wingspanInches,
    config.physical.wingspanInches
  )

  const scores: Record<PlayerArchetype, number> = {
    lead_guard: average([skills.passing, skills.handling, skills.basketballIQ]),
    scoring_guard: average([
      skills.shooting,
      skills.finishing,
      skills.handling,
    ]),
    defensive_guard: average([
      skills.defense,
      physical.speed,
      skills.stamina,
      skills.basketballIQ,
    ]),
    combo_guard: average([
      skills.shooting,
      skills.finishing,
      skills.passing,
      skills.handling,
      skills.defense,
      skills.basketballIQ,
    ]),
    shooting_wing: average([skills.shooting, skills.basketballIQ, skills.stamina, size]),
    three_and_d_wing: average([
      skills.shooting,
      skills.defense,
      skills.defense,
      skills.stamina,
      wingspan,
      physical.speed,
    ]),
    slashing_wing: average([
      skills.finishing,
      skills.handling,
      physical.speed,
      physical.vertical,
      physical.strength,
    ]),
    point_forward: average([
      skills.passing,
      skills.handling,
      skills.basketballIQ,
      skills.rebounding,
      size,
    ]),
    utility_wing: average([
      skills.shooting,
      skills.finishing,
      skills.passing,
      skills.defense,
      physical.speed,
      size,
    ]),
    stretch_big: average([
      skills.shooting,
      skills.rebounding,
      skills.basketballIQ,
      physical.strength,
      size,
    ]),
    interior_scorer: average([
      skills.finishing,
      physical.strength,
      skills.rebounding,
      skills.basketballIQ,
      size,
    ]),
    rim_protector: average([
      skills.defense,
      skills.rebounding,
      physical.vertical,
      wingspan,
      size,
    ]),
    rebounding_big: average([
      skills.rebounding,
      physical.strength,
      wingspan,
      skills.stamina,
      size,
    ]),
    utility_big: average([
      skills.finishing,
      skills.rebounding,
      skills.defense,
      skills.basketballIQ,
      physical.strength,
      skills.stamina,
    ]),
  }

  const specialistBonus =
    archetype === "three_and_d_wing" &&
    passesSpecialistGate(profile, archetype, primaryPosition)
      ? 8
      : 0

  return roundScore(scores[archetype] + specialistBonus)
}

function passesSpecialistGate(
  profile: Pick<PlayerProfile, "physical" | "skills">,
  archetype: PlayerArchetype,
  primaryPosition: PlayerPosition
): boolean {
  const skills = profile.skills
  const physical = profile.physical
  const size = sizeFit(profile, primaryPosition)

  switch (archetype) {
    case "lead_guard":
      return skills.passing >= 60 && skills.handling >= 60
    case "scoring_guard":
      return skills.shooting >= 60 && skills.finishing >= 55
    case "defensive_guard":
      return skills.defense >= 60
    case "shooting_wing":
      return skills.shooting >= 65
    case "three_and_d_wing":
      return skills.shooting >= 60 && skills.defense >= 60
    case "slashing_wing":
      return (
        skills.finishing >= 60 &&
        average([physical.speed, physical.vertical]) >= 60
      )
    case "point_forward":
      return skills.passing >= 60 && skills.handling >= 55
    case "stretch_big":
      return skills.shooting >= 60
    case "interior_scorer":
      return skills.finishing >= 60 && physical.strength >= 55
    case "rim_protector":
      return skills.defense >= 60 && average([size, physical.vertical]) >= 55
    case "rebounding_big":
      return skills.rebounding >= 60
    default:
      return true
  }
}

function adjacentPositions(position: PlayerPosition): PlayerPosition[] {
  const index = positions.indexOf(position)
  return positions.filter((_, candidateIndex) => Math.abs(candidateIndex - index) === 1)
}

function selectBest<T extends string>(
  scores: Record<T, number>,
  candidates: T[]
): { value: T | null; score: number; runnerUpScore: number } {
  const ranked = candidates
    .map((value) => ({ value, score: scores[value] }))
    .sort((left, right) => right.score - left.score || left.value.localeCompare(right.value))

  return {
    value: ranked[0]?.value ?? null,
    score: ranked[0]?.score ?? 0,
    runnerUpScore: ranked[1]?.score ?? ranked[0]?.score ?? 0,
  }
}

export function derivePlayerRole(
  profile: Pick<PlayerProfile, "physical" | "skills">,
  config: PlayerGenerationConfig
): PlayerRoleResult {
  const positionFits = Object.fromEntries(
    positions.map((position) => [position, roundScore(positionFit(profile, position, config))])
  ) as Record<PlayerPosition, number>
  const primaryPosition = selectBest(positionFits, positions)
  const resolvedPrimaryPosition = primaryPosition.value!
  const secondaryPositionCandidate = selectBest(
    positionFits,
    adjacentPositions(resolvedPrimaryPosition)
  )
  const secondaryPosition =
    secondaryPositionCandidate.value &&
    secondaryPositionCandidate.score >= config.classification.minPositionFit &&
    primaryPosition.score - secondaryPositionCandidate.score <=
      config.classification.maxSecondaryPositionGap
      ? secondaryPositionCandidate.value
      : null

  const eligiblePositions = [
    resolvedPrimaryPosition,
    ...(secondaryPosition ? [secondaryPosition] : []),
  ]
  const eligibleArchetypes = [
    ...new Set(eligiblePositions.flatMap((position) => archetypesByPosition[position])),
  ]
  const archetypeFits = Object.fromEntries(
    archetypes.map((archetype) => [
      archetype,
      eligibleArchetypes.includes(archetype)
        ? archetypeFit(profile, archetype, resolvedPrimaryPosition, config)
        : 0,
    ])
  ) as Record<PlayerArchetype, number>
  const specialistGateFailures = archetypes.filter(
    (archetype) =>
      !fallbackArchetypes.has(archetype) &&
      eligibleArchetypes.includes(archetype) &&
      !passesSpecialistGate(profile, archetype, resolvedPrimaryPosition)
  )
  const specialists = eligibleArchetypes.filter(
    (archetype) =>
      !fallbackArchetypes.has(archetype) &&
      passesSpecialistGate(profile, archetype, resolvedPrimaryPosition) &&
      archetypeFits[archetype] >= config.classification.minArchetypeFit
  )
  const primaryArchetypeCandidates = specialists.length
    ? specialists
    : eligibleArchetypes.filter((archetype) => fallbackArchetypes.has(archetype))
  const primaryArchetype = selectBest(
    archetypeFits,
    primaryArchetypeCandidates
  )
  const secondaryArchetypeCandidate = selectBest(
    archetypeFits,
    specialists.filter((archetype) => archetype !== primaryArchetype.value)
  )
  const secondaryArchetype =
    primaryArchetype.value &&
    secondaryArchetypeCandidate.value &&
    specialists.length > 1 &&
    secondaryArchetypeCandidate.score >=
      config.classification.minSecondaryArchetypeFit &&
    primaryArchetype.score - secondaryArchetypeCandidate.score <=
      config.classification.maxSecondaryArchetypeGap
      ? secondaryArchetypeCandidate.value
      : null

  return {
    role: {
      primaryPosition: resolvedPrimaryPosition,
      secondaryPosition,
      primaryArchetype: primaryArchetype.value!,
      secondaryArchetype,
    },
    diagnostics: {
      positionFits,
      archetypeFits,
      positionConfidence: primaryPosition.score - secondaryPositionCandidate.score,
      archetypeConfidence:
        primaryArchetype.score - secondaryArchetypeCandidate.score,
      specialistGateFailures,
    },
  }
}
