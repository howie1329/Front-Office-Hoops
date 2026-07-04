import { DRAFT_ROUNDS } from "@workspace/shared/constants"
import type {
  DraftPickAsset,
  DraftPick,
  Rng,
  SeasonState,
} from "@workspace/shared/types"

import { sortStandings } from "../deriveStandings"
import { createRng } from "../rng"

function compareDraftOrder(
  a: {
    teamId: string
    wins: number
    losses: number
    pointsFor: number
    pointsAgainst: number
  },
  b: {
    teamId: string
    wins: number
    losses: number
    pointsFor: number
    pointsAgainst: number
  },
  rng: Rng
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
  const worstToBest = [...standings].sort((a, b) =>
    compareDraftOrder(a, b, rng)
  )
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
        originalTeamId: teamId,
        playerId: null,
      })
      overallPick += 1
    })
  }

  return picks
}

export function generateDraftOrderFromSeed(
  state: SeasonState,
  baseSeed: string
): DraftPick[] {
  return generateDraftOrder(
    state,
    createRng(`${baseSeed}:draft-order:${state.season + 1}`)
  )
}

export function generateInitialDraftPickAssets(
  teamIds: string[],
  startSeason: number,
  seasonsAhead = 4
): DraftPickAsset[] {
  const assets: DraftPickAsset[] = []

  for (
    let season = startSeason;
    season < startSeason + seasonsAhead;
    season++
  ) {
    for (let round = 1 as const; round <= DRAFT_ROUNDS; round++) {
      for (const teamId of teamIds) {
        assets.push({
          id: `pick_${season}_${round}_${teamId}`,
          originalTeamId: teamId,
          currentTeamId: teamId,
          season,
          round,
          protection: null,
        })
      }
    }
  }

  return assets
}

export function ensureDraftPickAssets(
  existing: DraftPickAsset[],
  teamIds: string[],
  startSeason: number,
  seasonsAhead = 4
): DraftPickAsset[] {
  const byId = new Map(existing.map((asset) => [asset.id, asset]))
  const generated = generateInitialDraftPickAssets(
    teamIds,
    startSeason,
    seasonsAhead
  )

  for (const asset of generated) {
    if (!byId.has(asset.id)) {
      byId.set(asset.id, asset)
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.season !== b.season) {
      return a.season - b.season
    }
    if (a.round !== b.round) {
      return a.round - b.round
    }
    return a.originalTeamId.localeCompare(b.originalTeamId)
  })
}

export function generateDraftOrderFromAssets(
  state: SeasonState,
  draftPickAssets: DraftPickAsset[],
  rng: Rng
): DraftPick[] {
  const draftYear = state.season + 1
  const standings = sortStandings(state.standings)
  const worstToBest = [...standings].sort((a, b) =>
    compareDraftOrder(a, b, rng)
  )
  const roundOneTeamIds = worstToBest.map((standing) => standing.teamId)
  const picks: DraftPick[] = []
  let overallPick = 1

  for (let round = 1 as const; round <= DRAFT_ROUNDS; round++) {
    const roundTeams =
      round === 1 ? roundOneTeamIds : [...roundOneTeamIds].reverse()

    roundTeams.forEach((originalTeamId, index) => {
      const asset = draftPickAssets.find(
        (entry) =>
          entry.season === draftYear &&
          entry.round === round &&
          entry.originalTeamId === originalTeamId
      )

      picks.push({
        assetId: asset?.id,
        overallPick,
        round,
        pickInRound: index + 1,
        teamId: asset?.currentTeamId ?? originalTeamId,
        originalTeamId,
        playerId: null,
      })
      overallPick += 1
    })
  }

  return picks
}
