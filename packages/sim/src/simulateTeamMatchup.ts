import { DEFAULT_HOME_COURT_ADVANTAGE } from "@workspace/shared/constants"
import type { Rng, TeamMatchupInput, TeamMatchupResult } from "@workspace/shared/types"

import { estimateDefFactor, estimateOffRtg } from "./teamStrength"

const POSSESSION_NOISE_STDDEV = 3

function estimatePossessions(pace: number, rng: Rng): number {
  return Math.max(1, Math.round(pace + rng.normal(0, POSSESSION_NOISE_STDDEV)))
}

function scoreFromPossessions(possessions: number, offRtg: number): number {
  return Math.round((possessions * offRtg) / 100)
}

function resolveTie(
  homeScore: number,
  awayScore: number,
  homeTeamId: string,
  awayTeamId: string,
  rng: Rng,
): { homeScore: number; awayScore: number; winnerId: string } {
  if (homeScore === awayScore) {
    const homeWinsTiebreak = rng.next() >= 0.5
    const bonus = rng.int(1, 2)

    if (homeWinsTiebreak) {
      return {
        homeScore: homeScore + bonus,
        awayScore,
        winnerId: homeTeamId,
      }
    }

    return {
      homeScore,
      awayScore: awayScore + bonus,
      winnerId: awayTeamId,
    }
  }

  return {
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? homeTeamId : awayTeamId,
  }
}

export function simulateTeamMatchup(
  input: TeamMatchupInput,
  rng: Rng,
): TeamMatchupResult {
  const { home, away } = input
  const homeCourtAdvantage =
    input.homeCourtAdvantage ?? DEFAULT_HOME_COURT_ADVANTAGE

  const homePossessions = estimatePossessions(home.pace, rng)
  const awayPossessions = estimatePossessions(away.pace, rng)

  const homeOffRtg = estimateOffRtg(home, estimateDefFactor(away), rng)
  const awayOffRtg = estimateOffRtg(away, estimateDefFactor(home), rng)

  let homeScore = scoreFromPossessions(homePossessions, homeOffRtg) + homeCourtAdvantage
  let awayScore = scoreFromPossessions(awayPossessions, awayOffRtg)

  const resolved = resolveTie(homeScore, awayScore, home.id, away.id, rng)
  homeScore = resolved.homeScore
  awayScore = resolved.awayScore

  return {
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore,
    awayScore,
    winnerId: resolved.winnerId,
    meta: {
      homePossessions,
      awayPossessions,
      homeOffRtg,
      awayOffRtg,
    },
  }
}
