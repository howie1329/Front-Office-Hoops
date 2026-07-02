import {
  RATING_MAX,
  RATING_MIN,
  ROOKIE_AGE_MAX,
  ROOKIE_AGE_MIN,
  ROOKIE_OVERALL_BASE,
  ROOKIE_POTENTIAL_GAP_MAX,
  ROOKIE_POTENTIAL_GAP_MIN,
} from "@workspace/shared/constants"
import type { DraftProspect, PlayerPosition, Rng } from "@workspace/shared/types"

import { generatePeakAge } from "../development/generatePeakAge"
import { FIRST_NAMES, LAST_NAMES } from "../namePools"
import { clampRating, deriveOverall } from "../playerRatings"
import { getDraftPickCount } from "./isDraftRequired"

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

function positionSkillBias(
  position: PlayerPosition,
  base: number,
  rng: Rng,
): {
  shooting: number
  inside: number
  passing: number
  rebounding: number
  defense: number
  stamina: number
} {
  const variance = () => rng.int(-6, 6)
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

function pickRookieAge(rng: Rng): number {
  const roll = rng.next()
  if (roll < 0.6) {
    return 19
  }
  if (roll < 0.85) {
    return 20
  }
  return rng.int(21, ROOKIE_AGE_MAX)
}

export function generateDraftClass(
  teamCount: number,
  year: number,
  baseSeed: string,
  rng: Rng,
): DraftProspect[] {
  const classSize = getDraftPickCount(teamCount)
  const prospects: DraftProspect[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < classSize; index++) {
    const position = POSITIONS[index % POSITIONS.length]!
    const age = pickRookieAge(rng)
    const baseRating = clampRating(
      ROOKIE_OVERALL_BASE + rng.int(-6, 6),
    )
    const skillRatings = positionSkillBias(position, baseRating, rng)
    const overall = deriveOverall(skillRatings)
    const potential = clampRating(
      overall + rng.int(ROOKIE_POTENTIAL_GAP_MIN, ROOKIE_POTENTIAL_GAP_MAX),
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

    prospects.push({
      id: `prospect_${year}_${String(index + 1).padStart(3, "0")}`,
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
        potential: Math.min(RATING_MAX, potential),
        usage: 8,
      },
      tags: [],
    })
  }

  return prospects
}
