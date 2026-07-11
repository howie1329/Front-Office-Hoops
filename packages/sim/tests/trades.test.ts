import { describe, expect, it } from "vitest"

import type {
  LeagueRecord,
  Player,
  TeamWithRoster,
  TradeProposal,
} from "@workspace/shared/types"

import {
  applyLeagueCommand,
  createLeague,
  createRng,
  executeTrade,
  validateTrade,
  wouldAiAcceptTrade,
} from "../src"

function createTradeLeague(): LeagueRecord {
  return createLeague({ skipPreseason: true,
    name: "Trade League",
    baseSeed: "trade-league",
    rng: createRng("trade-league"),
    useMiniLeague: true,
  })
}

function highestSalaryPlayer(
  league: LeagueRecord,
  team: TeamWithRoster
): Player {
  return [...team.players].sort((a, b) => {
    const aSalary =
      league.contracts.find((contract) => contract.id === a.activeContractId)
        ?.yearlySalaries[0] ?? 0
    const bSalary =
      league.contracts.find((contract) => contract.id === b.activeContractId)
        ?.yearlySalaries[0] ?? 0
    return bSalary - aSalary
  })[0]!
}

function lowestSalaryPlayer(
  league: LeagueRecord,
  team: TeamWithRoster
): Player {
  return [...team.players].sort((a, b) => {
    const aSalary =
      league.contracts.find((contract) => contract.id === a.activeContractId)
        ?.yearlySalaries[0] ?? 0
    const bSalary =
      league.contracts.find((contract) => contract.id === b.activeContractId)
        ?.yearlySalaries[0] ?? 0
    return aSalary - bSalary
  })[0]!
}

function closestSalaryMatch(
  league: LeagueRecord,
  teamA: TeamWithRoster,
  teamB: TeamWithRoster,
): { playerA: Player; playerB: Player } {
  const salary = (player: Player) =>
    league.contracts.find((contract) => contract.id === player.activeContractId)
      ?.yearlySalaries[0] ?? 0

  let bestPair = {
    playerA: teamA.players[0]!,
    playerB: teamB.players[0]!,
    delta: Number.POSITIVE_INFINITY,
  }

  for (const playerA of teamA.players) {
    for (const playerB of teamB.players) {
      const delta = Math.abs(salary(playerA) - salary(playerB))
      if (delta < bestPair.delta) {
        bestPair = { playerA, playerB, delta }
      }
    }
  }

  return { playerA: bestPair.playerA, playerB: bestPair.playerB }
}

function makeProposal(
  teamA: TeamWithRoster,
  playersA: Player[],
  teamB: TeamWithRoster,
  playersB: Player[]
): TradeProposal {
  return {
    from: {
      teamId: teamA.id,
      playerIds: playersA.map((player) => player.id),
    },
    to: {
      teamId: teamB.id,
      playerIds: playersB.map((player) => player.id),
    },
  }
}

