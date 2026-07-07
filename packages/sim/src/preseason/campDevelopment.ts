import { IQ_SKILL_KEYS } from "@workspace/shared/constants"
import type { Player, Rng, TeamWithRoster } from "@workspace/shared/types"

import { applySkillDeltas } from "../development/applySkillDeltas"
import { deriveOverall, getSkillRatings } from "../playerRatings"

const CAMP_DEV_BOOST = 0.45

export function applyCampDevelopmentForDay(
  teams: TeamWithRoster[],
  rng: Rng,
): TeamWithRoster[] {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) => progressCampPlayer(player, rng)),
  }))
}

function progressCampPlayer(player: Player, rng: Rng): Player {
  if (!player.tags.includes("camp_invite") || player.age > 24) {
    return player
  }

  const deltas = Object.fromEntries(
    IQ_SKILL_KEYS.map((skill) => [
      skill,
      rng.normal(CAMP_DEV_BOOST, 0.2),
    ]),
  ) as Record<(typeof IQ_SKILL_KEYS)[number], number>

  const withSkills = applySkillDeltas(player, {
    threePoint: 0,
    midRange: 0,
    freeThrow: 0,
    inside: rng.normal(0.15, 0.1),
    passing: rng.normal(0.2, 0.1),
    ballHandling: rng.normal(0.2, 0.1),
    rebounding: 0,
    defense: rng.normal(0.1, 0.08),
    stamina: 0,
    offensiveIQ: deltas.offensiveIQ,
    defensiveIQ: deltas.defensiveIQ,
  })

  const skills = getSkillRatings(withSkills.ratings)
  return {
    ...withSkills,
    ratings: {
      ...withSkills.ratings,
      ...skills,
      overall: deriveOverall(skills),
    },
  }
}
