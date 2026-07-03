import { VETERAN_MIN_AGE, VETERAN_TAG } from "@workspace/shared/constants"
import type { Player, PlayerPosition, PlayerRatings, Rng } from "@workspace/shared/types"

import { FIRST_NAMES, LAST_NAMES } from "./namePools"
import { clampRating, deriveOverall, deriveUsage } from "./playerRatings"

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

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

function generateRatings(
  position: PlayerPosition,
  base: number,
  rng: Rng,
): Omit<PlayerRatings, "overall" | "potential" | "usage"> {
  const variance = () => rng.int(-5, 5)
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
      skills.passing += 5
      skills.rebounding -= 5
      break
    case "SG":
      skills.shooting += 5
      skills.rebounding -= 3
      skills.passing -= 2
      break
    case "SF":
      skills.shooting += 3
      skills.defense += 2
      skills.passing -= 2
      skills.rebounding -= 3
      break
    case "PF":
      skills.rebounding += 4
      skills.inside += 3
      skills.shooting -= 3
      skills.passing -= 4
      break
    case "C":
      skills.rebounding += 5
      skills.inside += 4
      skills.shooting -= 4
      skills.passing -= 5
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

export function generateFreeAgents(
  count: number,
  rng: Rng,
  idPrefix = "generated",
): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < count; index++) {
    const position = POSITIONS[index % POSITIONS.length]!
    const age = rng.int(24, 35)
    const base = rng.int(45, 65)
    const skillRatings = generateRatings(position, base, rng)
    const overall = deriveOverall(skillRatings)
    const potential = clampRating(overall + (age <= 26 ? rng.int(1, 8) : rng.int(-4, 3)))

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

    players.push({
      id: `p_fa_${idPrefix}_${String(index + 1).padStart(3, "0")}_${rng.int(1000, 9999)}`,
      teamId: null,
      firstName,
      lastName,
      age,
      peakAge: age <= 26 ? rng.int(27, 31) : Math.max(26, Math.min(33, age)),
      heightInches: rng.int(heightRange.min, heightRange.max),
      weightLbs: rng.int(185, 250),
      position,
      ratings: {
        ...skillRatings,
        overall,
        potential,
        usage: deriveUsage(overall, index),
      },
      tags: age >= VETERAN_MIN_AGE ? [VETERAN_TAG] : [],
      status: "free_agent",
      injury: null,
      draftInfo: null,
      activeContractId: null,
      seasonsWithTeam: 0,
      yearsOfService: Math.max(0, age - 19),
    })
  }

  return players
}
