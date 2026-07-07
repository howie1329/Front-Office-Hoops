import type { SeasonFinancials, TeamFinancials } from "@workspace/shared/financialTypes"
import type { LeagueRecord, Player, TeamWithRoster } from "@workspace/shared/types"

import { getPositionNeeds, scoreFreeAgentForTeam } from "../ai/freeAgentScoring"
import { canAffordOffer } from "../ai/offers"
import { getArchetypeMarketPremium } from "../../playerValue/archetypeMarket"
import { getFairSalary, getPlayerWorth } from "../../playerValue"
import { DEFAULT_PLAYER_MOOD } from "../../playerValue/moodSeed"
import {
  getMoodAcceptScore,
  getWinningTeamBonus,
} from "./playerMood"

export function scoreBidForPlayer({
  player,
  team,
  teamFinance,
  league,
  seasonFinancials,
  payroll,
  isReSign,
}: {
  player: Player
  team: TeamWithRoster
  teamFinance: TeamFinancials
  league: LeagueRecord
  seasonFinancials: SeasonFinancials
  payroll: number
  isReSign: boolean
}): number {
  const fairSalary = getFairSalary(player, seasonFinancials, league)
  const worth = getPlayerWorth(player, { league, includeMarketPremium: true })
  const marketPremium = getArchetypeMarketPremium(player, league)
  const mood = player.mood ?? DEFAULT_PLAYER_MOOD
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === team.id,
  )
  const wins = standing?.wins ?? 20
  const moodBonus = getWinningTeamBonus(wins, mood)
  const needBonus = getPositionNeeds(team)[player.position] ?? 0

  let score =
    worth * marketPremium +
    needBonus * 0.8 +
    moodBonus * 4 +
    scoreFreeAgentForTeam(
      player,
      team,
      teamFinance.strategy.mode,
      fairSalary,
      fairSalary,
    ) * 0.15

  if (teamFinance.strategy.mode === "contending" && player.ratings.overall >= 72) {
    score *= 1.15
  }
  if (teamFinance.strategy.mode === "selling" && player.age > 28) {
    score *= 0.75
  }
  if (isReSign) {
    score += (mood.loyalty - 50) * 0.08
  }

  const projectedOfferSalary = fairSalary * marketPremium
  if (
    !canAffordOffer(
      teamFinance,
      payroll,
      projectedOfferSalary,
      seasonFinancials,
    )
  ) {
    return 0
  }

  return Math.max(0, score)
}

export function pickAuctionWinner(
  bids: { teamId: string; score: number }[],
): string | null {
  if (bids.length === 0) {
    return null
  }

  const total = bids.reduce((sum, bid) => sum + bid.score ** 2, 0)
  if (total <= 0) {
    return null
  }

  let roll = Math.random() * total
  for (const bid of bids) {
    roll -= bid.score ** 2
    if (roll <= 0) {
      return bid.teamId
    }
  }

  return bids[bids.length - 1]!.teamId
}

export function adjustAskFromBids(bidCount: number, currentAsk: number): number {
  if (bidCount === 0) {
    return Math.max(currentAsk * 0.97, currentAsk - 0.5)
  }
  if (bidCount >= 2) {
    return currentAsk * 1.04
  }
  return currentAsk
}

export function getMoodAdjustedOfferScore(
  offerSalary: number,
  fairSalary: number,
  player: Player,
  isReSign: boolean,
  wins: number,
): number {
  return getMoodAcceptScore(
    { years: 1, firstYearSalary: offerSalary },
    fairSalary,
    player.mood,
    isReSign,
    wins,
  )
}
