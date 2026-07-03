import {
  RATING_MAX,
  ROOKIE_AGE_MAX,
} from "@workspace/shared/constants"
import type { DraftProspect, PlayerPosition, Rng } from "@workspace/shared/types"

import { generatePeakAge } from "../development/generatePeakAge"
import { FIRST_NAMES, LAST_NAMES } from "../namePools"
import { clampRating, deriveOverall } from "../playerRatings"
import { getDraftClassSize, getDraftPickCount } from "./isDraftRequired"

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
  const variance = () => rng.int(-4, 4)
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

type ProspectTier = {
  minOverall: number
  maxOverall: number
  minPotentialGap: number
  maxPotentialGap: number
}

function prospectTier(index: number, pickCount: number): ProspectTier {
  const lotteryCutoff = Math.ceil((pickCount * 14) / 60)
  const firstRoundCutoff = Math.ceil((pickCount * 30) / 60)

  if (index < lotteryCutoff) {
    return { minOverall: 62, maxOverall: 68, minPotentialGap: 12, maxPotentialGap: 22 }
  }

  if (index < firstRoundCutoff) {
    return { minOverall: 54, maxOverall: 61, minPotentialGap: 8, maxPotentialGap: 16 }
  }

  if (index < pickCount) {
    return { minOverall: 48, maxOverall: 56, minPotentialGap: 4, maxPotentialGap: 12 }
  }

  return { minOverall: 45, maxOverall: 52, minPotentialGap: 2, maxPotentialGap: 20 }
}

function pickPotentialGap(tier: ProspectTier, index: number, rng: Rng): number {
  const isReadyNowRolePlayer = index >= 30 && rng.next() < 0.3
  if (isReadyNowRolePlayer) {
    return rng.int(2, 6)
  }

  return rng.int(tier.minPotentialGap, tier.maxPotentialGap)
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
  _baseSeed: string,
  rng: Rng,
): DraftProspect[] {
  const pickCount = getDraftPickCount(teamCount)
  const classSize = getDraftClassSize(teamCount)
  const prospects: DraftProspect[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < classSize; index++) {
    const position = POSITIONS[index % POSITIONS.length]!
    const age = pickRookieAge(rng)
    const tier = prospectTier(index, pickCount)
    const baseRating = clampRating(rng.int(tier.minOverall, tier.maxOverall))
    const skillRatings = positionSkillBias(position, baseRating, rng)
    const overall = deriveOverall(skillRatings)
    const potential = clampRating(overall + pickPotentialGap(tier, index, rng))
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
