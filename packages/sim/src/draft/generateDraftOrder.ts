import {
  DRAFT_ROUNDS,
  RATING_MAX,
  ROOKIE_AGE_MAX,
  ROOKIE_AGE_MIN,
  ROOKIE_OVERALL_BASE,
  ROOKIE_POTENTIAL_GAP_MAX,
  ROOKIE_POTENTIAL_GAP_MIN,
} from "@workspace/shared/constants"
import type {
  DraftPick,
  PlayerPosition,
  Rng,
  SeasonState,
} from "@workspace/shared/types"

import { sortStandings } from "../deriveStandings"
import { createRng } from "../rng"

function compareDraftOrder(
  a: { teamId: string; wins: number; losses: number; pointsFor: number; pointsAgainst: number },
  b: { teamId: string; wins: number; losses: number; pointsFor: number; pointsAgainst: number },
  rng: Rng,
): number {
  const gamesA = a.wins + a.losses
  const gamesB = b.wins + b.losses
  const winPctA = gamesA === 0 ? 0 : a.wins / gamesA
  const winPctB = gamesB === 0 ? 0 : b.wins / gamesB

  if (winPctA !== winPctB) {
    return winPctA - winPctB
  }

  const diffA = a.pointsFor - a.pointsAgainst
  const diffB = b.pointsFor - b.pointsAgainst

  if (diffA !== diffB) {
    return diffA - diffB
  }

  return rng.next() - 0.5
}

export function generateDraftOrder(state: SeasonState, rng: Rng): DraftPick[] {
  const standings = sortStandings(state.standings)
  const worstToBest = [...standings].sort((a, b) => compareDraftOrder(a, b, rng))
  const roundOneTeamIds = worstToBest.map((standing) => standing.teamId)
  const picks: DraftPick[] = []
  let overallPick = 1

  for (let round = 1 as const; round <= DRAFT_ROUNDS; round++) {
    const roundTeams =
      round === 1 ? roundOneTeamIds : [...roundOneTeamIds].reverse()

    roundTeams.forEach((teamId, index) => {
      picks.push({
        overallPick,
        round,
        pickInRound: index + 1,
        teamId,
        playerId: null,
      })
      overallPick += 1
    })
  }

  return picks
}

export function generateDraftOrderFromSeed(state: SeasonState, baseSeed: string): DraftPick[] {
  return generateDraftOrder(state, createRng(`${baseSeed}:draft-order:${state.season + 1}`))
}
