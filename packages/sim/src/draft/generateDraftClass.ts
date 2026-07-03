import { RATING_MAX, ROOKIE_AGE_MAX } from "@workspace/shared/constants"
import type {
  DraftProspect,
  PlayerPosition,
  Rng,
} from "@workspace/shared/types"

import { generatePlayerProfile } from "../playerGeneration/generatePlayerProfile"
import { clampRating } from "../playerRatings"
import { getDraftClassSize, getDraftPickCount } from "./isDraftRequired"

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

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
    return {
      minOverall: 62,
      maxOverall: 68,
      minPotentialGap: 12,
      maxPotentialGap: 22,
    }
  }

  if (index < firstRoundCutoff) {
    return {
      minOverall: 54,
      maxOverall: 61,
      minPotentialGap: 8,
      maxPotentialGap: 16,
    }
  }

  if (index < pickCount) {
    return {
      minOverall: 48,
      maxOverall: 56,
      minPotentialGap: 4,
      maxPotentialGap: 12,
    }
  }

  return {
    minOverall: 45,
    maxOverall: 52,
    minPotentialGap: 2,
    maxPotentialGap: 20,
  }
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
  rng: Rng
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
    const potentialGap = pickPotentialGap(tier, index, rng)
    const profile = generatePlayerProfile({
      age,
      targetOverall: baseRating,
      position,
      rng,
      usedNames,
      potentialGap: { min: potentialGap, max: potentialGap },
      usageIndex: 0,
    })

    prospects.push({
      id: `prospect_${year}_${String(index + 1).padStart(3, "0")}`,
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
    })
  }

  return prospects
}
