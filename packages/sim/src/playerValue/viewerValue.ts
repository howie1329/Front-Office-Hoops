import type { Contract } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player } from "@workspace/shared/types"

import { getSeasonFinancials } from "../financials/capMath"
import { getPlayerContract } from "../financials/payroll"
import { getTeamFinancialPosition } from "../financials/teamFinancialPosition"
import { getContractValueBreakdown } from "./contractValue"
import { getProjectedPlayerValueBreakdown } from "./projectedValue"

export type PlayerDecisionValueBreakdown = {
  talent: number
  ageCurve: number
  durability: number
  contract: number
  scarcity: number
  production: number
  total: number
}

export type PlayerDecisionValueInput = {
  league: LeagueRecord
  player: Player
  receivingTeamId: string
  contract?: Contract
}

/**
 * Explains a player's value from one team's visible information. Callers may
 * pass a scouted player copy while AI systems continue passing the true player.
 */
export function getPlayerDecisionValueBreakdown(
  input: PlayerDecisionValueInput,
): PlayerDecisionValueBreakdown {
  const { league, player, receivingTeamId } = input
  const season = league.leagueFinancials.currentCapSeason
  const seasonFinancials = getSeasonFinancials(league.leagueFinancials, season)
  const contract = input.contract ?? getPlayerContract(league.contracts, player)
  const projected = getProjectedPlayerValueBreakdown(player, { league })
  const position = getTeamFinancialPosition(league, receivingTeamId, season)
  const currentSalary =
    contract?.teamId === receivingTeamId ? (contract.yearlySalaries[0] ?? 0) : 0
  const financial = getContractValueBreakdown({
    player,
    contract,
    seasonFinancials,
    leagueFinancials: league.leagueFinancials,
    receivingTeamFinancials: league.teamFinancials.find(
      (entry) => entry.teamId === receivingTeamId,
    ),
    receivingTeamPayroll: position.taxPayroll - currentSalary,
    projectedPlayerValue: projected,
  })

  const breakdown = {
    talent: projected.talent,
    ageCurve: projected.ageCurve,
    durability: -projected.durabilityRisk,
    contract: financial.total,
    scarcity: projected.archetypeMarket,
    production: projected.production,
  }

  return {
    ...breakdown,
    total: Object.values(breakdown).reduce((total, value) => total + value, 0),
  }
}
