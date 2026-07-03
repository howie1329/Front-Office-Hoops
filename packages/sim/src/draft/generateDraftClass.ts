import {
  RATING_MAX,
  RATING_MIN,
  ROOKIE_AGE_MAX,
} from "@workspace/shared/constants"
import type {
  DraftProspect,
  PlayerPosition,
  Rng,
} from "@workspace/shared/types"

import { generatePlayerProfile } from "../playerGeneration/generatePlayerProfile"
import { clampRating } from "../playerRatings"
import { getDraftClassSize } from "./isDraftRequired"

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

type DraftClassStrength = {
  overallOffset: number
  potentialOffset: number
}

function pickDraftClassStrength(rng: Rng): DraftClassStrength {
  const roll = rng.next()
  if (roll < 0.18) {
    return { overallOffset: -2, potentialOffset: -4 }
  }
  if (roll > 0.82) {
    return { overallOffset: 2, potentialOffset: 4 }
  }

  return { overallOffset: 0, potentialOffset: 0 }
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

function buildPositionBag(count: number, rng: Rng): PlayerPosition[] {
  const positions: PlayerPosition[] = []

  for (let index = 0; index < count; index++) {
    positions.push(POSITIONS[index % POSITIONS.length]!)
  }

  for (let index = positions.length - 1; index > 0; index--) {
    const swapIndex = rng.int(0, index)
    const current = positions[index]!
    positions[index] = positions[swapIndex]!
    positions[swapIndex] = current
  }

  return positions
}

function pickTargetOverall(strength: DraftClassStrength, rng: Rng): number {
  return Math.max(
    RATING_MIN,
    Math.min(72, clampRating(rng.normal(55 + strength.overallOffset, 7)))
  )
}

function pickPotentialGap(
  targetOverall: number,
  strength: DraftClassStrength,
  rng: Rng
): number {
  const readyNowRolePlayer = targetOverall >= 55 && rng.next() < 0.2
  if (readyNowRolePlayer) {
    return rng.int(2, 6)
  }

  const gap = Math.round(rng.normal(10 + strength.potentialOffset, 5))
  return Math.max(2, Math.min(24, gap))
}

function ageBonus(age: number): number {
  switch (age) {
    case 19:
      return 4
    case 20:
      return 2.5
    case 21:
      return 1
    default:
      return 0
  }
}

function calculateDraftValue(prospect: DraftProspect, noise: number): number {
  return (
    prospect.ratings.overall +
    prospect.ratings.potential * 1.15 +
    ageBonus(prospect.age) +
    noise
  )
}

export function generateDraftClass(
  teamCount: number,
  year: number,
  _baseSeed: string,
  rng: Rng
): DraftProspect[] {
  const classSize = getDraftClassSize(teamCount)
  const strength = pickDraftClassStrength(rng)
  const positions = buildPositionBag(classSize, rng)
  const prospects: Array<{ prospect: DraftProspect; draftValue: number }> = []
  const usedNames = new Set<string>()

  for (let index = 0; index < classSize; index++) {
    const position = positions[index]!
    const age = pickRookieAge(rng)
    const baseRating = pickTargetOverall(strength, rng)
    const potentialGap = pickPotentialGap(baseRating, strength, rng)
    const profile = generatePlayerProfile({
      age,
      targetOverall: baseRating,
      position,
      rng,
      usedNames,
      potentialGap: { min: potentialGap, max: potentialGap },
      usageIndex: 0,
    })

    const prospect = {
      id: `raw_prospect_${year}_${String(index + 1).padStart(3, "0")}`,
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      peakAge: profile.peakAge,
      heightInches: profile.heightInches,
      weightLbs: profile.weightLbs,
      position: profile.position,
      ratings: {
        ...profile.ratings,
        potential: Math.min(RATING_MAX, profile.ratings.potential),
        usage: 8,
      },
      tags: [],
    }

    prospects.push({
      prospect,
      draftValue: calculateDraftValue(prospect, rng.normal(0, 1.5)),
    })
  }

  prospects.sort((a, b) => {
    if (b.draftValue !== a.draftValue) {
      return b.draftValue - a.draftValue
    }
    return a.prospect.id.localeCompare(b.prospect.id)
  })

  return prospects.map(({ prospect }, index) => ({
    ...prospect,
    id: `prospect_${year}_${String(index + 1).padStart(3, "0")}`,
  }))
}
