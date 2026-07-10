import { describe, expect, it } from "vitest"

import type { LeagueRecord, Player, TeamMode } from "@workspace/shared/types"

import { createLeague, createRng, evaluateTradeUtility, wouldAiAcceptTrade } from "../src"

function withRegressionTrade(mode: TeamMode): {
  league: LeagueRecord
  proposal: { from: { teamId: string; playerIds: string[] }; to: { teamId: string; playerIds: string[] } }
  aiTeamId: string
} {
  const league = createLeague({
    skipPreseason: true,
    name: "Trade evaluation",
    baseSeed: "trade-evaluation",
    rng: createRng("trade-evaluation"),
    useMiniLeague: true,
  })
  const aiTeam = league.seasonState.teams[0]!
  const otherTeam = league.seasonState.teams[1]!
  const outgoing = aiTeam.players[0]!
  const incoming = otherTeam.players[0]!
  const setPlayer = (player: Player, overall: number, age: number): Player => ({
    ...player,
    age,
    peakAge: age === 25 ? 28 : 29,
    position: "SF",
    archetype: "three_and_d_wing",
    ratings: { ...player.ratings, overall, potential: overall },
  })

  const updatedLeague: LeagueRecord = {
    ...league,
    seasonState: {
      ...league.seasonState,
      teams: league.seasonState.teams.map((team) => {
        if (team.id === aiTeam.id) {
          return { ...team, players: team.players.map((player) => player.id === outgoing.id ? setPlayer(player, 87, 25) : player) }
        }
        if (team.id === otherTeam.id) {
          return { ...team, players: team.players.map((player) => player.id === incoming.id ? setPlayer(player, 81, 31) : player) }
        }
        return team
      }),
    },
    contracts: league.contracts.map((contract) => {
      if (contract.playerId === outgoing.id) return { ...contract, yearlySalaries: [30, 31, 32] }
      if (contract.playerId === incoming.id) return { ...contract, yearlySalaries: [26] }
      return contract
    }),
    teamFinancials: league.teamFinancials.map((financials) => financials.teamId === aiTeam.id ? { ...financials, strategy: { ...financials.strategy, mode } } : financials),
  }

  return {
    league: updatedLeague,
    proposal: {
      from: { teamId: aiTeam.id, playerIds: [outgoing.id] },
      to: { teamId: otherTeam.id, playerIds: [incoming.id] },
    },
    aiTeamId: aiTeam.id,
  }
}

describe("trade evaluation", () => {
  it.each<TeamMode>(["selling", "buying", "contending"])(
    "rejects an older lower-value same-role replacement for %s teams",
    (mode) => {
      const { league, proposal, aiTeamId } = withRegressionTrade(mode)

      expect(wouldAiAcceptTrade(league, proposal, aiTeamId).ok).toBe(false)
    },
  )

  it("evaluates the same seeded proposal deterministically", () => {
    const first = withRegressionTrade("buying")
    const second = withRegressionTrade("buying")

    expect(evaluateTradeUtility(first.league, first.proposal)).toEqual(
      evaluateTradeUtility(second.league, second.proposal),
    )
    expect(wouldAiAcceptTrade(first.league, first.proposal, first.aiTeamId)).toEqual(
      wouldAiAcceptTrade(second.league, second.proposal, second.aiTeamId),
    )
  })
})
