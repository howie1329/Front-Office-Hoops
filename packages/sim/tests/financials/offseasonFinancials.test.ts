import { describe, expect, it } from "vitest"

import { completeFreeAgencyPhase, createLeague, createRng } from "../../src"
import {
  ensureFaPoolMinimum,
  getExternalFreeAgents,
  getTeamExpiredFreeAgents,
  processOffseasonFinancials,
} from "../../src/financials"
import { startNextSeason } from "../../src/startNextSeason"

describe("offseason financial flow", () => {
  it("seeds new leagues with a baseline free agent pool", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Seeded FA Pool",
      baseSeed: "seeded-fa",
      rng: createRng("seeded-fa"),
      useMiniLeague: true,
    })

    expect(league.freeAgentPool.length).toBeGreaterThanOrEqual(8)
    expect(league.freeAgentPool.every((player) => player.teamId === null)).toBe(true)
    expect(league.freeAgentPool.every((player) => player.status === "free_agent")).toBe(
      true,
    )
  })

  it("tops up the free agent pool when it falls below the minimum", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Top Up FA Pool",
      baseSeed: "top-up-fa",
      rng: createRng("top-up-fa"),
      useMiniLeague: true,
    })
    const thinPool = { ...league, freeAgentPool: [] }

    const toppedUp = ensureFaPoolMinimum(thinPool, createRng("top-up-fa-min"))

    expect(toppedUp.freeAgentPool).toHaveLength(8)
    expect(toppedUp.freeAgentPool.every((player) => player.activeContractId === null)).toBe(
      true,
    )
  })

  it("opens offseason by expiring contracts without AI re-signing immediately", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Offseason Financials",
      baseSeed: "offseason-financials",
      rng: createRng("offseason-financials"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const expiringPlayer = [...team.players].sort(
      (a, b) => b.ratings.overall - a.ratings.overall,
    )[0]!
    const expiringContract = league.contracts.find(
      (contract) => contract.playerId === expiringPlayer.id,
    )!
    const leagueWithExpiring = {
      ...league,
      contracts: league.contracts.map((contract) =>
        contract.id === expiringContract.id
          ? { ...contract, yearlySalaries: [contract.yearlySalaries[0]!] }
          : contract,
      ),
    }

    const opened = processOffseasonFinancials(
      leagueWithExpiring,
      createRng("offseason-open"),
    )

    expect(opened.freeAgentPool.some((player) => player.id === expiringPlayer.id)).toBe(
      true,
    )
    expect(getTeamExpiredFreeAgents(opened, team.id).map((player) => player.id)).toContain(
      expiringPlayer.id,
    )
    expect(getExternalFreeAgents(opened, team.id).some((player) => player.id === expiringPlayer.id)).toBe(
      false,
    )
    expect(
      opened.seasonState.teams
        .find((entry) => entry.id === team.id)
        ?.players.some((player) => player.id === expiringPlayer.id),
    ).toBe(false)
  })

  it("fills short AI rosters during free agency", () => {
    const league = createLeague({ skipPreseason: true,
      name: "AI FA Fill",
      baseSeed: "ai-fa-fill",
      rng: createRng("ai-fa-fill"),
    })
    const userTeamId = league.seasonState.teams[0]!.id
    const shortTeam = league.seasonState.teams[1]!
    const shortTeamPlayers = shortTeam.players.slice(0, 10)
    const freeAgentPool = [
      ...league.freeAgentPool,
      ...shortTeam.players.slice(10).map((player) => ({
        ...player,
        teamId: null,
        status: "free_agent" as const,
        activeContractId: null,
      })),
    ]
    const freeAgencyLeague = {
      ...league,
      userTeamId,
      freeAgentPool,
      seasonState: {
        ...league.seasonState,
        phase: "offseason" as const,
        offseasonPhase: "free_agency" as const,
        playoffBracket: {
          series: [],
          championTeamId: league.seasonState.teams[0]!.id,
        },
        draftState: {
          year: 1,
          prospects: [],
          order: [],
          currentPickIndex: 0,
          completed: true,
          selections: [],
        },
        teams: league.seasonState.teams.map((team) =>
          team.id === shortTeam.id
            ? { ...team, players: shortTeamPlayers }
            : team,
        ),
      },
    }

    const completed = completeFreeAgencyPhase(
      freeAgencyLeague,
      createRng("ai-fa-fill-run"),
    )

    expect(
      completed.seasonState.teams.find((team) => team.id === shortTeam.id)
        ?.players,
    ).toHaveLength(15)
  })

  it("can start the next season after completed free agency", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Start Season Two",
      baseSeed: "start-season-two",
      rng: createRng("start-season-two"),
    })
    const userTeamId = league.seasonState.teams[0]!.id
    const freeAgencyLeague = {
      ...league,
      userTeamId,
      seasonState: {
        ...league.seasonState,
        phase: "offseason" as const,
        offseasonPhase: "free_agency" as const,
        playoffBracket: {
          series: [],
          championTeamId: league.seasonState.teams[0]!.id,
        },
        draftState: {
          year: 1,
          prospects: [],
          order: [],
          currentPickIndex: 0,
          completed: true,
          selections: [],
        },
      },
    }

    const completed = completeFreeAgencyPhase(
      freeAgencyLeague,
      createRng("start-season-two-fa"),
    )
    const next = startNextSeason({
      seasonState: completed.seasonState,
      userTeamId,
      freeAgentPool: completed.freeAgentPool,
      rng: createRng("start-season-two-next"),
      league: {
        contracts: completed.contracts,
        leagueFinancials: completed.leagueFinancials,
        teamFinancials: completed.teamFinancials,
        spendingProfileEvents: completed.spendingProfileEvents,
      },
    })

    expect(next.seasonState.season).toBe(2)
    expect(next.seasonState.phase).toBe("preseason")
  })
})
