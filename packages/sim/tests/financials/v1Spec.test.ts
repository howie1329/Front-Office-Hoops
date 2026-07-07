import { describe, expect, it } from "vitest"

import type { Contract } from "@workspace/shared/contractTypes"
import { REPEATER_TAX_SEASONS } from "@workspace/shared/financialConstants"
import { ROSTER_MAX } from "@workspace/shared/constants"

import { calculateLuxuryTax } from "../../src/financials/capMath"
import { createDeadCapFromWaive, getTeamDeadCapPayroll } from "../../src/financials/deadCap"
import { canSignPlayer } from "../../src/financials/freeAgency"
import { createLeague, createRng, executeTrade, validateTrade } from "../../src"
import { getSeasonFinancials } from "../../src/financials"

describe("financial v1 spec mechanics", () => {
  it("applies repeater tax surcharge", () => {
    const base = calculateLuxuryTax(180, 171, 5, false)
    const repeater = calculateLuxuryTax(180, 171, 5, true)
    expect(repeater).toBeGreaterThan(base)
    expect(REPEATER_TAX_SEASONS).toBe(3)
  })

  it("creates stretched dead cap on waive", () => {
    const contract: Contract = {
      id: "c_dead",
      playerId: "p_dead",
      teamId: "t_a",
      startSeason: 1,
      endSeason: 3,
      yearlySalaries: [10, 10, 10],
      contractType: "standard",
      signingException: "cap_room",
      status: "active",
      signedSeason: 1,
    }

    const charges = createDeadCapFromWaive(contract, "p_dead")
    expect(charges).toHaveLength(2)
    expect(getTeamDeadCapPayroll(charges)).toBe(30)
  })

  it("allows room MLE when team was under cap and full MLE unused", () => {
    const league = createLeague({
      name: "Room MLE",
      baseSeed: "room-mle",
      rng: createRng("room-mle"),
      useMiniLeague: true,
      skipPreseason: true,
    })
    const team = league.seasonState.teams[0]!
    const teamFinance = league.teamFinancials.find((entry) => entry.teamId === team.id)!
    const fa = league.freeAgentPool[0]!
    const seasonFinancials = getSeasonFinancials(league.leagueFinancials, 1)

    const inflatedContracts = league.contracts.map((contract) =>
      contract.teamId === team.id
        ? {
            ...contract,
            yearlySalaries: [seasonFinancials.salaryCap * 0.95],
          }
        : contract,
    )

    const updatedFinance = {
      ...teamFinance,
      wasUnderCapThisYear: true,
      mleUsed: 0,
      roomMleRemaining: seasonFinancials.mleRoom,
    }
    const leagueWithRoom = {
      ...league,
      contracts: inflatedContracts,
      seasonState: {
        ...league.seasonState,
        teams: league.seasonState.teams.map((entry) =>
          entry.id === team.id
            ? {
                ...entry,
                players: entry.players.slice(0, ROSTER_MAX - 1),
              }
            : entry,
        ),
      },
      teamFinancials: league.teamFinancials.map((entry) =>
        entry.teamId === team.id ? updatedFinance : entry,
      ),
    }

    const result = canSignPlayer(leagueWithRoom, team.id, fa.id, {
      years: 2,
      firstYearSalary: seasonFinancials.mleRoom,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.signingException).toBe("mle_room")
    }
  })

  it("resets bird rights when a player is traded", () => {
    const league = createLeague({
      name: "Bird reset",
      baseSeed: "bird-reset",
      rng: createRng("bird-reset"),
      useMiniLeague: true,
      skipPreseason: true,
    })
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const playerA = teamA.players[0]!
    const playerB = teamB.players[0]!

    const traded = executeTrade(league, {
      from: { teamId: teamA.id, playerIds: [playerA.id], pickIds: [] },
      to: { teamId: teamB.id, playerIds: [playerB.id], pickIds: [] },
    })

    const moved = traded.seasonState.teams
      .flatMap((team) => team.players)
      .find((player) => player.id === playerA.id)

    expect(moved?.seasonsWithTeam).toBe(0)
  })
})
