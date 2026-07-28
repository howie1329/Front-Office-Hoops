import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"
import type {
  Player,
  PlayerDevelopmentRecord,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

import { createRng } from "../rng"
import { deriveOverall, getSkillRatings } from "../playerRatings"
import {
  applyModifiersToDeltas,
  sumPotentialDriftBias,
} from "./applyModifiersToDeltas"
import { applySkillDeltas } from "./applySkillDeltas"
import { collectModifiers, buildDevelopmentContext } from "./collectModifiers"
import { computeBaseSkillDeltas } from "./computeBaseSkillDeltas"
import {
  hadMajorInjurySeason,
  updateInjuryHistoryFromProfile,
} from "./cultureScore"
import {
  computeMomentumFromStats,
  rollDevelopmentEvents,
} from "./modifiers/index"
import { refreshPotentialProjection } from "./monteCarloPotential"
import { evaluateRetirement } from "./retirement"
import type { SkillDeltas } from "./types"
import { estimatePerformanceDrift } from "../playerValue/performanceDrift"

function findSeasonStats(
  playerSeasonStats: PlayerSeasonStats[],
  playerId: string,
  season: number,
): PlayerSeasonStats | undefined {
  return playerSeasonStats.find(
    (entry) => entry.playerId === playerId && entry.season === season,
  )
}

function findSeasonProfile(
  playerSeasonProfiles: PlayerSeasonProfile[],
  playerId: string,
  season: number,
): PlayerSeasonProfile | undefined {
  return playerSeasonProfiles.find(
    (entry) => entry.playerId === playerId && entry.season === season,
  )
}

function skillDeltaRecord(
  before: Player,
  after: Player,
): Partial<Record<keyof Player["ratings"], number>> {
  const deltas: Partial<Record<keyof Player["ratings"], number>> = {}
  for (const key of [
    "threePoint",
    "midRange",
    "freeThrow",
    "inside",
    "passing",
    "ballHandling",
    "rebounding",
    "defense",
    "stamina",
    "offensiveIQ",
    "defensiveIQ",
  ] as const) {
    const change = after.ratings[key] - before.ratings[key]
    if (Math.abs(change) >= 0.05) {
      deltas[key] = Math.round(change * 10) / 10
    }
  }
  return deltas
}

export type ProgressPlayerInput = {
  player: Player
  team: TeamWithRoster
  priorSeason: number
  newSeason: number
  playerSeasonStats: PlayerSeasonStats[]
  playerSeasonProfiles: PlayerSeasonProfile[]
  baseSeed: string
  cultureScore?: number
  coachingLevel?: number
  developmentLevel?: number
}

export type ProgressPlayerOutput = {
  player: Player | null
  record: PlayerDevelopmentRecord
  retirement?: { reasons: string[] }
}

export function progressPlayer(input: ProgressPlayerInput): ProgressPlayerOutput {
  const {
    player,
    team,
    priorSeason,
    newSeason,
    playerSeasonStats,
    playerSeasonProfiles,
    baseSeed,
    cultureScore,
    coachingLevel,
    developmentLevel,
  } = input

  const beforeOverall = player.ratings.overall
  const beforePotential = player.ratings.potential
  const seasonStats = findSeasonStats(playerSeasonStats, player.id, priorSeason)
  const seasonProfile = findSeasonProfile(
    playerSeasonProfiles,
    player.id,
    priorSeason,
  )

  const playerRng = createRng(
    `${baseSeed}:development:${newSeason}:${player.id}`,
  )

  const retirementEval = evaluateRetirement(
    player,
    seasonStats,
    seasonProfile,
    playerRng,
  )

  if (retirementEval.shouldRetire) {
    return {
      player: null,
      record: {
        id: `pdr_${newSeason}_${player.id}`,
        playerId: player.id,
        season: newSeason,
        teamId: team.id,
        ageBefore: player.age,
        ageAfter: player.age,
        overallBefore: beforeOverall,
        overallAfter: beforeOverall,
        potentialBefore: beforePotential,
        potentialAfter: beforePotential,
        skillDeltas: {},
        modifierIds: [],
        events: ["retirement:auto"],
        momentumApplied: player.developmentMomentum ?? 0,
        retired: true,
      },
      retirement: { reasons: retirementEval.reasons },
    }
  }

  const agedPlayer: Player = {
    ...player,
    age: player.age + 1,
    performanceDrift: estimatePerformanceDrift(player, seasonStats),
    injuryHistory: updateInjuryHistoryFromProfile(
      player,
      seasonProfile,
      priorSeason,
      hadMajorInjurySeason(seasonProfile, player),
    ),
    reinventionSeasonsRemaining: Math.max(
      0,
      (player.reinventionSeasonsRemaining ?? 0) - 1,
    ),
  }

  const teammates = team.players.filter((teammate) => teammate.id !== player.id)
  const context = buildDevelopmentContext({
    player: agedPlayer,
    team,
    season: priorSeason,
    seasonStats,
    seasonProfile,
    teammates,
    rng: playerRng,
    cultureScore,
    coachingLevel,
    developmentLevel,
  })

  const modifiers = collectModifiers(context)
  const modifierIds = modifiers.map((modifier) => modifier.id)

  const { potential: forecastPotential } = refreshPotentialProjection(
    agedPlayer,
    playerRng,
    sumPotentialDriftBias(modifiers),
  )

  const baseDeltas = computeBaseSkillDeltas(agedPlayer, playerRng, {
    forecastPotential,
  })

  let finalDeltas: SkillDeltas = applyModifiersToDeltas(baseDeltas, modifiers)

  const eventResult = rollDevelopmentEvents(context, finalDeltas)
  if (Object.keys(eventResult.skillBonuses).length > 0) {
    for (const [skill, bonus] of Object.entries(eventResult.skillBonuses)) {
      finalDeltas[skill as keyof SkillDeltas] =
        (finalDeltas[skill as keyof SkillDeltas] ?? 0) + (bonus ?? 0)
    }
  }

  const momentum = computeMomentumFromStats(player, seasonStats)
  const momentumMultiplier = 1 + momentum * 0.08
  if (momentumMultiplier !== 1) {
    for (const skill of Object.keys(finalDeltas) as (keyof SkillDeltas)[]) {
      if (finalDeltas[skill] > 0) {
        finalDeltas[skill] *= momentumMultiplier
      }
    }
  }

  const withSkills = applySkillDeltas(agedPlayer, finalDeltas)
  const skills = getSkillRatings(withSkills.ratings)
  const overall = deriveOverall(skills)

  const { potential: nextPotential, reasons: potentialReasons } =
    refreshPotentialProjection(withSkills, playerRng, sumPotentialDriftBias(modifiers))

  const careerPeakOverall = Math.max(
    player.careerPeakOverall ?? beforeOverall,
    overall,
  )

  const tags =
    agedPlayer.age >= VETERAN_MIN_AGE && !player.tags.includes(VETERAN_TAG)
      ? [...player.tags, VETERAN_TAG]
      : player.tags

  const progressedPlayer: Player = {
    ...withSkills,
    tags,
    careerPeakOverall,
    developmentMomentum: momentum,
    reinventionSeasonsRemaining:
      eventResult.reinventionSeasons ?? agedPlayer.reinventionSeasonsRemaining,
    ratings: {
      ...withSkills.ratings,
      ...skills,
      overall,
      potential: nextPotential,
    },
  }

  const record: PlayerDevelopmentRecord = {
    id: `pdr_${newSeason}_${player.id}`,
    playerId: player.id,
    season: newSeason,
    teamId: team.id,
    ageBefore: player.age,
    ageAfter: progressedPlayer.age,
    overallBefore: beforeOverall,
    overallAfter: overall,
    potentialBefore: beforePotential,
    potentialAfter: nextPotential,
    skillDeltas: skillDeltaRecord(player, progressedPlayer),
    modifierIds,
    events: [...eventResult.events, ...potentialReasons],
    momentumApplied: momentum,
    retired: false,
  }

  return { player: progressedPlayer, record }
}
