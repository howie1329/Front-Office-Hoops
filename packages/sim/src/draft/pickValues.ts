import { ROOKIE_OVERALL_BASE } from "@workspace/shared/constants"
import type {
  DraftClassCache,
  DraftPickAsset,
  DraftProspect,
  LeagueRecord,
  TeamMode,
} from "@workspace/shared/types"

import { getPlayerWorth } from "../playerValue"
import { defaultDevelopmentFields } from "../development/playerDefaults"

function prospectToWorth(prospect: DraftProspect, league: LeagueRecord): number {
  const pseudoPlayer = {
    id: prospect.id,
    teamId: null,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    peakAge: prospect.peakAge,
    heightInches: prospect.heightInches,
    weightLbs: prospect.weightLbs,
    wingspanInches: prospect.wingspanInches,
    reachRating: prospect.reachRating,
    position: prospect.position,
    archetype: prospect.archetype,
    ratings: prospect.ratings,
    tags: prospect.tags,
    status: "free_agent" as const,
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: 0,
    mood: { money: 50, winning: 50, loyalty: 50, fame: 50 },
    ...defaultDevelopmentFields(prospect.ratings.overall),
  }

  return getPlayerWorth(pseudoPlayer, { league, includeMarketPremium: true })
}

function estimateOverallPick(
  league: LeagueRecord,
  pick: DraftPickAsset,
): number {
  const teamCount = league.seasonState.teams.length
  const standings = [...league.seasonState.standings].sort((a, b) => {
    const gamesA = a.wins + a.losses
    const gamesB = b.wins + b.losses
    const winPctA = gamesA === 0 ? 0 : a.wins / gamesA
    const winPctB = gamesB === 0 ? 0 : b.wins / gamesB
    return winPctA - winPctB
  })
  const rank =
    standings.findIndex((entry) => entry.teamId === pick.originalTeamId) + 1 ||
    Math.ceil(teamCount / 2)

  if (pick.round === 1) {
    return rank
  }

  return teamCount + (teamCount - rank + 1)
}

function strategyPickMultiplier(mode: TeamMode, pick: DraftPickAsset): number {
  switch (mode) {
    case "selling":
      return pick.round === 1 ? 1.35 : 1.2
    case "buying":
      return pick.round === 1 ? 0.95 : 0.9
    case "contending":
      return pick.season <= 2 ? 0.8 : 0.65
  }
}

export function buildDraftClassCache(
  league: LeagueRecord,
  prospects: DraftProspect[],
): DraftClassCache {
  const ranked = [...prospects]
    .map((prospect) => ({
      prospect,
      worth: prospectToWorth(prospect, league),
    }))
    .sort((a, b) => {
      if (b.worth !== a.worth) {
        return b.worth - a.worth
      }
      return a.prospect.id.localeCompare(b.prospect.id)
    })

  const averageOverall =
    prospects.reduce((sum, prospect) => sum + prospect.ratings.overall, 0) /
    Math.max(1, prospects.length)
  const averagePotential =
    prospects.reduce((sum, prospect) => sum + prospect.ratings.potential, 0) /
    Math.max(1, prospects.length)

  return {
    season: league.seasonState.draftState?.year ?? league.seasonState.season + 1,
    overallOffset: averageOverall - ROOKIE_OVERALL_BASE,
    potentialOffset: averagePotential - ROOKIE_OVERALL_BASE - 8,
    pickValues: ranked.map((entry) => entry.worth),
  }
}

export function getPickValueFromCache(
  pick: DraftPickAsset,
  cache: DraftClassCache | null,
  league: LeagueRecord,
  teamId: string,
  mode: TeamMode,
): number {
  const teamFinance = league.teamFinancials.find((entry) => entry.teamId === teamId)
  const resolvedMode = teamFinance?.strategy.mode ?? mode
  const overallPick = estimateOverallPick(league, pick)
  const yearsAway = Math.max(0, pick.season - (league.seasonState.season + 1))
  const distanceMultiplier = Math.max(0.55, 1 - yearsAway * 0.12)

  if (cache && pick.season === cache.season) {
    const cachedValue =
      cache.pickValues[overallPick - 1] ??
      cache.pickValues[cache.pickValues.length - 1] ??
      0
    return cachedValue * distanceMultiplier * strategyPickMultiplier(resolvedMode, pick)
  }

  const fallbackBase = pick.round === 1 ? 18 : 5
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === pick.originalTeamId,
  )
  const games = (standing?.wins ?? 0) + (standing?.losses ?? 0)
  const winPct = games === 0 ? 0.5 : (standing?.wins ?? 0) / games
  const teamQualityDiscount =
    pick.round === 1 ? (1 - winPct) * 28 : (1 - winPct) * 7

  return (
    (fallbackBase + teamQualityDiscount) *
    distanceMultiplier *
    strategyPickMultiplier(resolvedMode, pick)
  )
}
