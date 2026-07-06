import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"
import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

import { createRng } from "../rng"
import { deriveOverall } from "../playerRatings"
import { applyModifiersToDeltas } from "./applyModifiersToDeltas"
import { applySkillDeltas } from "./applySkillDeltas"
import { collectModifiers } from "./collectModifiers"
import { computeBaseSkillDeltas } from "./computeBaseSkillDeltas"
import { driftPotential } from "./driftPotential"
import type { DevelopmentContext } from "./types"

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

export function progressPlayer(
  player: Player,
  team: TeamWithRoster,
  season: number,
  playerSeasonStats: PlayerSeasonStats[],
  baseSeed: string,
  playerSeasonProfiles: PlayerSeasonProfile[] = [],
): Player {
  const agedPlayer = { ...player, age: player.age + 1 }
  const teammates = team.players.filter((teammate) => teammate.id !== player.id)
  const playerRng = createRng(`${baseSeed}:development:${season}:${player.id}`)
  const context: DevelopmentContext = {
    player: agedPlayer,
    team,
    season,
    seasonStats: findSeasonStats(playerSeasonStats, player.id, season),
    seasonProfile: findSeasonProfile(playerSeasonProfiles, player.id, season),
    teammates,
    rng: playerRng,
  }
  const modifiers = collectModifiers(context)
  const baseDeltas = computeBaseSkillDeltas(agedPlayer, playerRng)
  const finalDeltas = applyModifiersToDeltas(baseDeltas, modifiers)
  const withSkills = applySkillDeltas(agedPlayer, finalDeltas)
  const nextPotential = driftPotential(withSkills, modifiers, playerRng)
  const tags =
    agedPlayer.age >= VETERAN_MIN_AGE && !player.tags.includes(VETERAN_TAG)
      ? [...player.tags, VETERAN_TAG]
      : player.tags
  const { shooting, inside, passing, rebounding, defense, stamina } =
    withSkills.ratings
  const overall = deriveOverall({
    shooting,
    inside,
    passing,
    rebounding,
    defense,
    stamina,
  })

  return {
    ...withSkills,
    tags,
    ratings: {
      ...withSkills.ratings,
      shooting,
      inside,
      passing,
      rebounding,
      defense,
      stamina,
      overall,
      potential: nextPotential,
    },
  }
}
