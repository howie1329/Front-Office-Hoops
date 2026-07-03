import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { getSeasonFinancials } from "../capMath"
import { getTeamPayroll } from "../payroll"
import { signFreeAgent, canSignPlayer, getTeamExpiredFreeAgents } from "../freeAgency"
import {
  buildFairSalary,
  buildReSignOffer,
  canAffordOffer,
  getPriorContractSalary,
  shouldReSignPlayer,
} from "./offers"

export function processAiReSignings(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  let current = league
  const seasonFinancials = getSeasonFinancials(
    current.leagueFinancials,
    current.seasonState.season,
  )

  for (const teamFinance of current.teamFinancials) {
    const team = current.seasonState.teams.find(
      (entry) => entry.id === teamFinance.teamId,
    )
    if (!team) {
      continue
    }

    const candidates = getTeamExpiredFreeAgents(current, teamFinance.teamId)
    const sortedCandidates = [...candidates].sort(
      (a, b) => b.ratings.overall - a.ratings.overall,
    )

    for (const player of sortedCandidates) {
      const fairSalary = buildFairSalary(player, seasonFinancials)
      const priorSalary = getPriorContractSalary(current.contracts, player)

      if (
        !shouldReSignPlayer(
          player,
          team.players,
          teamFinance,
          fairSalary,
          seasonFinancials,
          priorSalary,
        )
      ) {
        continue
      }

      const offer = buildReSignOffer(
        player,
        teamFinance,
        seasonFinancials,
        priorSalary,
        rng,
      )

      const payroll = getTeamPayroll(teamFinance.teamId, current.contracts)

      if (
        !canAffordOffer(
          teamFinance,
          payroll,
          offer.firstYearSalary,
          seasonFinancials,
        )
      ) {
        continue
      }

      const validation = canSignPlayer(
        current,
        teamFinance.teamId,
        player.id,
        offer,
      )
      if (!validation.ok) {
        continue
      }

      try {
        current = signFreeAgent(current, teamFinance.teamId, player.id, {
          ...offer,
          signingException: validation.signingException,
        })
      } catch {
        // skip
      }
    }
  }

  return current
}
