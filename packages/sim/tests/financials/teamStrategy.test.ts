import { describe, expect, it } from "vitest"

import { createLeague, createRng } from "../../src"
import {
  createDefaultStrategy,
  proposeTeamMode,
  updateTeamStrategy,
} from "../../src/financials/teamStrategy"
import type { TeamFinancials } from "@workspace/shared/financialTypes"

function mockTeamFinance(mode: TeamFinancials["strategy"]["mode"]): TeamFinancials {
  return {
    teamId: "t1",
    spendingProfile: {
      marketTier: "mid",
      taxTolerance: "prudent",
      baseTaxTolerance: "prudent",
    },
    strategy: createDefaultStrategy(1, mode),
    cashReserves: 20,
    debt: 0,
    consecutiveTaxSeasons: 0,
    lastTaxBill: null,
    mleUsed: 0,
    mleRemaining: 12,
    roomMleUsed: 0,
    roomMleRemaining: 8,
    wasUnderCapThisYear: true,
    scoutingLevel: 5,
    coachingLevel: 5,
    developmentLevel: 5,
    tradeExceptions: [],
    deadCapCharges: [],
  }
}

const seasonFinancials = {
  season: 1,
  salaryCap: 141,
  minimumTeamSalary: 127,
  luxuryTaxLine: 171,
  taxBracketSize: 5.2,
  averageSalary: 9.4,
  mleNonTaxpayer: 12.8,
  mleTaxpayer: 5.2,
  mleRoom: 8,
  minimumSalaries: { tier1: 1.1, tier2: 2, tier3: 3.2 },
  rookieScale: Array.from({ length: 30 }, () => 5),
}

describe("teamStrategy", () => {
  it("forces selling when debt exceeds threshold", () => {
    const finance = mockTeamFinance("contending")
    finance.debt = 35

    const mode = proposeTeamMode(
      {
        teamId: "t1",
        avgAge: 26,
        payroll: 160,
        capSpace: -19,
        teamOvr: 80,
        wins: 50,
        madePlayoffs: true,
        isTopFourSeed: true,
      },
      finance,
      seasonFinancials,
    )

    expect(mode).toBe("selling")
  })

  it("applies hysteresis before switching modes", () => {
    const finance = mockTeamFinance("contending")
    const signals = {
      teamId: "t1",
      avgAge: 30,
      payroll: 180,
      capSpace: -39,
      teamOvr: 70,
      wins: 30,
      madePlayoffs: false,
      isTopFourSeed: false,
    }

    const afterOneSeason = updateTeamStrategy(
      finance,
      signals,
      seasonFinancials,
      2,
    )
    expect(afterOneSeason.strategy.mode).toBe("contending")
    expect(afterOneSeason.strategy.pendingMode).toBe("selling")

    const afterTwoSeasons = updateTeamStrategy(
      afterOneSeason,
      signals,
      seasonFinancials,
      3,
    )
    expect(afterTwoSeasons.strategy.mode).toBe("selling")
  })

  it("assigns strategy on league creation", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Strategy Test League",
      baseSeed: "strategy-test",
      rng: createRng("strategy-test"),
      useMiniLeague: true,
    })

    for (const teamFinance of league.teamFinancials) {
      expect(teamFinance.strategy).toBeDefined()
      expect(["selling", "buying", "contending"]).toContain(
        teamFinance.strategy.mode,
      )
    }
  })
})
