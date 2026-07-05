import { describe, expect, it } from "vitest"

import { ROSTER_MAX } from "@workspace/shared/constants"

import {
  applyLeagueCommand,
  createLeague,
  createRng,
  getSeasonFinancials,
} from "../src"
import { calculateMinSalary } from "../src/financials/capMath"
import { expectLeagueInvariants } from "./helpers/leagueInvariants"

function getUserRosterSize(league: ReturnType<typeof createLeague>): number {
  return (
    league.seasonState.teams.find((team) => team.id === league.userTeamId)
      ?.players.length ?? 0
  )
}

function fillUserRoster(league: ReturnType<typeof createLeague>) {
  let next = league
  const seasonFinancials = getSeasonFinancials(
    next.leagueFinancials,
    next.seasonState.season
  )

  while (getUserRosterSize(next) < ROSTER_MAX) {
    const candidate = next.freeAgentPool[0]
    if (!candidate) {
      throw new Error("Expected free agents to fill user roster")
    }

    next = applyLeagueCommand(next, {
      type: "signFreeAgent",
      playerId: candidate.id,
      offer: {
        firstYearSalary: calculateMinSalary(
          seasonFinancials,
          candidate.yearsOfService
        ),
        years: 1,
      },
    })
    expectLeagueInvariants(next)
  }

  return next
}

describe("league invariants", () => {
  it("survives five deterministic mini-league seasons through the command flow", () => {
    let league = createLeague({
      name: "Invariant Soak",
      baseSeed: "invariant-soak",
      rng: createRng("invariant-soak"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })

    expectLeagueInvariants(league)

    for (let season = 1; season <= 5; season += 1) {
      league = applyLeagueCommand(league, { type: "simSeason" })
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "beginPlayoffs" })
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "simulatePlayoffs" })
      expect(league.seasonState.phase).toBe("complete")
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "beginOffseason" })
      expect(league.playerSeasonProfiles.length).toBeGreaterThan(0)
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "completeReSignings" })
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "prepareDraft" })
      expectLeagueInvariants(league)

      while (!league.seasonState.draftState?.completed) {
        league = applyLeagueCommand(league, { type: "simAiPick" })
        expectLeagueInvariants(league)
      }

      league = applyLeagueCommand(league, { type: "advanceToFreeAgency" })
      expectLeagueInvariants(league)

      league = applyLeagueCommand(league, { type: "completeFreeAgency" })
      expectLeagueInvariants(league)

      league = fillUserRoster(league)
      league = applyLeagueCommand(league, { type: "startNextSeason" })
      expectLeagueInvariants(league)
    }

    expect(league.seasonHistory).toHaveLength(5)
    expect(league.seasonState.season).toBe(6)
  })
})
