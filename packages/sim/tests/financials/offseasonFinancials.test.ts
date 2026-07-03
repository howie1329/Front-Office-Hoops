import { describe, expect, it } from "vitest"

import { createLeague, createRng } from "../../src"
import {
  ensureFaPoolMinimum,
  getExternalFreeAgents,
  getTeamExpiredFreeAgents,
  processOffseasonFinancials,
} from "../../src/financials"

describe("offseason financial flow", () => {
  it("seeds new leagues with a baseline free agent pool", () => {
    const league = createLeague({
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
    const league = createLeague({
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
    const league = createLeague({
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
})
