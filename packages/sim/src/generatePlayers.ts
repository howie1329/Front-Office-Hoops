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

/** Target OVR offset from team.overall by roster depth (star → bench). */
const ROSTER_TIER_OFFSETS: Array<{ min: number; max: number }> = [
  { min: 4, max: 10 },
  { min: 3, max: 9 },
  { min: 0, max: 6 },
  { min: -1, max: 5 },
  { min: -2, max: 4 },
  { min: -6, max: 0 },
  { min: -8, max: -2 },
  { min: -10, max: -4 },
  { min: -18, max: -10 },
  { min: -20, max: -12 },
  { min: -22, max: -14 },
  { min: -24, max: -16 },
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

function targetOverallForRosterSlot(teamOverall: number, index: number, rng: Rng): number {
  const tier = ROSTER_TIER_OFFSETS[index] ?? ROSTER_TIER_OFFSETS.at(-1)!
  return clampRating(teamOverall + rng.int(tier.min, tier.max))
}

function generateAgeForRosterSlot(index: number, rng: Rng): number {
  if (index < 2) {
    return rng.int(27, 32)
  }

  if (index < 5) {
    return rng.int(24, 32)
  }

  if (index < 8) {
    return rng.int(22, 33)
  }

  return rng.next() < 0.55 ? rng.int(19, 23) : rng.int(30, 34)
}

function generatePotential(overall: number, age: number, rng: Rng): number {
  if (age <= 22) {
    return clampRating(overall + rng.int(8, 18))
  }

  if (age <= 25) {
    return clampRating(overall + rng.int(4, 12))
  }

  if (age >= 32) {
    return clampRating(overall + rng.int(-4, 2))
  }

  return clampRating(overall + rng.int(-2, 8))
}

function generateSkillRatings(
  position: PlayerPosition,
  targetOverall: number,
  rng: Rng,
): Omit<PlayerRatings, "overall" | "potential" | "usage"> {
  const skillVariance = () => rng.int(-4, 4)
  const skills = {
    shooting: targetOverall + skillVariance(),
    inside: targetOverall + skillVariance(),
    passing: targetOverall + skillVariance(),
    rebounding: targetOverall + skillVariance(),
    defense: targetOverall + skillVariance(),
    stamina: targetOverall + skillVariance(),
  }

  switch (position) {
    case "PG":
      skills.passing += 6
      skills.rebounding -= 6
      break
    case "SG":
      skills.shooting += 6
      skills.passing -= 2
      skills.rebounding -= 4
      break
    case "SF":
      skills.shooting += 4
      skills.defense += 2
      skills.passing -= 3
      skills.rebounding -= 3
      break
    case "PF":
      skills.rebounding += 5
      skills.inside += 4
      skills.shooting -= 4
      skills.passing -= 5
      break
    case "C":
      skills.rebounding += 6
      skills.inside += 5
      skills.passing -= 6
      skills.shooting -= 5
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

function finalizeRosterUsage(players: Player[]): Player[] {
  const sorted = [...players].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )

  return sorted.map((player, index) => ({
    ...player,
    ratings: {
      ...player.ratings,
      usage: deriveUsage(player.ratings.overall, index),
    },
  }))
}

export function generatePlayers(team: Team, rng: Rng): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < PLAYERS_PER_TEAM; index++) {
    const position = POSITION_TEMPLATE[index]!
    const targetOverall = targetOverallForRosterSlot(team.overall, index, rng)
    const age = generateAgeForRosterSlot(index, rng)
    const skillRatings = generateSkillRatings(position, targetOverall, rng)
    const overall = deriveOverall(skillRatings)
    const potential = generatePotential(overall, age, rng)
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

  return finalizeRosterUsage(players)
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
