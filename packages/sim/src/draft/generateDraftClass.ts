import {
  RATING_MAX,
  ROOKIE_AGE_MAX,
  ROOKIE_OVERALL_BASE,
  ROOKIE_OVERALL_MIN,
  ROOKIE_POTENTIAL_GAP_MIN,
} from "@workspace/shared/constants"
import type {
  DraftProspect,
  PlayerPosition,
  ProspectType,
  Rng,
} from "@workspace/shared/types"

import { generatePlayerProfile } from "../playerGeneration/generatePlayerProfile"
import { pickProspectType } from "../playerGeneration/correlationBundles"
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
    ROOKIE_OVERALL_MIN,
    Math.min(72, clampRating(rng.normal(ROOKIE_OVERALL_BASE + strength.overallOffset, 7))),
  )
}

function pickProspectTypeForDraft(
  targetOverall: number,
  rng: Rng,
): ProspectType {
  const readyNowRolePlayer = targetOverall >= 55 && rng.next() < 0.2
  if (readyNowRolePlayer) {
    return "polish"
  }

  return pickProspectType(rng, "draft")
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
  rng: Rng,
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
    const prospectType = pickProspectTypeForDraft(baseRating, rng)
    const profile = generatePlayerProfile({
      age,
      targetOverall: baseRating,
      position,
      rng,
      usedNames,
      archetypeContext: "draft",
      prospectType,
      usageIndex: 0,
      scoutingLevel: 3,
    })
    const readyNow = prospectType === "polish" && baseRating >= 55
    const potential = readyNow
      ? Math.min(
          RATING_MAX,
          profile.ratings.overall + rng.int(2, 6),
        )
      : Math.min(
          RATING_MAX,
          Math.max(
            profile.ratings.overall + ROOKIE_POTENTIAL_GAP_MIN,
            profile.ratings.potential,
          ),
        )

    const prospect = {
      id: `raw_prospect_${year}_${String(index + 1).padStart(3, "0")}`,
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      peakAge: profile.peakAge,
      heightInches: profile.heightInches,
      weightLbs: profile.weightLbs,
      wingspanInches: profile.wingspanInches,
      reachRating: profile.reachRating,
      position: profile.position,
      archetype: profile.archetype,
      prospectType: profile.prospectType,
      ratings: {
        ...profile.ratings,
        potential,
        usage: 8,
      },
      tags: [prospectType],
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
