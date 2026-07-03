import type { Contract } from "@workspace/shared/contractTypes"
import type { LeagueRecord, Player, Rng } from "@workspace/shared/types"
import {
  DEBT_Austerity_THRESHOLD,
  TOLERANCE_CASH_FLOOR,
} from "@workspace/shared/financialConstants"

import { getSeasonFinancials } from "../capMath"
import { getTeamPayroll, getPlayerContract } from "../payroll"
import { releasePlayer } from "../../roster/rosterManagement"
import { waiveContract } from "../contracts/createContract"
import { calculateRosterKeepValue } from "../../playerValue"
import { getScarceRolePenalty } from "../../roster/rosterBalance"

export function computeCapCutScore(
  player: Player,
  salary: number,
  roster: Player[] = []
): number {
  return (
    salary * 2 +
    (90 - calculateRosterKeepValue(player, "buying")) -
    getScarceRolePenalty(roster, player)
  )
}

export function shouldCutForCap(
  teamFinance: LeagueRecord["teamFinancials"][number],
  payroll: number,
  taxLine: number
): boolean {
  const tolerance = teamFinance.spendingProfile.taxTolerance
  const mode = teamFinance.strategy.mode

  if (teamFinance.debt >= DEBT_Austerity_THRESHOLD) {
    return true
  }

  if (mode === "selling") {
    return payroll > taxLine
  }

  if (mode === "contending") {
    return false
  }

  if (tolerance === "tax_averse") {
    return payroll > taxLine
  }

  if (tolerance === "prudent" && teamFinance.consecutiveTaxSeasons >= 2) {
    return payroll > taxLine
  }

  const floor = TOLERANCE_CASH_FLOOR[tolerance]
  if (teamFinance.cashReserves < floor) {
    return payroll > taxLine
  }

  return false
}

export function selectCapCutCandidate(
  team: { players: Player[] },
  contracts: Contract[]
): Player | undefined {
  const scored = team.players.map((player) => {
    const contract = getPlayerContract(contracts, player)
    const salary = contract?.yearlySalaries[0] ?? 0
    return { player, score: computeCapCutScore(player, salary, team.players) }
  })

  return scored.sort((a, b) => b.score - a.score)[0]?.player
}

export function applyAiCapBehavior(
  league: LeagueRecord,
  _rng: Rng
): LeagueRecord {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season
  )

  let current = league

  for (const teamFinance of current.teamFinancials) {
    let payroll = getTeamPayroll(teamFinance.teamId, current.contracts)

    while (
      shouldCutForCap(teamFinance, payroll, seasonFinancials.luxuryTaxLine)
    ) {
      const team = current.seasonState.teams.find(
        (entry) => entry.id === teamFinance.teamId
      )
      if (!team || team.players.length <= 8) {
        break
      }

      const cutCandidate =
        teamFinance.strategy.mode === "contending"
          ? selectCapCutCandidate(team, current.contracts)
          : selectCapCutCandidate(team, current.contracts)

      if (!cutCandidate) {
        break
      }

      if (teamFinance.strategy.mode === "contending") {
        const contract = getPlayerContract(current.contracts, cutCandidate)
        const salary = contract?.yearlySalaries[0] ?? 0
        const score = computeCapCutScore(cutCandidate, salary, team.players)
        if (score < 80 || cutCandidate.ratings.overall >= 75) {
          break
        }
      }

      const contract = getPlayerContract(current.contracts, cutCandidate)
      const releaseResult = releasePlayer(
        current.seasonState.teams,
        current.freeAgentPool,
        { teamId: teamFinance.teamId, playerId: cutCandidate.id }
      )

      current = {
        ...current,
        seasonState: {
          ...current.seasonState,
          teams: releaseResult.teams,
        },
        freeAgentPool: releaseResult.freeAgentPool,
        contracts: contract
          ? current.contracts.map((entry) =>
              entry.id === contract.id ? waiveContract(entry) : entry
            )
          : current.contracts,
      }

      payroll = getTeamPayroll(teamFinance.teamId, current.contracts)
    }
  }

  return current
}
