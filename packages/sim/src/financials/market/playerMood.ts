import type { FreeAgentOffer } from "@workspace/shared/contractTypes"
import type { MarketTier } from "@workspace/shared/financialTypes"
import type { PlayerMood } from "@workspace/shared/types"

export function getAskMultiplier(
  mood: PlayerMood,
  isReSign: boolean,
  marketTier: MarketTier,
): number {
  let multiplier = 1 + (mood.money - 50) / 200

  if (isReSign && mood.loyalty >= 65) {
    multiplier -= 0.06
  }
  if (marketTier === "large" && mood.fame >= 65) {
    multiplier += 0.04
  }

  return Math.max(0.85, Math.min(1.25, multiplier))
}

export function getMoodAcceptScore(
  offer: FreeAgentOffer,
  fairSalary: number,
  mood: PlayerMood,
  isReSign: boolean,
  teamWins: number,
): number {
  let score = offer.firstYearSalary - fairSalary * getAskMultiplier(mood, isReSign, "mid")

  if (mood.winning >= 60 && teamWins >= 45) {
    score += (mood.winning - 50) * 0.05
  }
  if (isReSign && mood.loyalty >= 70) {
    score += 2
  }

  return score
}

export function wouldPlayerAcceptOffer(
  offer: FreeAgentOffer,
  fairSalary: number,
  mood: PlayerMood,
  isReSign: boolean,
  teamWins: number,
): boolean {
  return getMoodAcceptScore(offer, fairSalary, mood, isReSign, teamWins) >= -1.5
}

export function getTradeMoodAdjustment(mood: PlayerMood): number {
  return (50 - mood.loyalty) * 0.08
}

export function getWinningTeamBonus(wins: number, mood: PlayerMood): number {
  if (mood.winning < 55 || wins < 42) {
    return 0
  }
  return (mood.winning - 50) * 0.04
}
