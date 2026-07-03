import { describe, expect, it } from "vitest"

import type { Player } from "@workspace/shared/types"

import {
  createLeague,
  createRng,
  prepareDraft,
  simAiPick,
  simulateSeason,
} from "../../src"
import { beginOffseason } from "../../src/beginOffseason"
import { beginPlayoffs } from "../../src/beginPlayoffs"
import {
  attachRookieContractsForDraftSelections,
  calculateSeasonFinancials,
  generateInitialContract,
  getTeamPayroll,
} from "../../src/financials"
import { simulatePlayoffs } from "../../src/simulatePlayoffs"

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p_test_young",
    teamId: "t_test",
    firstName: "Test",
    lastName: "Player",
    age: 20,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    position: "SG",
    ratings: {
      overall: 78,
      potential: 88,
      shooting: 78,
      inside: 78,
      passing: 78,
      rebounding: 78,
      defense: 78,
      stamina: 78,
      usage: 20,
    },
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 1,
    yearsOfService: 1,
    ...overrides,
  }
}

function completeSeasonToOffseason(
  league = createLeague({
    name: "Contract Draft Test",
    baseSeed: "contract-draft",
    rng: createRng("contract-draft"),
    useMiniLeague: true,
  })
) {
  let state = simulateSeason(league.seasonState)
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(
    state,
    createRng(`${state.baseSeed}:offseason:${state.season}`)
  )
  return { league, state }
}

describe("contracts", () => {
  it("puts valuable young league-start players on bargain standard deals", () => {
    const seasonFinancials = calculateSeasonFinancials(141, 0.05, 1)
    const player = makePlayer()
    const contract = generateInitialContract(
      player,
      "t_test",
      1,
      seasonFinancials,
      createRng("young-contract")
    )

    expect(contract.contractType).toBe("standard")
    expect(contract.signingException).toBe("cap_room")
    expect(contract.yearlySalaries[0]).toBeGreaterThan(
      seasonFinancials.minimumSalaries.tier1 * 3
    )
    expect(contract.yearlySalaries[0]).toBeLessThan(
      seasonFinancials.salaryCap * 0.25
    )
  })

  it("still allows low-value young depth players to start on minimum deals", () => {
    const seasonFinancials = calculateSeasonFinancials(141, 0.05, 1)
    const player = makePlayer({
      age: 20,
      yearsOfService: 1,
      ratings: {
        ...makePlayer().ratings,
        overall: 50,
        potential: 58,
        shooting: 50,
        inside: 50,
        passing: 50,
        rebounding: 50,
        defense: 50,
        stamina: 50,
      },
    })
    const contract = generateInitialContract(
      player,
      "t_test",
      1,
      seasonFinancials,
      createRng("young-depth-contract")
    )

    expect(contract.contractType).toBe("minimum")
  })

  it("attaches rookie contracts to AI draft selections", () => {
    const { league, state } = completeSeasonToOffseason()
    const prepared = prepareDraft(state)
    const picked = simAiPick(prepared, league.freeAgentPool)
    const withSelection = {
      ...league,
      seasonState: picked.seasonState,
      freeAgentPool: picked.freeAgentPool,
    }

    const updated = attachRookieContractsForDraftSelections(withSelection)
    const selection = updated.seasonState.draftState?.selections[0]
    const draftedPlayer = updated.seasonState.teams
      .flatMap((team) => team.players)
      .find((player) => player.id === selection?.playerId)
    const contract = updated.contracts.find(
      (entry) => entry.playerId === selection?.playerId
    )

    expect(draftedPlayer?.activeContractId).toBe(contract?.id)
    expect(contract?.contractType).toBe("rookie_scale")
    expect(contract?.yearlySalaries[0]).toBeLessThan(15)
  })

  it("normalizes opening contracts into plausible payroll and salary tiers", () => {
    const league = createLeague({
      name: "Normalized Contracts",
      baseSeed: "normalized-contracts",
      rng: createRng("normalized-contracts"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const contracts = league.contracts.filter(
      (contract) => contract.teamId === team.id
    )
    const playerContracts = team.players
      .map((player) => ({
        player,
        contract: contracts.find(
          (contract) => contract.playerId === player.id
        )!,
      }))
      .sort((a, b) => b.player.ratings.overall - a.player.ratings.overall)
    const topSalary = playerContracts[0]!.contract.yearlySalaries[0]!
    const bottomSalary =
      playerContracts[playerContracts.length - 1]!.contract.yearlySalaries[0]!
    const lengths = new Set(
      contracts.map((contract) => contract.yearlySalaries.length)
    )
    const seasonFinancials = league.leagueFinancials.bySeason[1]!
    const payroll = getTeamPayroll(team.id, league.contracts)

    expect(topSalary).toBeGreaterThan(bottomSalary)
    expect(lengths.size).toBeGreaterThan(1)
    expect(payroll).toBeGreaterThan(seasonFinancials.minimumTeamSalary * 0.7)
    expect(payroll).toBeLessThan(seasonFinancials.luxuryTaxLine * 1.2)
  })

  it("keeps full-league opening payrolls below runaway levels", () => {
    const league = createLeague({
      name: "Full League Payroll",
      baseSeed: "full-league-payroll",
      rng: createRng("full-league-payroll"),
    })
    const seasonFinancials = league.leagueFinancials.bySeason[1]!

    for (const team of league.seasonState.teams) {
      const payroll = getTeamPayroll(team.id, league.contracts)

      expect(payroll).toBeLessThanOrEqual(seasonFinancials.salaryCap * 1.82)
    }
  })

  it("keeps full-league opening payrolls above realistic minimum bands", () => {
    const league = createLeague({
      name: "Full League Payroll Floor",
      baseSeed: "full-league-payroll-floor",
      rng: createRng("full-league-payroll-floor"),
    })
    const seasonFinancials = league.leagueFinancials.bySeason[1]!

    for (const team of league.seasonState.teams) {
      const payroll = getTeamPayroll(team.id, league.contracts)

      expect(payroll).toBeGreaterThanOrEqual(seasonFinancials.salaryCap * 0.65)
    }
  })

  it("does not leave generated young starters on minimum contracts", () => {
    const league = createLeague({
      name: "Young Starter Contracts",
      baseSeed: "young-starter-contracts",
      rng: createRng("young-starter-contracts"),
    })
    const seasonFinancials = league.leagueFinancials.bySeason[1]!
    const youngStarters = league.seasonState.teams
      .flatMap((team) => team.players)
      .filter(
        (player) =>
          player.age <= 22 &&
          player.ratings.overall >= 70 &&
          player.ratings.potential >= 80,
      )

    expect(youngStarters.length).toBeGreaterThan(0)
    for (const player of youngStarters) {
      const contract = league.contracts.find(
        (entry) => entry.playerId === player.id
      )

      expect(contract?.contractType).toBe("standard")
      expect(contract?.yearlySalaries[0]).toBeGreaterThan(
        seasonFinancials.minimumSalaries.tier1 * 3
      )
    }
  })
})
