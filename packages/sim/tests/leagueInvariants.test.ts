import { describe, expect, it } from "vitest"

import { ROSTER_MAX } from "@workspace/shared/constants"

import {
  applyLeagueCommand,
  createLeague,
  createRng,
  getSeasonFinancials,
  signFreeAgent,
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

    next = signFreeAgent(
      next,
      next.userTeamId!,
      candidate.id,
      {
        firstYearSalary: calculateMinSalary(
          seasonFinancials,
          candidate.yearsOfService
        ),
        years: 1,
      },
    )
    expectLeagueInvariants(next)
  }

  return next
}

function trimUserRoster(league: ReturnType<typeof createLeague>) {
  let next = league

  while (getUserRosterSize(next) > ROSTER_MAX) {
    const userTeam = next.seasonState.teams.find(
      (team) => team.id === next.userTeamId
    )
    if (!userTeam) {
      throw new Error("Expected user team to trim roster")
    }

    const candidates = [...userTeam.players].sort(
      (left, right) => left.ratings.overall - right.ratings.overall,
    )

    let released = false
    for (const player of candidates) {
      try {
        next = applyLeagueCommand(next, {
          type: "releasePlayer",
          playerId: player.id,
        })
        expectLeagueInvariants(next)
        released = true
        break
      } catch {
        continue
      }
    }

    if (!released) {
      throw new Error("Could not trim user roster without breaking position floors")
    }
  }

  return next
}

describe("league invariants", () => {
  it("survives five deterministic mini-league seasons through the command flow", () => {
    let league = createLeague({ skipPreseason: true,
      name: "Invariant Soak",
      baseSeed: "invariant-soak",
      rng: createRng("invariant-soak"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })

    expectLeagueInvariants(league)

    for (let season = 1; season <= 5; season += 1) {
      if (league.seasonState.phase === "preseason") {
        if (getUserRosterSize(league) < ROSTER_MAX) {
          league = fillUserRoster(league)
        }
        if (getUserRosterSize(league) > ROSTER_MAX) {
          league = trimUserRoster(league)
        }

        league = applyLeagueCommand(league, {
          type: "skipRemainingExhibitions",
        })
        league = applyLeagueCommand(league, { type: "beginRegularSeason" })
      }

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

      league = applyLeagueCommand(league, { type: "completeStaffPhase" })
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
