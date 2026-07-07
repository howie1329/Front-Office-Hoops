import { MARKET_AUCTION_ROUNDS } from "@workspace/shared/financialConstants"
import type { FreeAgentOffer } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"
import {
  ROSTER_MAX,
  ROSTER_MIN,
} from "@workspace/shared/constants"

import { getSeasonFinancials, calculateMinSalary } from "../capMath"
import { getTeamPayroll } from "../payroll"
import {
  buildExternalFaOffer,
  canAffordOffer,
} from "../ai/offers"
import {
  scoreFreeAgentForTeam,
  selectFreeAgentTarget,
} from "../ai/freeAgentScoring"
import { getFairSalary } from "../../playerValue"
import { DEFAULT_PLAYER_MOOD } from "../../playerValue/moodSeed"
import {
  ensureFaPoolMinimum,
  getExternalFreeAgents,
  signFreeAgent,
} from "../freeAgency"
import {
  adjustAskFromBids,
  pickAuctionWinner,
  scoreBidForPlayer,
} from "./bidScoring"
import { getAskMultiplier } from "./playerMood"

function selectAuctionPlayer(pool: Player[], rng: Rng): Player | null {
  if (pool.length === 0) {
    return null
  }

  const sorted = [...pool].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )
  const topCount = Math.min(8, sorted.length)
  return sorted[rng.int(0, topCount - 1)]!
}

function buildOfferNearAsk(
  player: Player,
  ask: number,
  teamFinance: LeagueRecord["teamFinancials"][number],
  seasonFinancials: ReturnType<typeof getSeasonFinancials>,
  rng: Rng,
): FreeAgentOffer {
  const externalOffer = buildExternalFaOffer(
    player,
    teamFinance,
    seasonFinancials,
    rng,
  )
  return {
    years: externalOffer.years,
    firstYearSalary: Math.max(externalOffer.firstYearSalary, ask),
  }
}

function fillTeamRostersAfterAuction(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.seasonState.season,
  )

  for (const teamFinance of current.teamFinancials) {
    const skippedFreeAgentIds = new Set<string>()

    while (true) {
      const team = current.seasonState.teams.find(
        (entry) => entry.id === teamFinance.teamId,
      )
      if (!team || team.players.length >= ROSTER_MAX) {
        break
      }

      const payroll = getTeamPayroll(teamFinance.teamId, current.contracts)
      const scoreFn = (player: Player) => {
        const offer = buildExternalFaOffer(
          player,
          teamFinance,
          seasonFinancials,
          rng,
        )
        const fair = getFairSalary(player, seasonFinancials, current)
        return scoreFreeAgentForTeam(
          player,
          team,
          teamFinance.strategy.mode,
          offer.firstYearSalary,
          fair,
        )
      }

      const fa = selectFreeAgentTarget(
        getExternalFreeAgents(current, teamFinance.teamId).filter(
          (player) => !skippedFreeAgentIds.has(player.id),
        ),
        team,
        teamFinance.strategy.mode,
        scoreFn,
      )

      if (!fa) {
        if (team.players.length < ROSTER_MIN) {
          current = ensureFaPoolMinimum(current, rng)
          if (current.freeAgentPool.length === 0) {
            break
          }
          continue
        }
        break
      }

      let offer = buildExternalFaOffer(fa, teamFinance, seasonFinancials, rng)
      if (
        !canAffordOffer(
          teamFinance,
          payroll,
          offer.firstYearSalary,
          seasonFinancials,
        )
      ) {
        offer = {
          years: 1,
          firstYearSalary: calculateMinSalary(
            seasonFinancials,
            fa.yearsOfService,
          ),
        }
      }

      try {
        current = signFreeAgent(current, teamFinance.teamId, fa.id, offer)
      } catch {
        skippedFreeAgentIds.add(fa.id)
        const fallbacks = getExternalFreeAgents(current, teamFinance.teamId)
          .filter((player) => !skippedFreeAgentIds.has(player.id))
          .sort((a, b) => a.ratings.overall - b.ratings.overall)
        let signedFallback = false

        for (const fallback of fallbacks) {
          const minimumOffer = {
            years: 1,
            firstYearSalary: calculateMinSalary(
              seasonFinancials,
              fallback.yearsOfService,
            ),
          }
          try {
            current = signFreeAgent(
              current,
              teamFinance.teamId,
              fallback.id,
              minimumOffer,
            )
            signedFallback = true
            break
          } catch {
            skippedFreeAgentIds.add(fallback.id)
          }
        }

        if (!signedFallback) {
          break
        }
      }
    }
  }

  return current
}

export function runMarketAuction(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = ensureFaPoolMinimum(league, rng)
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.seasonState.season,
  )
  const asks = new Map<string, number>()

  for (let round = 0; round < MARKET_AUCTION_ROUNDS; round++) {
    const availablePool = current.freeAgentPool.filter((player) =>
      current.teamFinancials.some(
        (teamFinance) =>
          getExternalFreeAgents(current, teamFinance.teamId).some(
            (entry) => entry.id === player.id,
          ),
      ),
    )

    if (availablePool.length === 0) {
      break
    }

    const player = selectAuctionPlayer(availablePool, rng)
    if (!player) {
      break
    }

    const fairSalary = getFairSalary(player, seasonFinancials, current)
    const currentAsk =
      asks.get(player.id) ??
      fairSalary *
        getAskMultiplier(
          player.mood ?? DEFAULT_PLAYER_MOOD,
          false,
          current.teamFinancials[0]?.spendingProfile.marketTier ?? "mid",
        )

    const bids: { teamId: string; score: number; offer: FreeAgentOffer }[] = []

    for (const teamFinance of current.teamFinancials) {
      const team = current.seasonState.teams.find(
        (entry) => entry.id === teamFinance.teamId,
      )
      if (!team || team.players.length >= ROSTER_MAX) {
        continue
      }

      if (
        !getExternalFreeAgents(current, teamFinance.teamId).some(
          (entry) => entry.id === player.id,
        )
      ) {
        continue
      }

      const payroll = getTeamPayroll(teamFinance.teamId, current.contracts)
      const score = scoreBidForPlayer({
        player,
        team,
        teamFinance,
        league: current,
        seasonFinancials,
        payroll,
        isReSign: false,
      })

      if (score <= 0) {
        continue
      }

      bids.push({
        teamId: teamFinance.teamId,
        score,
        offer: buildOfferNearAsk(
          player,
          currentAsk,
          teamFinance,
          seasonFinancials,
          rng,
        ),
      })
    }

    const nextAsk = adjustAskFromBids(bids.length, currentAsk)
    asks.set(player.id, nextAsk)

    const winnerId = pickAuctionWinner(
      bids.map((bid) => ({ teamId: bid.teamId, score: bid.score })),
    )
    if (!winnerId) {
      continue
    }

    const winningBid = bids.find((bid) => bid.teamId === winnerId)
    if (!winningBid) {
      continue
    }

    try {
      current = signFreeAgent(
        current,
        winnerId,
        player.id,
        winningBid.offer,
      )
    } catch {
      // Another team may have filled its roster or cap rules blocked the sign.
    }
  }

  return fillTeamRostersAfterAuction(current, rng)
}