describe("trades", () => {
  it("executes a valid player-for-player trade and moves contracts", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const { playerA, playerB } = closestSalaryMatch(league, teamA, teamB)
    const proposal = makeProposal(teamA, [playerA], teamB, [playerB])

    const validation = validateTrade(league, proposal)
    expect(validation.ok, !validation.ok ? validation.reason : "").toBe(true)

    const updated = executeTrade(league, proposal)
    const updatedTeamA = updated.seasonState.teams.find(
      (team) => team.id === teamA.id
    )!
    const updatedTeamB = updated.seasonState.teams.find(
      (team) => team.id === teamB.id
    )!
    const playerAContract = updated.contracts.find(
      (contract) =>
        contract.playerId === playerA.id && contract.status === "active"
    )!
    const playerBContract = updated.contracts.find(
      (contract) =>
        contract.playerId === playerB.id && contract.status === "active"
    )!

    expect(
      updatedTeamA.players.some((player) => player.id === playerB.id)
    ).toBe(true)
    expect(
      updatedTeamB.players.some((player) => player.id === playerA.id)
    ).toBe(true)
    expect(playerAContract.teamId).toBe(teamB.id)
    expect(playerBContract.teamId).toBe(teamA.id)
  })

  it("rejects trades that would put a team over the roster limit", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const proposal = makeProposal(teamA, [teamA.players[0]!], teamB, [])

    expect(validateTrade(league, proposal)).toEqual({
      ok: false,
      reason: "Trade would put a team over the roster limit",
    })
  })

  it("rejects duplicate assets and picks not owned by the sending team", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const playerA = lowestSalaryPlayer(league, teamA)
    const playerB = lowestSalaryPlayer(league, teamB)
    const teamBPick = league.draftPickAssets.find(
      (pick) => pick.currentTeamId === teamB.id
    )!

    expect(
      validateTrade(league, {
        from: { teamId: teamA.id, playerIds: [playerA.id, playerA.id] },
        to: { teamId: teamB.id, playerIds: [playerB.id] },
      })
    ).toEqual({ ok: false, reason: "Trade contains duplicate assets" })

    expect(
      validateTrade(league, {
        from: { teamId: teamA.id, playerIds: [playerA.id], pickIds: [teamBPick.id] },
        to: { teamId: teamB.id, playerIds: [playerB.id] },
      })
    ).toEqual({ ok: false, reason: "Trade pick not found on expected team" })
  })

  it("rejects injured players", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const playerA = lowestSalaryPlayer(league, teamA)
    const playerB = lowestSalaryPlayer(league, teamB)
    const injuredLeague: LeagueRecord = {
      ...league,
      seasonState: {
        ...league.seasonState,
        teams: league.seasonState.teams.map((team) =>
          team.id === teamA.id
            ? {
                ...team,
                players: team.players.map((player) =>
                  player.id === playerA.id
                    ? {
                        ...player,
                        status: "injured",
                        injury: {
                          type: "minor",
                          gamesRemaining: 2,
                          description: "Sprained ankle",
                        },
                      }
                    : player
                ),
              }
            : team
        ),
      },
    }

    expect(validateTrade(injuredLeague, makeProposal(teamA, [playerA], teamB, [playerB]))).toEqual({
      ok: false,
      reason: "Only active players can be traded",
    })
  })

  it("rejects trades that fail salary matching", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const highSalary = highestSalaryPlayer(league, teamA)
    const lowSalary = lowestSalaryPlayer(league, teamB)
    const proposal = makeProposal(teamA, [highSalary], teamB, [lowSalary])
    const validation = validateTrade(league, proposal)

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.reason).toMatch(/salary matching/)
    }
  })

  it("lets AI reject lopsided value", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const teamAStar = [...teamA.players].sort(
      (a, b) => b.ratings.overall - a.ratings.overall
    )[0]!
    const teamBBench = [...teamB.players].sort(
      (a, b) => a.ratings.overall - b.ratings.overall
    )[0]!
    const salaryMatchedLeague: LeagueRecord = {
      ...league,
      contracts: league.contracts.map((contract) =>
        contract.playerId === teamAStar.id ||
        contract.playerId === teamBBench.id
          ? { ...contract, yearlySalaries: [10], guaranteedSalaries: [10] }
          : contract
      ),
      teamFinancials: league.teamFinancials.map((entry) =>
        entry.teamId === teamA.id
          ? {
              ...entry,
              strategy: {
                ...entry.strategy,
                mode: "contending",
              },
            }
          : entry
      ),
    }
    const proposal = makeProposal(teamA, [teamAStar], teamB, [teamBBench])

    expect(wouldAiAcceptTrade(salaryMatchedLeague, proposal, teamA.id)).toEqual(
      {
        ok: false,
        reason: "Rejected: this does not improve their projected rotation",
      }
    )
  })

  it("checks AI acceptance before executing user command trades", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const teamAStar = [...teamA.players].sort(
      (a, b) => b.ratings.overall - a.ratings.overall
    )[0]!
    const teamBBench = [...teamB.players].sort(
      (a, b) => a.ratings.overall - b.ratings.overall
    )[0]!
    const salaryMatchedLeague: LeagueRecord = {
      ...league,
      userTeamId: teamB.id,
      contracts: league.contracts.map((contract) =>
        contract.playerId === teamAStar.id ||
        contract.playerId === teamBBench.id
          ? { ...contract, yearlySalaries: [10], guaranteedSalaries: [10] }
          : contract
      ),
      teamFinancials: league.teamFinancials.map((entry) =>
        entry.teamId === teamA.id
          ? {
              ...entry,
              strategy: {
                ...entry.strategy,
                mode: "contending",
              },
            }
          : entry
      ),
    }

    expect(() =>
      applyLeagueCommand(salaryMatchedLeague, {
        type: "executeTrade",
        proposal: makeProposal(teamB, [teamBBench], teamA, [teamAStar]),
      })
    ).toThrow("does not improve their projected rotation")
  })

  it("moves draft pick ownership and records trade history", () => {
    const league = createTradeLeague()
    const teamA = league.seasonState.teams[0]!
    const teamB = league.seasonState.teams[1]!
    const { playerA, playerB } = closestSalaryMatch(league, teamA, teamB)
    const pickA = league.draftPickAssets.find(
      (pick) => pick.currentTeamId === teamA.id && pick.round === 1
    )!
    const proposal: TradeProposal = {
      from: {
        teamId: teamA.id,
        playerIds: [playerA.id],
        pickIds: [pickA.id],
      },
      to: {
        teamId: teamB.id,
        playerIds: [playerB.id],
      },
    }

    const updated = executeTrade(league, proposal)
    const movedPick = updated.draftPickAssets.find(
      (pick) => pick.id === pickA.id
    )!
    const historyEntry = updated.tradeHistory[0]!

    expect(movedPick.currentTeamId).toBe(teamB.id)
    expect(historyEntry.teams[0]!.sentPickIds).toEqual([pickA.id])
    expect(historyEntry.teams[1]!.receivedPickIds).toEqual([pickA.id])
    expect(updated.leagueLog[0]).toMatchObject({
      type: "trade",
      payload: {
        fromTeamId: teamA.id,
        toTeamId: teamB.id,
        fromOutgoingSalary: expect.any(Number),
        toIncomingSalary: expect.any(Number),
        fromNetValue: expect.any(Number),
        toNetValue: expect.any(Number),
      },
    })
  })
})
