import {
  PLAYERS_PER_TEAM,
  VETERAN_MIN_AGE,
  VETERAN_TAG,
} from "@workspace/shared/constants"
import type {
  Player,
  PlayerPosition,
  PlayerRatings,
  Rng,
  Team,
  TeamWithRoster,
} from "@workspace/shared/types"

import { generatePeakAge } from "./development/generatePeakAge"
import { FIRST_NAMES, LAST_NAMES } from "./namePools"
import {
  clampRating,
  deriveOverall,
  deriveTeamOverall,
  deriveUsage,
} from "./playerRatings"

const POSITION_TEMPLATE: PlayerPosition[] = [
  "PG",
  "PG",
  "SG",
  "SG",
  "SF",
  "SF",
  "PF",
  "PF",
  "C",
  "C",
  "SG",
  "SF",
]

const POSITION_HEIGHT: Record<PlayerPosition, { min: number; max: number }> = {
  PG: { min: 72, max: 76 },
  SG: { min: 74, max: 78 },
  SF: { min: 76, max: 80 },
  PF: { min: 78, max: 82 },
  C: { min: 80, max: 84 },
}

function pickName(pool: string[], rng: Rng): string {
  return pool[rng.int(0, pool.length - 1)]!
}

function positionSkillBias(
  position: PlayerPosition,
  base: number,
  rng: Rng,
): Omit<PlayerRatings, "overall" | "potential" | "usage"> {
  const variance = () => rng.int(-8, 8)
  const skills = {
    shooting: base + variance(),
    inside: base + variance(),
    passing: base + variance(),
    rebounding: base + variance(),
    defense: base + variance(),
    stamina: base + variance(),
  }

  switch (position) {
    case "PG":
      skills.passing += 8
      skills.shooting += 3
      skills.rebounding -= 4
      break
    case "SG":
      skills.shooting += 8
      skills.passing += 2
      break
    case "SF":
      skills.shooting += 5
      skills.defense += 3
      break
    case "PF":
      skills.rebounding += 7
      skills.inside += 5
      break
    case "C":
      skills.rebounding += 10
      skills.inside += 8
      skills.passing -= 4
      break
  }

  return {
    shooting: clampRating(skills.shooting),
    inside: clampRating(skills.inside),
    passing: clampRating(skills.passing),
    rebounding: clampRating(skills.rebounding),
    defense: clampRating(skills.defense),
    stamina: clampRating(skills.stamina),
  }
}

function deriveTags(age: number): string[] {
  if (age >= VETERAN_MIN_AGE) {
    return [VETERAN_TAG]
  }

  return []
}

export function generatePlayers(team: Team, rng: Rng): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < PLAYERS_PER_TEAM; index++) {
    const position = POSITION_TEMPLATE[index]!
    const baseRating = clampRating(team.overall + rng.int(-10, 10))
    const age = rng.int(19, 34)
    const skillRatings = positionSkillBias(position, baseRating, rng)
    const overall = deriveOverall(skillRatings)
    const potential = clampRating(
      overall + (age <= 23 ? rng.int(4, 14) : rng.int(-2, 6)),
    )
    const peakAge = generatePeakAge(age, overall, potential, rng)

    let firstName = pickName(FIRST_NAMES, rng)
    let lastName = pickName(LAST_NAMES, rng)
    let displayName = `${firstName} ${lastName}`

    while (usedNames.has(displayName)) {
      firstName = pickName(FIRST_NAMES, rng)
      lastName = pickName(LAST_NAMES, rng)
      displayName = `${firstName} ${lastName}`
    }

    usedNames.add(displayName)

    const heightRange = POSITION_HEIGHT[position]
    const heightInches = rng.int(heightRange.min, heightRange.max)
    const weightLbs = rng.int(185, 250)

    players.push({
      id: `p_${team.abbrev.toLowerCase()}_${String(index + 1).padStart(2, "0")}`,
      teamId: team.id,
      firstName,
      lastName,
      age,
      peakAge,
      heightInches,
      weightLbs,
      position,
      ratings: {
        ...skillRatings,
        overall,
        potential,
        usage: deriveUsage(overall, index),
      },
      tags: deriveTags(age),
      status: "active",
      injury: null,
      draftInfo: null,
      activeContractId: null,
      seasonsWithTeam: 0,
      yearsOfService: Math.max(0, age - 19),
    })
  }

  return players
}

export function generateTeamWithRoster(team: Team, rng: Rng): TeamWithRoster {
  const players = generatePlayers(team, rng)
  const overall = deriveTeamOverall(players)

  return {
    ...team,
    overall,
    players,
  }
}
