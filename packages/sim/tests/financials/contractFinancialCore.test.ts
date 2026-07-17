import { describe, expect, it } from "vitest"

import {
  applyLeagueCommand,
  createLeague,
  createRng,
  getTeamFinancialPosition,
  processOffseasonFinancials,
} from "../../src"
import { createDeadCapFromWaive } from "../../src/financials/deadCap"
import { processContractOptions } from "../../src/financials/contracts/processContracts"
import { validateContractGuarantees } from "../../src/financials/contracts/validateContract"
import { canAffordOffer } from "../../src/financials/ai/offers"
import { createRookieScaleContract } from "../../src/financials/contracts/createContract"

function makeLeague() {
  return createLeague({
    skipPreseason: true,
    name: "Contract financial core",
    baseSeed: "contract-financial-core",
    rng: createRng("contract-financial-core"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })
}

describe("contract financial core", () => {
  it("counts holds against cap space but not tax payroll", () => {
    const league = makeLeague()
    const teamId = league.userTeamId!
    const baseline = getTeamFinancialPosition(league, teamId, 1)
    const withHold = {
      ...league,
      teamFinancials: league.teamFinancials.map((finance) =>
        finance.teamId === teamId
          ? {
              ...finance,
              capHolds: [
                {
                  id: "hold_test",
                  playerId: "p_hold",
                  teamId,
                  season: 1,
                  amount: 12,
                  rightsType: "bird" as const,
                  status: "active" as const,
                },
              ],
            }
          : finance,
      ),
    }
    const position = getTeamFinancialPosition(withHold, teamId, 1)

    expect(position.taxPayroll).toBe(baseline.taxPayroll)
    expect(position.capHolds).toBe(12)
    expect(position.capSpace).toBeCloseTo(baseline.capSpace - 12)
  })

  it("creates dead cap only from guaranteed salary", () => {
    const league = makeLeague()
    const contract = league.contracts[0]!
    const partial = {
      ...contract,
      yearlySalaries: [10, 12, 14],
      guaranteedSalaries: [10, 6, 0],
    }

    expect(createDeadCapFromWaive(partial, contract.playerId).map((charge) => charge.amount)).toEqual([10, 6])
    expect(validateContractGuarantees(partial)).toEqual({ ok: true })
    expect(
      validateContractGuarantees({
        ...partial,
        guaranteedSalaries: [11, 6, 0],
      }).ok,
    ).toBe(false)
  })

  it("guarantees rookie years only when team control is committed", () => {
    const league = makeLeague()
    const player = league.seasonState.teams[0]!.players[0]!
    const financials = league.leagueFinancials.bySeason[1]!
    const rookie = createRookieScaleContract(
      player,
      1,
      league.seasonState.teams[0]!.id,
      1,
      financials,
      1,
    )

    expect(rookie.guaranteedSalaries.slice(0, 2)).toEqual(
      rookie.yearlySalaries.slice(0, 2),
    )
    expect(rookie.guaranteedSalaries.slice(2)).toEqual([0, 0])
  })

  it("uses ownership tolerance for AI affordability, not signing legality", () => {
    const league = makeLeague()
    const base = league.teamFinancials[0]!
    const financials = league.leagueFinancials.bySeason[1]!
    const taxAverse = {
      ...base,
      cashReserves: 8,
      spendingProfile: {
        ...base.spendingProfile,
        taxTolerance: "tax_averse" as const,
      },
    }
    const allIn = {
      ...base,
      cashReserves: 8,
      spendingProfile: {
        ...base.spendingProfile,
        taxTolerance: "all_in" as const,
      },
    }

    expect(canAffordOffer(taxAverse, 165, 8, financials)).toBe(false)
    expect(canAffordOffer(allIn, 165, 8, financials)).toBe(true)
  })

  it("resolves player options deterministically", () => {
    const league = makeLeague()
    const team = league.seasonState.teams[0]!
    const player = team.players[0]!
    const optionLeague = {
      ...league,
      contracts: league.contracts.map((contract) =>
        contract.playerId === player.id
          ? {
              ...contract,
              yearlySalaries: [50],
              guaranteedSalaries: [0],
              options: [{ yearIndex: 0, type: "player" as const }],
            }
          : contract,
      ),
    }

    const first = processContractOptions(optionLeague, createRng("first"))
    const second = processContractOptions(optionLeague, createRng("second"))
    const firstContract = first.contracts.find((entry) => entry.playerId === player.id)
    const secondContract = second.contracts.find((entry) => entry.playerId === player.id)

    expect(firstContract).toEqual(secondContract)
    expect(firstContract?.guaranteedSalaries[0]).toBe(50)
  })

  it("creates and renounces an expiring player's cap hold", () => {
    const league = makeLeague()
    const team = league.seasonState.teams.find((entry) => entry.id === league.userTeamId)!
    const player = { ...team.players[0]!, seasonsWithTeam: 3 }
    const expiring = {
      ...league,
      seasonState: {
        ...league.seasonState,
        phase: "offseason" as const,
        offseasonPhase: "contract_options" as const,
        teams: league.seasonState.teams.map((entry) =>
          entry.id === team.id
            ? {
                ...entry,
                players: entry.players.map((candidate) =>
                  candidate.id === player.id ? player : candidate,
                ),
              }
            : entry,
        ),
      },
      contracts: league.contracts.map((contract) =>
        contract.playerId === player.id
          ? {
              ...contract,
              yearlySalaries: [20],
              guaranteedSalaries: [20],
            }
          : contract,
      ),
    }

    const expired = processOffseasonFinancials(
      expiring,
      createRng("cap-hold-rollover"),
    )
    const activeHold = expired.teamFinancials
      .find((entry) => entry.teamId === team.id)!
      .capHolds.find((hold) => hold.playerId === player.id)
    expect(activeHold).toMatchObject({ rightsType: "bird", status: "active" })

    const renounced = applyLeagueCommand(expired, {
      type: "renouncePlayerRights",
      playerId: player.id,
    })
    expect(
      renounced.teamFinancials
        .find((entry) => entry.teamId === team.id)!
        .capHolds.find((hold) => hold.playerId === player.id)?.status,
    ).toBe("renounced")
  })
})
