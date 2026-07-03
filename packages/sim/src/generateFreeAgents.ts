import type { Player, PlayerPosition, Rng } from "@workspace/shared/types"

import { generatePlayerProfile } from "./playerGeneration/generatePlayerProfile"

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

export function generateFreeAgents(
  count: number,
  rng: Rng,
  idPrefix = "generated"
): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < count; index++) {
    const position = POSITIONS[index % POSITIONS.length]!
    const age = rng.int(24, 35)
    const profile = generatePlayerProfile({
      age,
      targetOverall: rng.int(45, 65),
      position,
      rng,
      usedNames,
      potentialGap: age <= 26 ? { min: 1, max: 8 } : { min: -4, max: 3 },
      skillVariance: { min: -5, max: 5 },
      skillBias: {
        shooting: -1,
        inside: -1,
        passing: -1,
        rebounding: -1,
        defense: -1,
      },
      usageIndex: index,
    })

    players.push({
      id: `p_fa_${idPrefix}_${String(index + 1).padStart(3, "0")}_${rng.int(1000, 9999)}`,
      teamId: null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      peakAge: profile.peakAge,
      heightInches: profile.heightInches,
      weightLbs: profile.weightLbs,
      position: profile.position,
      ratings: profile.ratings,
      tags: profile.tags,
      status: "free_agent",
      injury: null,
      draftInfo: null,
      activeContractId: null,
      seasonsWithTeam: 0,
      yearsOfService: profile.yearsOfService,
    })
  }

  return players
}
